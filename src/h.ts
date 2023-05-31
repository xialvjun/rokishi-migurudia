const EMPTY_OBJECT = {};

export function h(type: any, props: any, ...children: any[]) {
  props = props ?? EMPTY_OBJECT;

  // jsx/jsxDEV 处理 children 都是 children.length===1 时特殊处理，无法变更
  // 为了让 h 的效果与 jsx 相同，也单独处理下它
  props =
    children.length > 1
      ? Object.assign({}, props, { children })
      : children.length === 1
      ? Object.assign({}, props, { children: children[0] })
      : props;

  return jsx(type, props, props.key);
}

export function jsx(type: any, props: any, key: any) {
  if (key !== key) throw new Error('Invalid NaN key');
  return {
    type,
    key,
    props,
  };
}

export const jsxs = jsx;

export const jsxDEV = jsx;

export function Fragment(init: { children: any }) {
  return (props: any) => props.children;
}
