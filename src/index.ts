// export { h } from './h';
// import { createRoxy } from './roxy';
import { ENV_DOM } from './env_dom';

// import type { Vnode } from './roxy';
// export type { Vnode, RoxyComponent } from './roxy';
import * as h from './h';
import * as roxy from './roxy';

export { h, roxy };

const createRoxy = roxy.createRoxy;
export function renderDom(vnode: roxy.Vnode, node: Node) {
  const env = createRoxy(ENV_DOM);
  env.mount(node, null, null, vnode, null);
}

export const render = renderDom;
