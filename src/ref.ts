import { Signal } from "signal-polyfill";
const {
  State,
  Computed,
  isState: signalIsState,
  isComputed: signalIsComputed,
  subtle: { Watcher },
} = Signal;

import { queueMacrotask, queueMicrotask } from "./tools";
import type { Component } from './core';

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

const do_tasks = {
  pre: queueMicrotask,
  post: queueMacrotask,
  sync: (fn: () => void) => fn(),
};
const watchers = {
  pre: create_watcher("pre"),
  post: create_watcher("post"),
  sync: create_watcher("sync"),
};
function create_watcher(flush: "pre" | "post" | "sync") {
  let needsEnqueue = true;
  const do_task = do_tasks[flush];
  const w = new Watcher(() => {
    if (needsEnqueue) {
      needsEnqueue = false;
      do_task(processPending);
    }
  });
  return w;
  function processPending() {
    needsEnqueue = true;
    for (const s of w.getPending()) {
      s.get();
    }
    w.watch();
  }
}

const EFFECT_OPTS_DEFAULT = { immediate: false, flush: "pre" } as const;
export function effect(
  fn: () => unknown | (() => unknown),
  opts?: { immediate?: boolean; flush?: "pre" | "post" | "sync" }
) {
  opts = { ...EFFECT_OPTS_DEFAULT, ...opts };
  let cleanup: unknown | (() => unknown);
  const computed = new Signal.Computed(() => {
    typeof cleanup === "function" && cleanup();
    cleanup = fn();
  });
  opts.immediate && computed.get();
  const w = watchers[opts.flush!];
  w.watch(computed);
  return () => {
    w.unwatch(computed);
    typeof cleanup === "function" && cleanup();
    cleanup = undefined;
  };
}

const WATCH_OPTS_DEFAULT = { immediate: false, flush: 'pre' } as const;

export function watch<T>(w: Computed<T> | Ref<T>, fn: (cv: T, pv: T) => any): void;
export function watch<T>(w: Computed<T> | Ref<T>, fn: (cv: T, pv: T) => any, opt: { immediate?: false; flush?: 'pre' | 'post' | 'sync'; }): void;
export function watch<T>(w: Computed<T> | Ref<T>, fn: (cv: T, pv: T | undefined) => any, opt: { immediate: true; flush?: 'pre' | 'post' | 'sync'; }): void;
export function watch<T>(w: () => T, fn: (cv: T, pv: T | undefined) => any, opt: { immediate: true; flush?: 'pre' | 'post' | 'sync'; }): void;
export function watch(w: any, fn: Function, opts?: { immediate?: boolean, flush?: 'pre' | 'post' | 'sync'; }) {
  opts = { ...WATCH_OPTS_DEFAULT, ...opts };
  w = typeof w === 'function' ? computed(w) : w;
  let pv: any = undefined;
  effect(() => {
    const nv = w.value;
    fn(nv, pv);
    pv = nv;
  }, opts);
}

export type Sig<T> = Ref<T> | Computed<T>;
export function isSig(sig: any): sig is Sig<unknown> {
  return isRef(sig) || isComputed(sig);
}

export type Ref<T> = ReturnType<typeof ref<T>>;
export function isRef(ref: any): ref is Ref<unknown> {
  return !!ref && signalIsState(ref[symbol]);
}

export type Computed<T> = ReturnType<typeof computed<T>>;
export function isComputed(cpu: any): cpu is Computed<unknown> {
  return !!cpu && signalIsComputed(cpu[symbol]);
}

// TODO 这种会内存泄漏，组件 unmount 没通知去掉 ref_listener
export function defineComponent<P extends {} = any, C extends {} = any>(type: Component<P, C>) {
  const newType = (initProps: any, ins: any) => {
    const render = type(initProps, ins);
    const vnode = computed(() => render(ins.props));
    ins.on('unmount', effect(() => {
      vnode.value;
      ins.update();
    }));
    return () => vnode.value;
    // return render;
  };
  return newType as typeof type;
}

export const Setup = defineComponent<{key:PropertyKey, children: Component<{},any>}>((init, ins) => {
  return init.children({}, ins);
})
