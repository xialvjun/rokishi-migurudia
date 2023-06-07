import type { Env } from '../core';
import { isEmpty, isLeaf, isElement } from '../core';

type DomNode = Node;
type DomElement = Element;

export type N = DomNode;
export type S = string;

function classX(value: any) {
  const list: string[] = [];
  recursive(value);
  return list.join(' ');
  function recursive(v: any) {
    if (!v) return;
    if (typeof v === 'string') {
      return list.push(v);
    }
    if (Array.isArray(v)) {
      return v.forEach(recursive);
    }
    for (const k in v) {
      v[k] && list.push(k);
    }
  }
}

function styleX(value: any) {
  const list: string[] = [];
  recursive(value);
  return list.join(';');
  function recursive(v: any) {
    if (!v) return;
    if (typeof v === 'string') {
      return list.push(v);
    }
    if (Array.isArray(v)) {
      return v.forEach(recursive);
    }
    for (const k in v) {
      const n = k
        .split(/(?=[A-Z])/)
        .join('-')
        .toLowerCase();
      list.push(n + ':' + v[k]);
    }
  }
}

function setDOMAttribute(node: DomElement, key: string, value: any, namespace: string) {
  if (value === true) {
    node.setAttribute(key, '');
  } else if (value === false) {
    node.removeAttribute(key);
  } else if (namespace) {
    node.setAttributeNS(namespace, key, value);
  } else {
    if (key === 'className') {
      key = 'class';
    }
    value = key === 'class' ? classX(value) : key === 'style' ? styleX(value) : value;
    node.setAttribute(key, value);
  }
}

function makeSpecialAttr(key: string, fn = (n: any, k: any, v: any) => (n[k] = v)) {
  return {
    mount(node: any, value: any) {
      fn(node, key, value);
    },
    update(node: any, newValue: any, oldValue: any) {
      fn(node, key, newValue);
    },
    unmount(node: any, value: any) {
      fn(node, key, null);
    },
  };
}

const SPECIAL_ATTRS: Record<PropertyKey, ReturnType<typeof makeSpecialAttr>> = {
  ref: {
    mount(node: any, value: any) {
      if (typeof value === 'object') {
        value.value = node;
      } else if (typeof value === 'function') {
        value(node);
      }
    },
    update(node: any, newValue: any, oldValue: any) {
      if (newValue === oldValue) return;
      SPECIAL_ATTRS.ref.unmount(node, oldValue);
      SPECIAL_ATTRS.ref.mount(node, newValue);
    },
    unmount(node: any, value: any) {
      if (typeof value === 'object') {
        value.value = null;
      } else if (typeof value === 'function') {
        value(null);
      }
    },
  },
  key: makeSpecialAttr('key', () => { }),
  children: makeSpecialAttr('children', () => { }),
  selected: makeSpecialAttr('selected'),
  checked: makeSpecialAttr('checked'),
  value: makeSpecialAttr('value'),
  innerHTML: makeSpecialAttr('innerHTML'),
};

const xmlns: any = {
  html: 'http://www.w3.org/1999/xhtml',
  svg: 'http://www.w3.org/2000/svg',
  mathml: 'http://www.w3.org/1998/Math/MathML',
};

