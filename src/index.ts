import * as core from './core';
import { env as env_dom } from './envs/dom';

export { core };
export * from './h';

const createMagaleta = core.createMagaleta;
export function renderDom(vnode: core.Vnode, node: Node) {
  const env = createMagaleta(env_dom);
  env.mount(node, null, null, vnode, null);
}

export const render = renderDom;
