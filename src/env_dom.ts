import type { Env } from './roxy';
import * as r from './roxy';

const SVG_NS = 'http://www.w3.org/2000/svg';
enum NameSpaceUri {
  HTML = 'http://www.w3.org/1999/xhtml',
  SVG = 'http://www.w3.org/2000/svg',
  MATH_ML = 'http://www.w3.org/1998/Math/MathML',
}

type DomNode = Node;
type DomElement = Element;

function setDOMAttribute(node: DomElement, key: string, value: any, namespace: string) {
  if (value === true) {
    node.setAttribute(key, '');
  } else if (value === false) {
    node.removeAttribute(key);
  } else if (namespace) {
    node.setAttributeNS(namespace, key, value);
  } else {
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
  key: makeSpecialAttr('key', () => {}),
  children: makeSpecialAttr('children', () => {}),
  selected: makeSpecialAttr('selected'),
  checked: makeSpecialAttr('checked'),
  value: makeSpecialAttr('value'),
  innerHTML: makeSpecialAttr('innerHTML'),
};

export const ENV_DOM: Env<DomNode, string> = {
  createNode(vnode, parentState) {
    const ns = parentState || '';
    if (r.isEmpty(vnode)) {
      const node = document.createComment('');
      return { node, state: ns };
    }
    if (r.isLeaf(vnode)) {
      const node = document.createTextNode(vnode + '');
      return { node, state: ns };
    }
    if (r.isElement(vnode)) {
      const node = ns ? document.createElementNS(ns, vnode.type) : document.createElement(vnode.type);
      return { node, state: ns || (vnode.type === 'svg' ? NameSpaceUri.SVG : vnode.type === 'math' ? NameSpaceUri.MATH_ML : '') };
    }
    throw new Error('Invalid Params');
  },
  mountAttributesBeforeChildren(node, vnode, isSvg) {
    if (!r.isElement(vnode)) return;
    const ps: any = vnode.props;
    for (const key in ps) {
      if (key in SPECIAL_ATTRS) continue;
      const value = ps[key];
      if (key.startsWith('on')) {
        (node as any)[key.toLowerCase()] = value;
      } else {
        setDOMAttribute(node as any, key, value, isSvg);
      }
    }
  },
  mountAttributesAfterChildren(node, vnode, isSvg) {
    if (!r.isElement(vnode)) return;
    const ps: any = vnode.props;
    for (const key in ps) {
      if (key in SPECIAL_ATTRS) {
        SPECIAL_ATTRS[key].mount(node, ps[key]);
      }
    }
  },
  updateAttributesBeforeChildren(node, newVnode, oldVnode, isSvg) {
    if (r.isLeaf(newVnode)) {
      node.textContent = newVnode + '';
      return;
    }
    if (!r.isElement(newVnode) || !r.isElement(oldVnode)) return;
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
        setDOMAttribute(node as any, key, nv, isSvg);
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
  updateAttributesAfterChildren(node, newVnode, oldVnode, isSvg) {
    if (!r.isElement(newVnode) || !r.isElement(oldVnode)) return;
    const nps: any = newVnode.props;
    const ops: any = oldVnode.props;
    for (const key in nps) {
      if (key in SPECIAL_ATTRS) {
        const nv = nps[key];
        const ov = ops[key];
        // SPECIAL_ATTRS 的判断相同的逻辑放在 它自己 里面，因为可能有的属性，我们希望它不用判断相同，每次 render 都必须刷新，例如 value
        SPECIAL_ATTRS[key].update(node, nv, ov);
      }
    }
    for (const key in ops) {
      if (key in nps) continue;
      if (key in SPECIAL_ATTRS) {
        const nv = nps[key];
        const ov = ops[key];
        SPECIAL_ATTRS[key].update(node, nv, ov);
      }
    }
  },
  unmountAttributesBeforeChildren(node, state) {},
  unmountAttributesAfterChildren(node, state) {},
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
