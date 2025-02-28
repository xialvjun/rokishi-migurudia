import { queueMacrotask, queueMicrotask, tryCatchLog } from './tools';
import type { Component } from './core';

namespace signal {
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

  export class State<T = any> {
    s: T;
    version = 0;
    effects = new Set<Effect>();
    constructor(s: T) {
      this.s = s;
    }
    get() {
      CURRENT_COMPUTED?.states.set(this, this.version);
      // if (CURRENT_EFFECT) {
      //   this.effects.add(CURRENT_EFFECT);
      //   CURRENT_EFFECT.states.add(this);
      //   CURRENT_EFFECT.memory_states.add(this);
      // }
      CURRENT_EFFECT && link_state_effect(this, CURRENT_EFFECT);
      return this.s;
    }
    set(s: T) {
      if (this.s !== s) {
        this.s = s;
        this.version++;
        // TODO effect 里直接 state 的变化，那就直接运行，但间接 state 的变化，那就要看 computed 的 version
        // 所以 effect 里还要区分直接 state 和 间接 state
        this.effects.forEach(it => it.run());
      }
    }
  }

  let CURRENT_COMPUTED: Computed = null!;

  export class Computed<T = any> {
    fn: () => T;
    cache: T = undefined!;
    states = new Map<State, number>();
    computeds = new Map<Computed, number>();
    temp_dirty = true; // is_sure_dirty
    version = 0;
    constructor(fn: () => T) {
      this.fn = fn;
    }
    isDirty() {
      if (this.temp_dirty) {
        return true;
      }
      for (const [state, version] of this.states) {
        if (state.version !== version) {
          this.temp_dirty = true;
          return true;
        }
      }
      for (const [computed, version] of this.computeds) {
        if (computed.isDirty() || computed.version !== version) {
          this.temp_dirty = true;
          return true;
        }
      }
      this.temp_dirty = false;
      return false;
    }
    track() {
      // track 做 effect 读取时，把 state 以及自己依赖的 computed 的 state 都加到 effect 上
      if (CURRENT_COMPUTED) {
        // link_computed_computed
        CURRENT_COMPUTED.computeds.set(this, this.version);
        // 不用下面的设置 state version 避免代码结构上没有避免版本冲突，虽然代码逻辑上不会
        // 而是 下面 CURRENT_EFFECT && this.computeds.forEach(it => it.track());
        // for (const [state, version] of this.states) {
        //   CURRENT_COMPUTED.states.set(state, version);
        // }
      }
      this.track_eff();
      return this.cache;
    }
    track_eff() {
      if (CURRENT_EFFECT) {
        // link_computed_effect
        for (const [state] of this.states) {
          link_state_effect(state, CURRENT_EFFECT);
        }
        this.computeds.forEach((v, it) => it.track_eff());
      }
    }
    get() {
      if (!this.isDirty()) {
        return this.track();
      }
      const old = CURRENT_COMPUTED;
      CURRENT_COMPUTED = this;
      const old_states = this.states;
      this.states = new Map();
      const old_computeds = this.computeds;
      this.computeds = new Map();
      try {
        const cache = this.fn();
        if (this.cache !== cache) {
          this.cache = cache;
          this.version++;
          this.temp_dirty = false;
        }
      } catch (error) {
        this.states = old_states;
        this.computeds = old_computeds;
        // 这里 throw 掉，可以保证 this.track() 时一定 !isDirty()
        throw error;
      }
      CURRENT_COMPUTED = old;
      return this.track();
    }
  }

  let CURRENT_EFFECT: Effect = null!;

  const do_tasks = {
    pre: queueMicrotask,
    post: queueMacrotask,
    sync: (fn: () => void) => fn(),
  };

