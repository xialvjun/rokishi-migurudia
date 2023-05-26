
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

export const queueMicrotask =
  typeof window?.queueMicrotask !== 'undefined'
    ? window.queueMicrotask
    : typeof Promise !== 'undefined'
      ? (cb: VoidFunction) => Promise.resolve().then(cb)
      : queueMacrotask;

export const tryCatchLog = (fn: Function) => {
  try {
    fn();
  } catch (error) {
    console.error(error);
  }
};
