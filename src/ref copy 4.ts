import { queueMacrotask, queueMicrotask, tryCatchLog } from './tools';

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

// 性能和对象美观
// 性能方面，希望尽可能少的创建对象和必报函数，对象美观方面，希望对象在浏览器里 log 出来的时候仅暴露该暴露的东西
// 然后在代码逻辑里 State.version/effects + Computed.state_version_map 都有被访问的需求
// 还有 Effect.states/run/revoke 也是，其中 Effect.revoke 是被真正外部访问
// 于是考虑 私有属性/本模块公有属性/全公开属性 的写法
// 私有属性 的实现方式是 WeakMap(用于字段)/WeakSet(用于方法)
// 本模块公有属性 的实现方式是
//    Symbol(浏览器能 log 出来，间接变全公开，如果只一个属性还好，如果是多个属性，就很难看，需要组合为对象，浪费性能)
//    WeakMap/WeakSet(其实就是私有属性的实现方式，无非是手动实现还是ts编译器实现的区别)
// 还了解到
// 私有属性比公开属性耗内存
// 合并类(把 State/Computed/Effect)合并为一个类，从而访问私有属性比分开类耗内存
// symbol 跟私有属性/weakmap耗内存差不多
// 所以采用 分开类 + 全私有属性 + 部分属性提供 WeakMap 的模块公开的 getter/setter 方法
// 用 getter/setter 而不是直接把需要的属性变成模块公开，是因为 WeakMap 实现的模块公开属性写法难看

const FLUSHS = {
  pre: queueMicrotask,
  post: queueMacrotask,
  sync: (fn: () => any) => fn(),
};
type EffectFlush = keyof typeof FLUSHS | ((fn: () => any) => any);

const wm_get_version = new WeakMap<object, () => number>();
const wm_get_effects = new WeakMap<object, () => Set<Effect>>();
const wm_get_state_version_map = new WeakMap<object, () => Map<State, number>>();

function link_state_effect(state: State, effect: Effect) {
  wm_get_effects.get(state)!().add(effect);
  effect.states.add(state);
}

