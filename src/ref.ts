
let REF_LISTENER_CURRENT: VoidFunction;

type Ref<T> = {
  value: T;
  // get(): T;
  // set<S extends T>(nv: S): { pv: T; cv: S };
}
// type Ref<T> = T extends undefined ? {
//   get(): T;
//   set(): { pv: T; nv: undefined }
//   set<S extends T>(nv: S): { pv: T; cv: S }
// } : {
//   get(): T;
//   set<S extends T>(nv: S): { pv: T; cv: S }
// }

function ref<T>(): Ref<T | undefined>
function ref<T>(value: T): Ref<T>
function ref<T>(value?: T) {
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
  // // function set(): { pv: T; nv: undefined }
  // // function set<S extends T>(nv: S): { pv: T; nv: S }
  // function set(nv: any) {
  //   const pv = value;
  //   v = nv;
  //   [...listeners].forEach(tryCatchLog);
  //   return { cv: nv, pv };
  // }
}

// const tryCatchLog = (fn: VoidFunction) => {
//   try {
//     fn();
//   } catch (error) {
//     console.error(error);
//   }
// };


// const a = ref(0);
// a.value = undefined;
// a.get();
// a.set();
// a.set(undefined);
// a.set(24)


// const x = ref<number>();
// x.value = undefined;
// x.get()
// x.set();
// x.set(undefined);
// x.set(23);


import { RoxyComponent, tryCatchLog } from './roxy';

function refComponent<T extends RoxyComponent<any, any>>(type: T) {
  const newType = (initProps: any, ins: any) => {
    const render = type(initProps, ins);
    const newRnder = (props: any) => {
      // const old = REF_LISTENER_CURRENT;
      REF_LISTENER_CURRENT = ins.update;
      return render(props);
    }
    return newRnder;
  };
  return newType as T;
}

type Computed<T> = ReturnType<typeof computed<T>>

function computed<T>(fn: () => T) {
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
export function watch<T>(w: Computed<T>|Ref<T>, fn: (cv: T, pv: T) => any): void;
export function watch<T>(w: Computed<T>|Ref<T>, fn: (cv: T, pv: T) => any, opt: {immediate?:false;flush?: 'pre' | 'post' | 'sync';}): void;
export function watch<T>(w: Computed<T>|Ref<T>, fn: (cv: T, pv: T|undefined) => any, opt: {immediate:true;flush?: 'pre' | 'post' | 'sync';}): void;
export function watch<T>(w: () => T, fn: (cv: T, pv: T|undefined) => any, opt: {immediate:true;flush?: 'pre' | 'post' | 'sync';}): void;
export function watch(w: any, fn: Function, opts: { immediate?: boolean, flush?: 'pre' | 'post' | 'sync'; } = WATCH_OPTS_DEFAULT) {
  // const ref_listener = 
  w = typeof w === 'function' ? computed(w) : w;
}

// export function effect(fn: ()=>any, flush:'pre' | 'post' | 'sync' = 'sync') {
//   const ref_listener = flush === 'sync' ? () => {fn();} : flush === 'pre' ? () => {

//   }
//   REF_LISTENER_CURRENT = ref_lis
// }

watch(computed(() => 123), (cv, pv) => {}, {immediate: false})

// const a = (ip:{}, ins:{}) => {
//   return (p:{}) => ''
// }

// function abc(x: typeof a) {}

// abc(
//   (ip, ins) => {
//     return p => ''
//   }
// )

function defineComponent<P={}, C=any, T = RoxyComponent<P, C>>(type: T) {
  type({}, {} as any);
  return refComponent(type);
}

const com = defineComponent<{}>((ip, ins) => {
  return p => '';
})
