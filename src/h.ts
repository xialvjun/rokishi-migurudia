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


// export function Portal(init: { parentNode: string |  })

const handler = {
  get(t: any, type: string, _r: any) {
    if (!t[type]) {
      t[type] = (props: any, key: any) => {
        return { type, props, key };
      };
    }
    return t[type];
  },
};
const html = new Proxy({}, handler);
const svg = new Proxy({}, handler);
const mathml = new Proxy({}, handler);
// todo: 那 proxy.svg() 而不是 proxy.svg.svg() 这要怎么写
export const proxy = new Proxy({ svg, mathml } as any, {
  get(t, type, r) {
    return t[type] || html[type];
  },
  // apply: `const h = dom; h(MyCom)`
  apply(t, self, args) {
    const [type, props, key] = args;
    return { type, props, key };
  },
});

// h.svg = new Proxy
// const H = new Proxy()


// // 这样想把参数里的 context 类型与返回的 extends 类型合并
// // 它其实还不是完整的 context，因为参数 context 只声明了组件自己需要的，没声明子组件需要的，事实上子组件需要的也要在父组件上声明。。。

// function abc(p: { a: number, c: Readonly<{m:string}> }) {
//   p.c.m;
//   const ext = { m: 123 };
//   const context=2;
//   return {
//     extends: ext,
//     render() {},
//   };
// }
// const c = {m:'123',jk:89};
// abc({a: 123, c});

// type Vdom<T> = T;
// // 但是 context 可以用泛型... 这样，父组件只用写自己的需要的 context 就好了
// // 子组件需要的 context 是由 props.children 或者别的 slot，以及组件自己渲染的内容决定的
// // children 和 slot 也是泛型
// // ... 不，children 可以要比自己接受的 context 和返回的 context 的并集更多的 context
// // 因为可以自己内部有其他元素包裹在 children 外，即 render = () => <XxxProvider>{children}</XxxProvider>... 
// // 所以 children 要求的 ctx 信息完全不能用父组件类型声明来约束。。。他是靠代码逻辑的，该错就是会错
// // 。。。。不不不，还是有类型约束的，只是非常复杂...render 函数的类型包括了整个 render 函数本身，就是说包括了整个 vdom 的复杂结构，children 是受复杂结构控制的
// // 所以只能是 function Abc<Ctx<Abc> extends children_ctx>(children: Vdom<children_ctx>) 返回值类型就自动推导
// // 。。。。不过限制 ctx 类型完全没有意义，因为 ctx 传参是在框架内进行的，错也是框架那一步错，而框架又会对类型做擦除
// // 所以参数 ctx:unknown，返回值 ctx 就推导。。。至于为什么不 provide/inject，因为感觉 provide 的 ctx 更应该作为返回值来统一表明，而不是 provide 就不管了。。。？是的吗？
// // 好像可以 provide 了就不管。。那就好像只能 any... 或者 Record<PropertyKey, any>
// function xyz<old_ctx extends {m:string},new_ctx extends object>(p: { a: number, ctx: old_ctx, children: Vdom<Partial<old_ctx & new_ctx>> }): {context:new_ctx,render:()=>Vdom<any>} {
//   return {context:{},render() {
    
//   },}
// }

// // 相比起来，用 provide/inject 就有可能编译通过但运行出错了