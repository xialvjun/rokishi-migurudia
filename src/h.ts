const EMPTY_OBJECT = {};

export function h(type: any, props: any, ...children: any[]) {
  props = props ?? EMPTY_OBJECT;

  // props = children.length ? Object.assign({}, props, { children }) : props;
  // // const { key, ..._props } = props || EMPTY_OBJECT;
  // // props = {..._props, children: children.length ? children : undefined };
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

export function Fragment(init_props: { children: any }) {
  return (props: any) => props.children;
}