class State<T = any> {
  #state: T;
  #version = 0;
  #effects = new Set<Effect>();
  constructor(s: T) {
    this.#state = s;
    wm_get_version.set(this, () => this.#version);
    wm_get_effects.set(this, () => this.#effects);
  }
  get value() {
    CURRENT_COMPUTED && wm_get_state_version_map.get(CURRENT_COMPUTED)!().set(this, this.#version);
    CURRENT_EFFECT && link_state_effect(this, CURRENT_EFFECT);
    return this.#state;
  }
  set value(s: T) {
    if (this.#state !== s) {
      this.#state = s;
      this.#version++;
      // TODO effect 里直接 state 的变化，那就直接运行，但间接 state 的变化，那就要看 computed 的 version
      // 所以 effect 里还要区分直接 state 和 间接 state
      this.#effects.forEach(it => it.run());
    }
  }
}

let CURRENT_COMPUTED: Computed = null!;

class Computed<T = any> {
  #fn: () => T;
  #cache: T = undefined!;
  #version = 0;
  #state_version_map = new Map<State, number>();
  #computed_version_map = new Map<Computed, number>();
  #is_sure_dirty = true;
  constructor(fn: () => T) {
    this.#fn = fn;
    wm_get_state_version_map.set(this, () => this.#state_version_map);
  }
  #is_dirty() {
    // 在 is_dirty 只是私有属性的情况下，理论上 is_sure_dirty 是没必要的，因为 is_dirty 只在 get value 时调用，之后必然会更新值。。。好像稍微有一点点性能帮助吧
    if (this.#is_sure_dirty) {
      return true;
    }
    for (const [state, version] of this.#state_version_map) {
      if (wm_get_version.get(state)!() !== version) {
        this.#is_sure_dirty = true;
        return true;
      }
    }
    for (const [computed, version] of this.#computed_version_map) {
      if (computed.#is_dirty() || computed.#version !== version) {
        this.#is_sure_dirty = true;
        return true;
      }
    }
    this.#is_sure_dirty = false;
    return false;
  }
  #track() {
    // track 做 effect 读取时，把 state 以及自己依赖的 computed 的 state 都加到 effect 上
    if (CURRENT_COMPUTED) {
      // link_computed_computed
      CURRENT_COMPUTED.#computed_version_map.set(this, this.#version);
      // 不用下面的设置 state version 避免代码结构上没有避免版本冲突，虽然代码逻辑上不会
      // 而是 下面 CURRENT_EFFECT && this.computeds.forEach(it => it.track());
      // for (const [state, version] of this.states) {
      //   CURRENT_COMPUTED.states.set(state, version);
      // }
    }
    this.#track_eff();
    return this.#cache;
  }
  #track_eff() {
    if (CURRENT_EFFECT) {
      for (const [state] of this.#state_version_map) {
        link_state_effect(state, CURRENT_EFFECT);
      }
      this.#computed_version_map.forEach((v, it) => it.#track_eff());
    }
  }
  get value() {
    if (!this.#is_dirty()) {
      return this.#track();
    }
    const old = CURRENT_COMPUTED;
    CURRENT_COMPUTED = this;
    const old_states = this.#state_version_map;
    this.#state_version_map = new Map();
    const old_computeds = this.#computed_version_map;
    this.#computed_version_map = new Map();
    try {
      const cache = this.#fn();
      if (this.#cache !== cache) {
        this.#cache = cache;
        this.#version++;
        this.#is_sure_dirty = false;
      }
    } catch (error) {
      this.#state_version_map = old_states;
      this.#computed_version_map = old_computeds;
      // 这里 throw 掉，可以保证 this.track() 时一定 !isDirty()
      throw error;
    }
    CURRENT_COMPUTED = old;
    return this.#track();
  }
}

let CURRENT_EFFECT: Effect = null!;

class Effect {
  flush: (fn: () => any) => any;
  computed: Computed;
  cleanup: Function | null = null;
  constructor(fn: () => unknown | (() => unknown), flush: EffectFlush) {
    this.flush = typeof flush === 'function' ? flush : FLUSHS[flush];
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
    this.computed.value;
  }
  run() {
    this.flush(() => this.computed.value);
  }
  // todo: 这个 states 可以不要，可以直接计算出来，就是 this.computed.states + this.computed.computeds(递归).states ...不过放一个也没问题，甚至更保险
  states = new Set<State>();
  // memory_states = new Set<State>();
  // computeds = new Map<Computed, number>();
  revoke = () => {
    this.cleanup?.();
    this.states.forEach(state => wm_get_effects.get(state)!().delete(this));
    this.states.clear();
  };
}

export function ref<T>(s: T) {
  return new State(s);
}

export function computed<T>(fn: () => T) {
  return new Computed(fn);
}

export function effect(fn: () => unknown | (() => unknown), flush: EffectFlush = 'pre') {
  const eff = new Effect(fn, flush);
  return eff.revoke;
}

export function isSignal(s: unknown): s is State | Computed {
  return s instanceof State || s instanceof Computed;
}

type Signal<T> = State<T> | Computed<T>;

type WatchSignal<T> = Signal<T> | (() => T);
type WatchFn<T, Imm extends boolean> = (cv: T, pv: Imm extends true ? T | undefined : T, inv: (fn: () => any) => void) => () => void;

const WATCH_OPTS_DEFAULT = { immediate: false, flush: 'pre' } as const;

export function watch<T>(w: WatchSignal<T>, fn: WatchFn<T, false>): () => any;
export function watch<T>(w: WatchSignal<T>, fn: WatchFn<T, false>, opt: { immediate?: false; flush?: EffectFlush }): () => any;
export function watch<T>(w: WatchSignal<T>, fn: WatchFn<T, true>, opt: { immediate: true; flush?: EffectFlush }): () => any;
export function watch<T>(w: WatchSignal<T>, fn: WatchFn<T, true>, opt: { immediate: true; flush?: EffectFlush }): () => any;
export function watch(w: any, fn: any, opts?: { immediate?: boolean; flush?: EffectFlush }) {
  let { immediate, flush } = { ...WATCH_OPTS_DEFAULT, ...opts };
  w = typeof w === 'function' ? computed(w) : w;
  let pv: any = undefined;
  let invs: any[] = [];
  return effect(() => {
    invs = [];
    const nv = w.value;
    if (immediate) {
      fn(nv, pv, (fn: any) => invs.push(fn));
    }
    immediate = true;
    pv = nv;
    return () => invs.forEach(fn => fn());
  }, flush);
}