  export class Effect {
    computed: Computed;
    flush: EffectFlush;
    cleanup: Function | null = null;
    constructor(fn: () => unknown | (() => unknown), flush: EffectFlush = 'pre') {
      this.flush = flush;
      this.computed = new Computed(() => {
        this.cleanup?.();
        this.cleanup = null;
        let old = CURRENT_EFFECT;
        CURRENT_EFFECT = this;
        const [cleanup] = tryCatchLog(fn);
        CURRENT_EFFECT = old;
        if (typeof cleanup === 'function') {
          this.cleanup = () => tryCatchLog(cleanup as () => any);
        }
      });
      this.computed.get();
    }
    run() {
      do_tasks[this.flush](() => this.computed.get());
    }
    // todo: 这个 states 可以不要，可以直接计算出来，就是 this.computed.states + this.computed.computeds(递归).states ...不过放一个也没问题，甚至更保险
    states = new Set<State>();
    // memory_states = new Set<State>();
    // computeds = new Map<Computed, number>();
    revoke() {
      this.cleanup?.();
      this.states.forEach(state => state.effects.delete(this));
    }
  }
}

const { State: SignalState, Computed: SignalComputed, Effect: SignalEffect } = signal;

const symbol = Symbol('signal');

export function ref<T>(s: T) {
  const sig = new SignalState(s);
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
  const sig = new SignalComputed(fn);
  return {
    [symbol]: sig,
    get value() {
      return sig.get();
    },
  };
}

type EffectFlush = 'sync' | 'pre' | 'post';
export function effect(fn: () => unknown | (() => unknown), flush: EffectFlush = 'pre') {
  const sig = new SignalEffect(fn, flush);
  const revoke = () => sig.revoke();
  // (revoke as any)[symbol] = sig;
  return revoke;
}

type WatchRef<T> = Ref<T> | (() => T);
type WatchFn<T, Imm extends boolean> = (cv: T, pv: Imm extends true ? T | undefined : T, inv: (fn: () => any) => void) => () => void;

const WATCH_OPTS_DEFAULT = { immediate: false, flush: 'pre' } as const;

export function watch<T>(w: WatchRef<T>, fn: WatchFn<T, false>): () => any;
export function watch<T>(w: WatchRef<T>, fn: WatchFn<T, false>, opt: { immediate?: false; flush?: EffectFlush }): () => any;
export function watch<T>(w: WatchRef<T>, fn: WatchFn<T, true>, opt: { immediate: true; flush?: EffectFlush }): () => any;
export function watch<T>(w: WatchRef<T>, fn: WatchFn<T, true>, opt: { immediate: true; flush?: EffectFlush }): () => any;
export function watch(w: any, fn: any, opts?: { immediate?: boolean; flush?: EffectFlush }) {
  let { immediate, flush } = { ...WATCH_OPTS_DEFAULT, ...opts };
  w = typeof w === 'function' ? computed(w) : w;
  let pv: any = undefined;
  let invs: any[] = [];
  return effect(() => {
    invs.forEach(fn => fn());
    invs = [];
    const nv = w.value;
    if (immediate) {
      fn(nv, pv, (fn: any) => invs.push(fn));
    }
    immediate = true;
    pv = nv;
  }, flush);
}

export type Ref<T = any> = ReturnType<typeof ref<T>> | Computed<T>;

export function isRef(ref: any): ref is Ref<unknown> {
  return !!ref && (ref[symbol] instanceof SignalState || ref[symbol] instanceof SignalComputed);
}

export type Computed<T = any> = ReturnType<typeof computed<T>>;

export function isComputed(ref: any): ref is Computed<unknown> {
  return !!ref && ref[symbol] instanceof SignalComputed;
}

// TODO 这种会内存泄漏，组件 unmount 没通知去掉 ref_listener
export function defineComponent<P extends {} = any, C extends {} = any>(type: Component<P, C>) {
  const newType = (initProps: any, ins: any) => {
    const render = type(initProps, ins);
    const vnode = computed(() => render(ins.props));
    ins.on('unmount', watch(vnode, () => ins.update()));
    // return () => vnode.value;
    // 可能有用户改变对象内部属性，此时 computed 仍会返回旧 cache，除非用 computed.force ，但那跟原函数就没区别了
    return render;
  };
  return newType as typeof type;
}

export const Setup = defineComponent<{ key: PropertyKey; children: Component<{}, any> }>((init, ins) => {
  return init.children({}, ins);
});