export const env: Env<N, S> = {
  createNode(vnode, parentState) {
    const ns = parentState || '';
    if (isEmpty(vnode)) {
      const node = document.createComment('');
      return { node, state: ns };
    }
    if (isLeaf(vnode)) {
      const node = document.createTextNode(vnode + '');
      return { node, state: ns };
    }
    if (isElement(vnode)) {
      const new_ns = (vnode.props as any).xmlns || xmlns[vnode.type] || ns;
      const node = new_ns ? document.createElementNS(ns, vnode.type) : document.createElement(vnode.type);
      return { node, state: new_ns };
    }
    throw new Error('Invalid Params');
  },
  mountAttributesBeforeChildren(node, vnode, ns) {
    if (!isElement(vnode)) return;
    const ps: any = vnode.props;
    for (const key in ps) {
      if (key in SPECIAL_ATTRS) continue;
      const value = ps[key];
      // 1. namespace JSX 直接按 lib.dom.d.ts 生成，去除所有的 readonly 属性和非 on 开头的函数属性，即是 jsx 属性，而且通过 node[key]= 改变的属性也会显示在开发者工具上
      //    于是直接用 node[key]= 替代 setAttribute 似乎不错。但是有些属性又会有问题，例如 svg.viewBox 是只读，真去 node.viewBox='xxx' 是无效的
      //    但是 node.setAttribute('viewBox','xxx') 却又是有效的。另外，如果选择 setAttribute 而不是 node[key]= ，那 key 的名字又不完全跟 lib.dom 相同
      //    似乎最划算的做法是 JSX 基于 lib.dom 生成，并增加特殊属性，运行时使用 node[key]= 并根据特殊属性 setAttribute 。也许太麻烦，还不如照抄 react/types
      // 2. 重复 setAttribute 或 node[key]= 效率都远不如 js 内部判断相等，所以干脆所有属性都加判断相等
      if (key.startsWith('on')) {
        (node as any)[key.toLowerCase()] = value;
      } else {
        setDOMAttribute(node as any, key, value, ns);
      }
    }
  },
  mountAttributesAfterChildren(node, vnode, ns) {
    if (!isElement(vnode)) return;
    const ps: any = vnode.props;
    for (const key in ps) {
      if (key in SPECIAL_ATTRS) {
        SPECIAL_ATTRS[key].mount(node, ps[key]);
      }
    }
  },
  updateAttributesBeforeChildren(node, newVnode, oldVnode, ns) {
    if (isLeaf(newVnode)) {
      node.textContent = newVnode + '';
      return;
    }
    if (!isElement(newVnode) || !isElement(oldVnode)) return;
    const nps: any = newVnode.props;
    const ops: any = oldVnode.props;
    for (const key in nps) {
      if (key in SPECIAL_ATTRS) continue;
      const nv = nps[key];
      const ov = ops[key];
      if (nv === ov) continue;
      if (key.startsWith('on')) {
        (node as any)[key.toLowerCase()] = nv;
      } else {
        setDOMAttribute(node as any, key, nv, ns);
      }
    }
    for (const key in ops) {
      if (key in SPECIAL_ATTRS || key in nps) continue;
      if (key.startsWith('on')) {
        (node as any)[key.toLowerCase()] = null;
      } else {
        (node as any).removeAttribute(key);
      }
    }
  },
  updateAttributesAfterChildren(node, newVnode, oldVnode, ns) {
    if (!isElement(newVnode) || !isElement(oldVnode)) return;
    const nps: any = newVnode.props;
    const ops: any = oldVnode.props;
    for (const key in nps) {
      if (key in SPECIAL_ATTRS) {
        const nv = nps[key];
        const ov = ops[key];
        if (nv === ov) continue;
        // SPECIAL_ATTRS 的判断相同的逻辑放在 它自己 里面，因为可能有的属性，我们希望它不用判断相同，每次 render 都必须刷新，例如 value
        SPECIAL_ATTRS[key].update(node, nv, ov);
      }
    }
    for (const key in ops) {
      if (key in nps) continue;
      if (key in SPECIAL_ATTRS) {
        const nv = nps[key];
        const ov = ops[key];
        if (nv === ov) continue;
        SPECIAL_ATTRS[key].update(node, nv, ov);
      }
    }
  },
  unmountAttributesBeforeChildren(node, vnode, ns) {
    const ref = (vnode as any)?.props?.ref;
    ref && SPECIAL_ATTRS.ref.unmount(node, ref);
  },
  unmountAttributesAfterChildren(node, vnode, ns) { },
  insertBefore(parentNode, newNode, referenceNode) {
    parentNode.insertBefore(newNode, referenceNode);
  },
  removeChild(parentNode, child) {
    parentNode.removeChild(child);
  },
  parentNode(node) {
    return node.parentNode;
  },
  nextSibling(node) {
    return node.nextSibling;
  },
};
