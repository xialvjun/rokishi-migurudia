import { queueMacrotask, queueMicrotask, tryCatchLog } from './tools';
import type { Component } from './core';


let REF_LISTENER_CURRENT: VoidFunction;

export type Ref<T> = {
  value: T;
  // get(): T;
  // set<S extends T>(nv: S): { pv: T; cv: S }; // set(undefined)
}

export function ref<T>(): Ref<T | undefined>
export function ref<T>(value: T): Ref<T>
export function ref<T>(value?: T) {
  const listeners = new Set<Function>();
  let v = value;
  return {
    get value() {
      REF_LISTENER_CURRENT && listeners.add(REF_LISTENER_CURRENT);
      return v;
    },
    set value(nv) {
      v = nv;
      [...listeners].forEach(tryCatchLog);
    },
    // get,
    // set,
  };
  // function get() {
  //   REF_LISTENER_CURRENT && listeners.add(REF_LISTENER_CURRENT);
  //   return v;
  // }
  // function set(nv: any) {
  //   const pv = value;
  //   v = nv;
  //   [...listeners].forEach(tryCatchLog);
  //   return { cv: nv, pv };
  // }
}


type Computed<T> = ReturnType<typeof computed<T>>

export function computed<T>(fn: () => T) {
  let value: T;
  let dirty = true;
  const ref_listener = () => {
    dirty = true;
  };
  return {
    get value() {
      if (dirty) {
        // const old = REF_LISTENER_CURRENT;
        REF_LISTENER_CURRENT = ref_listener;
        value = fn();
        // REF_LISTENER_CURRENT = old;
        dirty = false;
      }
      return value;
    },
    force() {
      value = fn();
      dirty = false;
      return value;
    },
  }
}


const WATCH_OPTS_DEFAULT = { immediate: false, flush: 'post' } as const;

export function watch<T>(w: Computed<T> | Ref<T>, fn: (cv: T, pv: T) => any): void;
export function watch<T>(w: Computed<T> | Ref<T>, fn: (cv: T, pv: T) => any, opt: { immediate?: false; flush?: 'pre' | 'post' | 'sync'; }): void;
export function watch<T>(w: Computed<T> | Ref<T>, fn: (cv: T, pv: T | undefined) => any, opt: { immediate: true; flush?: 'pre' | 'post' | 'sync'; }): void;
export function watch<T>(w: () => T, fn: (cv: T, pv: T | undefined) => any, opt: { immediate: true; flush?: 'pre' | 'post' | 'sync'; }): void;
export function watch(w: any, fn: Function, opts: { immediate?: boolean, flush?: 'pre' | 'post' | 'sync'; } = WATCH_OPTS_DEFAULT) {
  const ref_listener_do = () => {
    const pv = cv;
    cv = w.value;
    fn(cv, pv);
  };
  let ref_listener = ref_listener_do;
  if (opts.flush === 'pre') {
    ref_listener = () => {
      queueMicrotask(ref_listener_do);
    };
  }
  if (opts.flush === 'post') {
    ref_listener = () => {
      queueMacrotask(ref_listener_do);
    };
  }
  w = typeof w === 'function' ? computed(w) : w;
  REF_LISTENER_CURRENT = ref_listener;
  let cv = w.value;
  if (opts.immediate) {
    fn(cv, undefined);
  }
}


export function defineComponent<P = any, C = any>(type: Component<P, C>) {
  const newType = (initProps: any, ins: any) => {
    const render = type(initProps, ins);
    const newRnder = (props: any) => {
      // const old = REF_LISTENER_CURRENT;
      REF_LISTENER_CURRENT = ins.update;
      return render(props);
    }
    return newRnder;
  };
  return newType as typeof type;
}
