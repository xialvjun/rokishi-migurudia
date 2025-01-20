// import { Signal } from "signal-polyfill";
// const {
//   State,
//   Computed,
//   isState: signalIsState,
//   isComputed: signalIsComputed,
//   subtle: { Watcher },
// } = Signal;

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
  computeds = new Set<Computed>();
  constructor(fn: () => T) {
    this.fn = fn;
  }
  isDirty() {
    for (const [state, version] of this.states) {
      if (state.version !== version) {
        return true;
      }
    }
    for (const computed of this.computeds) {
      if (computed.isDirty()) {
        return true;
      }
    }
    return false;
  }
  track() {
    // track 做 effect 读取时，把 state 以及自己依赖的 computed 的 state 都加到 effect 上
    if (CURRENT_COMPUTED) {
      // link_computed_computed
      CURRENT_COMPUTED.computeds.add(this);
      // 不用下面的设置 state version 避免代码结构上没有避免版本冲突，虽然代码逻辑上不会
      // 而是 下面 CURRENT_EFFECT && this.computeds.forEach(it => it.track());
      // for (const [state, version] of this.states) {
      //   CURRENT_COMPUTED.states.set(state, version);
      // }
    }
    if (CURRENT_EFFECT) {
      // link_computed_effect
      this.states.forEach((v, state) =>
        link_state_effect(state, CURRENT_EFFECT)
      );
      this.computeds.forEach((it) => it.track());
    }
    return this.cache;
  }
  get() {
    if (!this.isDirty()) {
      return this.track();
    }
    const old = CURRENT_COMPUTED;
    CURRENT_COMPUTED = this;
    this.states.clear();
    this.computeds.clear();
    const [cache, _, has_error] = tryCatchLog(this.fn);
    if (!has_error) {
      this.cache = cache!;
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

// let current_listener = null;
// let current_dependant = null;
// class State {
//   #s;
//   #deps = new Set();
//   #addDep(dep) {
//     this.#deps.add(dep);
//   }
//   constructor(s: any) {
//     this.s = s;
//   }
//   get() {
//     current_listener && this.#listeners.push()
//   }
//   set() {

//   }
// }

// class State<T=any> {
//   #s: T;
//   #deps = new Set();
//   constructor(s: T) {
//     this.#s = s;
//   }
//   get() {
//     CURRENT_COMPUTED?.addDep(this);
//     return this.#s;
//   }
//   set(s: T) {
//     this.#s = s;

//   }
// }

// class Computed<T=any> {
//   #fn: () => T
//   #cache: T = undefined!;
//   #dirty = true;
//   #deps = new Set();
//   constructor(fn: () => T) {
//     this.#fn = fn;
//   }
//   get() {
//     if (this.#dirty) {
//       const old_current_computed = CURRENT_COMPUTED;
//       CURRENT_COMPUTED = this;
//       this.#cache = this.#fn();
//       CURRENT_COMPUTED = old_current_computed;
//       this.#dirty = false;
//     }
//     return this.#cache;
//   }
//   addDep(s: State | Computed) {
//     this.#deps.add(s);
//   }
// }

// let CURRENT_DEPS: Set<any> = null!;

// // let CURRENT_COMPUTED: any;
// function ref<T>(s: T) {
//   const listeners = new Set<Function>();
//   return {
//     get value() {

//       return s;
//     },
//     set value(nv) {
//       s = nv;
//       // ws.
//     }
//   }
// }

// function computed<T>(fn: () => T) {
//   return {
//     get value() {

//     }
//   }
// }

// function effect(fn: any, { immediate, flush }: any) {
//   const deps = new Set();
//   if (immediate) {
//     let old_current_deps = CURRENT_DEPS;
//     CURRENT_DEPS = deps;
//     const cleanup = fn();
//     CURRENT_DEPS = old_current_deps;
//   }
//   return () => deps.forEach(it => it.listeners.delete(this))
//   function process() {

//   }
// }

// // export function ref<T>(s: T) {
// //   const sig = new State(s);
// //   return {
// //     [symbol]: sig,
// //     get value() {
// //       return sig.get();
// //     },
// //     set value(v: T) {
// //       sig.set(v);
// //     },
// //   };
// // }

// // export function computed<T>(fn: () => T) {
// //   const sig = new Computed(fn);
// //   return {
// //     [symbol]: sig,
// //     get value() {
// //       return sig.get();
// //     },
// //   };
// // }

// // const do_tasks = {
// //   pre: queueMicrotask,
// //   post: queueMacrotask,
// //   sync: (fn: () => void) => fn(),
// // };
// // const watchers = {
// //   pre: create_watcher("pre"),
// //   post: create_watcher("post"),
// //   sync: create_watcher("sync"),
// // };
// // function create_watcher(flush: "pre" | "post" | "sync") {
// //   let needsEnqueue = true;
// //   const do_task = do_tasks[flush];
// //   const w = new Watcher(() => {
// //     if (needsEnqueue) {
// //       needsEnqueue = false;
// //       do_task(processPending);
// //     }
// //   });
// //   return w;
// //   function processPending() {
// //     needsEnqueue = true;
// //     for (const s of w.getPending()) {
// //       s.get();
// //     }
// //     w.watch();
// //   }
// // }

// // const EFFECT_OPTS_DEFAULT = { immediate: false, flush: "pre" } as const;
// // export function effect(
// //   fn: () => unknown | (() => unknown),
// //   opts?: { immediate?: boolean; flush?: "pre" | "post" | "sync" }
// // ) {
// //   opts = { ...EFFECT_OPTS_DEFAULT, ...opts };
// //   let cleanup: unknown | (() => unknown);
// //   const computed = new Signal.Computed(() => {
// //     typeof cleanup === "function" && cleanup();
// //     cleanup = fn();
// //   });
// //   opts.immediate && computed.get();
// //   const w = watchers[opts.flush!];
// //   w.watch(computed);
// //   return () => {
// //     w.unwatch(computed);
// //     typeof cleanup === "function" && cleanup();
// //     cleanup = undefined;
// //   };
// // }

// // export type Sig<T> = Ref<T> | Computed<T>;
// // export function isSig(sig: any): sig is Sig<unknown> {
// //   return isRef(sig) || isComputed(sig);
// // }

// // export type Ref<T> = ReturnType<typeof ref<T>>;
// // export function isRef(ref: any): ref is Ref<unknown> {
// //   return !!ref && signalIsState(ref[symbol]);
// // }

// // export type Computed<T> = ReturnType<typeof computed<T>>;
// // export function isComputed(cpu: any): cpu is Computed<unknown> {
// //   return !!cpu && signalIsComputed(cpu[symbol]);
// // }
