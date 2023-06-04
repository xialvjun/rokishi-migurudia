import { queueMacrotask, queueMicrotask, tryCatchLog } from './tools';

type EmptyVnode = false | null | undefined | [];
type LeafVnode = string | number;
type ElementVnode = { type: string; props: { children?: Vnode }; key?: any };
type EnvVnode = EmptyVnode | LeafVnode | ElementVnode;
type NonEmptyArrayVnode = [Vnode, ...Vnode[]];
type ComponentVnode = { type: (...args: any[]) => (...args: any[]) => Vnode; props: {}; key?: any };
export type Vnode = EnvVnode | NonEmptyArrayVnode | ComponentVnode;

export const isEmpty = (c: any): c is EmptyVnode => c === false || c === null || c === undefined || (Array.isArray(c) && c.length === 0);
export const isLeaf = (c: any): c is LeafVnode => typeof c === 'string' || typeof c === 'number';
export const isElement = (c: any): c is ElementVnode => typeof c?.type === 'string';
export const isNonEmptyArray = (c: any): c is NonEmptyArrayVnode => Array.isArray(c) && c.length > 0;
export const isComponent = (c: any): c is ComponentVnode => typeof c?.type === 'function';


const symbol = Symbol('magaleta');

type EventMap = {
  mount: never;
  mounted: never;
  update: never;
  updated: never;
  unmount: never;
  unmounted: never;
  // error: Error;
};

function createInstance<P extends {} = {}, C extends {} = {}>(init: P, ctx: C | null, doUpdate: () => void) {
  const hooks: Record<keyof EventMap, Set<Function>> = {} as any;
  const on = <K extends keyof EventMap>(type: K, fn: (event: EventMap[K]) => any) => {
    hooks[type] ??= new Set();
    hooks[type].add(fn);
    return () => hooks[type].delete(fn);
  };

  let dirty = false;
  const update = (fn?: () => any) => {
    dirty = true;
    fn && queueMicrotask(fn);
    queueMacrotask(() => {
      dirty && doUpdate();
      dirty = false;
    });
  };

  return {
    props: init,
    ctx: Object.create(ctx) as C & Record<PropertyKey, any>,
    on,
    update,
    [symbol]: hooks,
  };
}


export type Env<N = any, S = any> = {
  createNode(vnode: EnvVnode, parentState: S | null): { node: N; state: S };
  mountAttributesBeforeChildren(node: N, vnode: EnvVnode, state: S): void;
  mountAttributesAfterChildren(node: N, vnode: EnvVnode, state: S): void;
  updateAttributesBeforeChildren(node: N, newVnode: EnvVnode, oldVnode: EnvVnode, state: S): void;
  updateAttributesAfterChildren(node: N, newVnode: EnvVnode, oldVnode: EnvVnode, state: S): void;
  unmountAttributesBeforeChildren(node: N, vnode: EnvVnode, state: S): void;
  unmountAttributesAfterChildren(node: N, vnode: EnvVnode, state: S): void;
  //
  insertBefore(parentNode: N, newNode: N, referenceNode: N | null): void;
  removeChild(parentNode: N, child: N): void;
  parentNode(node: N): N | null;
  nextSibling(node: N): N | null;
};

const enum RefType {
  ITEM,
  LIST,
  MAGALETA,
}
type ItemRef<N, S> = {
  type: RefType.ITEM;
  vnode: EnvVnode;
  node: N;
  childrenRef: Ref<N, S> | null;
  // state is just env node's state, rather than ItemRef/ListRef/MagaletaRef's state.
  // The ItemRef/ListRef/MagaletaRef's state is just their fields like childrenRef/renderedRef
  state: S;
};
type ListRef<N, S> = {
  type: RefType.LIST;
  vnode: NonEmptyArrayVnode;
  refList: [Ref<N, S>, ...Ref<N, S>[]];
};
type MagaletaRef<N, S> = {
  type: RefType.MAGALETA;
  vnode: ComponentVnode;
  instance: ReturnType<typeof createInstance>;
  render: (props: any) => Vnode;
  renderedRef: Ref<N, S>;
};
type Ref<N = any, S = any> = ItemRef<N, S> | ListRef<N, S> | MagaletaRef<N, S>;

