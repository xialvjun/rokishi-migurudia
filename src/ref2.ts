import { queueMacrotask, queueMicrotask, tryCatchLog } from "./tools";

// Effect 是实实在在在 State/Computed 里面的，但 Computed 不该在 State/Computed 里
// Computed 应该可以自动被回收，而 Effect 只有在 revoke 之后才会被回收
// 即 state 里有 effect，computed 里有 state/computed，~~effect 里有 state/computed~~,
// effect 里啥都没有，直接有个 fn 就够了。。不对，revoker 需要有 state
// 在 state 发生变化时，effect 调用，~~但 effect 调用前会递归问自己的 computed，让他们去检查并更新版本，之后才调用 effect~~
// effect 不需要递归问 computed，它只要执行就行了，需要递归的是 computed 的 get 方法，它需要检查 state 的版本，以及递归问上层 computed 的 state 版本
// 要停止 effect 需要手动调用 revoker，则会把 effect 从 state 里去除，因为不会有内存泄漏
// 不对，还有问题：如果 effect 依赖的完全是 computed 怎么办。此时 state 变化要通知谁
// 所以还有 computed 的 get 是要递归找到 state 并加到 effect 里

// 还有，state/computed 都还可以减去重复值，哪怕 state 没重复，computed 也可能重复。。。所以 computed 也有个 version
// 而且只能用 computed 递归 computed，不能用 computed 复制依赖的 computed 的 state

function link_state_effect(state: State, effect: Effect) {
  state.effects.add(effect);
  effect.states.add(state);
}

class State<T = any> {
  s: T;
  version = 0;
  effects = new Set<Effect>();
  constructor(s: T) {
    this.s = s;
  }
  get() {
    CURRENT_COMPUTED?.states.set(this, this.version);
    CURRENT_EFFECT && link_state_effect(this, CURRENT_EFFECT);
    return this.s;
  }
  set(s: T) {
    this.s = s;
    this.version++;
    this.effects.forEach((it) => it.run());
  }
}

let CURRENT_COMPUTED: Computed = null!;

class Computed<T = any> {
  fn: () => T;
  cache: T = undefined!;
  states = new Map<State, number>();
  // computeds = new Set<Computed>();
  constructor(fn: () => T) {
    this.fn = fn;
  }
  isDirty() {
    for (const [state, version] of this.states) {
      if (state.version !== version) {
        return true;
      }
    }
    // for (const computed of this.computeds) {
    //   if (computed.isDirty()) {
    //     return true;
    //   }
    // }
    return false;
  }
  track() {
    // track 前要保证自己 isDirty 为 false
    if (CURRENT_COMPUTED) {
      // 这种把依赖的 state 复制一遍，代码逻辑比 computed 递归依赖 computed 要简单得多，性能应该也更好
      // 如果是 递归依赖computed 则 track CURRENT_COMPUTED 倒是简单了，但 isDirty 要变，track CURRENT_EFFECT 要变
      for (const [state, version] of this.states) {
        CURRENT_COMPUTED.states.set(state, version);
      }
    }
    if (CURRENT_EFFECT) {
      for (const [state] of this.states) {
        link_state_effect(state, CURRENT_EFFECT);
      }
    }
    return this.cache;
  }
  get() {
    if (!this.isDirty()) {
      return this.track();
    }
    const old = CURRENT_COMPUTED;
    CURRENT_COMPUTED = this;
    const old_states = this.states;
    this.states = new Map();
    try {
      this.cache = this.fn();
    } catch (error) {
      this.states = old_states;
      // 这里 throw 掉，可以保证 this.track() 时一定 !isDirty()
      throw error;
    } finally {
      CURRENT_COMPUTED = old;
      return this.track();
    }
  }
}

let CURRENT_EFFECT: Effect = null!;

const do_tasks = {
  pre: queueMicrotask,
  post: queueMacrotask,
  sync: (fn: () => void) => fn(),
};
type EffectFlush = "pre" | "post" | "sync";
class Effect {
  fn: any;
  flush: EffectFlush;
  cleanup: Function | null = null;
  constructor(fn: () => unknown | (() => unknown), flush: EffectFlush = "pre") {
    this.flush = flush;
    this.fn = () => {
      this.cleanup?.();
      this.cleanup = null;
      let old = CURRENT_EFFECT;
      CURRENT_EFFECT = this;
      const [cleanup] = tryCatchLog(fn);
      CURRENT_EFFECT = old;
      if (typeof cleanup === "function") {
        this.cleanup = () => tryCatchLog(cleanup as () => any);
      }
    };
    // effect 必然是 immediate 否则连依赖都不知道
    this.fn();
  }
  run() {
    do_tasks[this.flush](this.fn);
  }
  states = new Set<State>();
  revoke() {
    this.cleanup?.();
    this.states.forEach((state) => state.effects.delete(this));
  }
}

const symbol = Symbol("signal");

export function ref<T>(s: T) {
  const sig = new State(s);
  return {
    [symbol]: sig,
    get value() {
      return sig.get();
    },
    set value(v: T) {
      sig.set(v);
    },
  };
}

export function computed<T>(fn: () => T) {
  const sig = new Computed(fn);
  return {
    [symbol]: sig,
    get value() {
      return sig.get();
    },
  };
}

export function effect(
  fn: () => unknown | (() => unknown),
  flush: EffectFlush = "pre"
) {
  const sig = new Effect(fn, flush);
  const revoke = () => sig.revoke();
  revoke[symbol] = sig;
  return revoke;
}

export type Sig<T> = SigRef<T> | SigComputed<T>;
export function isSig(sig: any): sig is Sig<unknown> {
  return isRef(sig) || isComputed(sig);
}

export type SigRef<T> = ReturnType<typeof ref<T>>;
export function isRef(ref: any): ref is SigRef<unknown> {
  return !!ref && ref[symbol] instanceof State;
}

export type SigComputed<T> = ReturnType<typeof computed<T>>;
export function isComputed(cpu: any): cpu is Computed<unknown> {
  return !!cpu && cpu[symbol] instanceof Computed;
}

// export type SigEffect = ReturnType<typeof effect>;
// export function isEffect(eff: any): eff is Effect {
//   return !!eff && eff[symbol] instanceof Effect;
// }

function watch(w: any, fn: any, opts: any) {
  let run = opts.immediate
  effect(() => {
    w.value;
    run = true;
  }, 'sync');
}