export const queueMacrotask =
  typeof MessageChannel !== 'undefined'
    ? (cb: VoidFunction) => {
        const { port1, port2 } = new MessageChannel();
        port1.onmessage = cb;
        port2.postMessage(null);
      }
    : (cb: VoidFunction) => {
        setTimeout(cb);
      };

const gt = globalThis || window;
export const queueMicrotask =
  typeof gt?.queueMicrotask !== 'undefined'
    ? gt.queueMicrotask
    : typeof Promise !== 'undefined'
    ? (cb: VoidFunction) => Promise.resolve().then(cb)
    : () => {
        throw new Error('queueMicrotask is not supported');
      };

// export const tryCatchLog = (fn: Function, msg='') => {
//   try {
//     return [null, fn()];
//   } catch (error) {
//     console.error(msg, error);
//     return [error, undefined];
//   }
// };
export const tryCatchLog = <T>(fn: () => T): [T | undefined, unknown, boolean] => {
  try {
    // 避免就是有 throw null 的，所以需要第三个值表示是否真的有 error
    return [fn(), null, false];
  } catch (error) {
    console.error(error);
    return [undefined, error, true];
  }
};

const isShallowEqual = (a: any, b: any) => {
  if (a === b) {
    // primitive types: undefined/null/boolean/number/string/function
    return true;
  }
  const a_type = typeof a;
  const b_type = typeof b;
  if (a_type !== b_type || a_type !== 'object') {
    return false;
  }
  const a_keys = Object.keys(a);
  const b_keys = Object.keys(b);
  if (a_keys.length !== b_keys.length) {
    return false;
  }
  return a_keys.every(k => a[k] === b[k]);
};

export const useMemo = () => {
  const map: Record<string, { value: any; deps: any }> = {};
  function memo<T>(name: string, value: T, deps?: any): T {
    if (name in map && isShallowEqual(map[name].deps, deps)) {
      return map[name].value;
    }
    map[name] = { value, deps };
    return value;
  }
  function render<T extends (...args: any[]) => any>(rend: T, depsFn?: (props: Parameters<T>[0]) => any): T {
    let cache: any = null;
    return ((props: any) => {
      const deps = depsFn ? depsFn(props) : props;
      if (!isShallowEqual(cache?.deps, deps)) {
        cache = { deps, vnode: rend(props) };
      }
      return cache.vnode;
    }) as T;
  }
  memo.render = render;
  return memo;
};

// TODO: Portal: 因为定位基于其他的 ref，所以 Portal 必须要在原位留个 empty_dom。干脆 Portal 直接新的 mount 好了，反正 ctx 可以传递
// Portal 不能是新的 render，不然可能不匹配