// Magaleta is the adoptive older sister of Senia.
export function createMagaleta<N, S>(env: Env<N, S>) {
  return { mount, update, unmount };
  function mount(parentNode: N, referenceNode: N | null, parentState: S | null, vnode: Vnode, ctx: any): Ref<N, S> {
    if (isEmpty(vnode) || isLeaf(vnode)) {
      const { node, state } = env.createNode(vnode, parentState);
      env.insertBefore(parentNode, node, referenceNode);
      return { type: RefType.ITEM, vnode, node, childrenRef: null, state };
    }
    if (isElement(vnode)) {
      const { node, state } = env.createNode(vnode, parentState);
      env.insertBefore(parentNode, node, referenceNode);
      env.mountAttributesBeforeChildren(node, vnode, state);
      // props.ref 由 env 去管（可以在 env.createNode 时 mutate vnode.props.ref，也可以在 mountAttributesAfterChildren 去做，后者更好）
      // 这样，ref 就不是什么特殊属性了。对于组件而言，ref 只是个普通的可以传递的属性，对于标签元素而言，ref 也只是 env 需要处理的一个 attribute
      const childrenVnode = vnode.props.children;
      const childrenRef = childrenVnode == null ? null : mount(node, null, state, childrenVnode, ctx);
      env.mountAttributesAfterChildren(node, vnode, state);
      return { type: RefType.ITEM, vnode, node, childrenRef, state };
    }
    if (isNonEmptyArray(vnode)) {
      return {
        type: RefType.LIST,
        vnode,
        refList: vnode.map(childVnode => mount(parentNode, referenceNode, parentState, childVnode, ctx)) as [any, ...any[]],
      };
    }
    if (isComponent(vnode)) {
      const { type, props } = vnode;
      const instance = createInstance(props, ctx, () => {
        const vnode = render(instance.props);
        instance[symbol].update?.forEach(tryCatchLog);
        ref.renderedRef = update(ref.renderedRef, parentState, vnode, instance.ctx);
        instance[symbol].updated?.forEach(tryCatchLog);
      });
      const render = type(props, instance);
      const renderedVnode = render(props);
      instance[symbol].mount?.forEach(tryCatchLog);
      const renderedRef = mount(parentNode, referenceNode, parentState, renderedVnode, instance.ctx);
      instance[symbol].mounted?.forEach(tryCatchLog);
      const ref = {
        type: RefType.MAGALETA as const,
        vnode,
        instance,
        render,
        renderedRef,
      };
      return ref;
    }
    throw new Error('mount: Invalid Vnode!');
  }

  function update(ref: Ref<N, S>, parentState: S | null, vnode: Vnode, ctx: any): Ref<N, S> {
    if (ref.vnode === vnode) {
      return ref;
    }
    if (isEmpty(vnode) && isEmpty(ref.vnode)) {
      ref.vnode = vnode;
      return ref;
    }
    if (isLeaf(vnode) && isLeaf(ref.vnode)) {
      const ri = ref as ItemRef<N, S>;
      env.updateAttributesBeforeChildren(ri.node, vnode, ri.vnode, ri.state);
      env.updateAttributesAfterChildren(ri.node, vnode, ri.vnode, ri.state);
      ri.vnode = vnode;
      return ri;
    }
    if (isElement(vnode) && isElement(ref.vnode) && vnode.type === ref.vnode.type) {
      const ri = ref as ItemRef<N, S>;
      env.updateAttributesBeforeChildren(ri.node, vnode, ri.vnode, ri.state);
      let oldChildren = ref.vnode.props.children;
      let newChildren = vnode.props.children;
      if (oldChildren == null) {
        if (newChildren != null) {
          ri.childrenRef = mount(ri.node, null, ri.state, newChildren, ctx);
        }
      } else {
        if (newChildren == null) {
          unmount(ri.childrenRef!);
          ri.childrenRef = null;
        } else {
          ri.childrenRef = update(ri.childrenRef!, ri.state, newChildren, ctx);
        }
      }
      env.updateAttributesAfterChildren(ri.node, vnode, ri.vnode, ri.state);
      ri.vnode = vnode;
      return ri;
    }
    if (isNonEmptyArray(vnode) && isNonEmptyArray(ref.vnode)) {
      // TODO: 也许需要优化。见分支 dev-0.1.0-update_idx
      // 之前的 abcz 更新顺序 az-abz-abcz 的算法很简单，但无论真实顺序变没变，都dom重新整理了顺序，可能访问并变更了太多次 dom，性能可能有问题
      // 而且浏览器开发者工具会收起所有的 dom(因为父元素的顺序都有改变)，开发体验不好
      // preact 的逻辑似乎是先不管顺序 update 完，然后统一去 appendChild/insertBefore
      const rl = ref as ListRef<N, S>;
      const refList = rl.refList.slice() as typeof rl.refList;
      let referenceNode = refNodeFirst(refList[refList.length - 1]);
      const parentNode = env.parentNode(referenceNode)!;
      const tasks: number[] = [];
      let lastRef: Ref<N, S> | null = null;
      rl.refList = vnode.map((v: any, newIdx) => {
        const v_type = isComponent(v) ? RefType.MAGALETA : isNonEmptyArray(v) ? RefType.LIST : RefType.ITEM;
        let foundIdx = -1;
        const foundRef = refList.find((it, idx) => {
          foundIdx = idx;
          const rv: any = it.vnode;
          return v_type === it.type && v?.key === rv?.key && v?.type === rv?.type;
        });
        if (foundRef) {
          refList.splice(foundIdx, 1);
          if (foundIdx !== 0) {
            tasks.push(newIdx);
          }
          // 如果 foundIdx !== 0 说明要移动，直接移动到当前 refList[0] 的上面，或者上一个 ref 的下面
          // 这就是第一个 ref，不存在上一个 ref，则必须 refList[0] 。所以需要 refNodeFirst
          // 为 0 则不用移动。。。另外，因为定位基于其他的 ref，所以 Portal 必须要在原位留个 empty_dom。干脆 Portal 直接新的 mount 好了，反正 ctx 可以传递 
          // 另外，根据 foundIdx 是否为 0 来移动，不为 0 就要移动到上面，但更可能是删除了东西，这样移动操作就太多了。所以，先删除，后判断为 0 更划算
          // 另外，不为 0 除了可能是删除了东西以外，也可能是把上面的移动到了下面，这样先删除也不能优化。或许真的就是大家的从上从下双向判断的算法
          // 移动位置可以是弄个位置任务。即 foundIdx==0 时没有任务，不为 0 时
          // update_idx(foundRef, parentNode, referenceNode);
          return lastRef = update(foundRef, parentState, v, ctx);
        }
        if (tasks.indexOf(newIdx-1) > -1) {
          tasks.push(newIdx);
        }
        return lastRef = mount(parentNode, !lastRef ? refNodeFirst(refList[0]) : env.nextSibling(refNodeLast(lastRef)), parentState, v, ctx);
      }) as [any, ...any[]];
      unmount({ type: RefType.LIST, vnode: [null], refList });
      rl.vnode = vnode;
      return rl;
    }
    if (isComponent(vnode) && isComponent(ref.vnode) && vnode.type === ref.vnode.type) {
      const rm = ref as MagaletaRef<N, S>;
      const renderedVnode = rm.render(vnode.props);
      rm.renderedRef = update(rm.renderedRef, parentState, renderedVnode, rm.instance.ctx);
      rm.vnode = vnode;
      return rm;
    }
    {
      // // unmount 在原处留一个 empty_dom 作为 referenceNode 最后再移除掉，似乎也行
      // const referenceNode = refNodeLast(ref);
      // const parentNode = env.parentNode(referenceNode)!;
      // // 如果是 refNodeLast 则应该是 mount(parentNode, referenceNode.nextSibling, parentState, vnode, ctx)
      // // 如果是 refNodeFirst 才是 mount(parentNode, referenceNode, parentState, vnode, ctx)
      // // 不过 refNodeFirst 有缺点是会引起更多的元素重排
      // const newRef = mount(parentNode, referenceNode, parentState, vnode, ctx);
      // unmount(ref);
      // return newRef;

      const referenceNode = refNodeFirst(ref);
      const parentNode = env.parentNode(referenceNode)!;
      const newRef = mount(parentNode, referenceNode, parentState, vnode, ctx);
      unmount(ref);
      return newRef;
    }
  }

  function update_idx(ref: Ref<N, S>, parentNode: N, referenceNode: N | null) {
    if (ref.type === RefType.ITEM) {
      env.insertBefore(parentNode, ref.node, referenceNode);
      return;
    }
    if (ref.type === RefType.LIST) {
      ref.refList.forEach(it => update_idx(it, parentNode, referenceNode));
      return;
    }
    update_idx(ref.renderedRef, parentNode, referenceNode);
  }

  function unmount(ref: Ref<N, S>) {
    if (ref.type === RefType.ITEM) {
      env.unmountAttributesBeforeChildren(ref.node, ref.vnode, ref.state);
      ref.childrenRef && unmount(ref.childrenRef);
      env.unmountAttributesAfterChildren(ref.node, ref.vnode, ref.state);
      env.removeChild(env.parentNode(ref.node)!, ref.node);
    } else if (ref.type === RefType.LIST) {
      ref.refList
        .slice()
        .reverse()
        .forEach(it => unmount(it));
    } else {
      ref.instance[symbol].unmount?.forEach(tryCatchLog);
      unmount(ref.renderedRef);
      ref.instance[symbol].unmounted?.forEach(tryCatchLog);
    }
  }
}


function refNodeFirst<N>(ref: Ref<N>): N {
  if (ref.type === RefType.ITEM) {
    return ref.node;
  }
  if (ref.type === RefType.LIST) {
    return refNodeFirst(ref.refList[0]);
  }
  return refNodeFirst(ref.renderedRef);
}
function refNodeLast<N>(ref: Ref<N>): N {
  if (ref.type === RefType.ITEM) {
    return ref.node;
  }
  if (ref.type === RefType.LIST) {
    return refNodeLast(ref.refList[ref.refList.length - 1]);
  }
  return refNodeLast(ref.renderedRef);
}
// function refNodeAll<N>(ref: Ref<N>, nodes: N[] = []): N[] {
//   if (ref.type === RefType.ITEM) {
//     nodes.push(ref.node);
//     return nodes;
//   }
//   if (ref.type === RefType.LIST) {
//     ref.refList.forEach(it => refNodeAll(it, nodes));
//     return nodes;
//   }
//   return refNodeAll(ref.renderedRef, nodes);
// }


export type Component<P extends {} = {}, C extends {} = {}> = (init: P, ins: ReturnType<typeof createInstance<P, C>>) => (props: P) => Vnode;
