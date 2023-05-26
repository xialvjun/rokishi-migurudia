export { h } from './h';
import { createEnv } from './roxy';
import { ENV_DOM } from './env_dom';

import type { Vnode } from './roxy';
export type { Vnode, RoxyComponent } from './roxy';

export function renderDom(vnode: Vnode, node: Node) {
  const env = createEnv(ENV_DOM);
  env.mount(node, null, null, vnode, null);
}

export const render = renderDom;
