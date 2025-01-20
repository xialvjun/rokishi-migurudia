import * as core from './core';
import { env as env_dom } from './envs/dom';

export { core };
export * from './h';

const createMagaleta = core.createMagaleta;
function renderDom(vnode: core.Vnode, node: globalThis.Node) {
  const env = createMagaleta(env_dom);
  env.mount(node, null, env_dom.initState(), vnode, null);
}

export const render = renderDom;
export * from './ref';
export { useMemo } from './tools';
