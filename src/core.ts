import { queueMacrotask, queueMicrotask, tryCatchLog } from './tools';

type EmptyVnode = false | null | undefined | [];
type LeafVnode = string | number;
type ElementVnode = { type: string; props: { children?: Vnode }; key?: any };
type EnvVnode = EmptyVnode | LeafVnode | ElementVnode;
type EnvNode = never;
type NonEmptyArrayVnode = [Vnode, ...Vnode[]];
type ComponentVnode = { type: (init: {}, ins: unknown) => (props: {}) => Vnode; props: {}; key?: any };
export type Vnode = EnvVnode | EnvNode | NonEmptyArrayVnode | ComponentVnode;

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
  error: Error;
};

function createInstance<P extends {} = {}, C extends {} = {}>(init: P, ctx: C | null, doUpdate: () => void) {
  const hooks: Record<keyof EventMap, Set<Function>> = {} as any;
  const on = <K extends keyof EventMap>(type: K, fn: (event: EventMap[K]) => any) => {
    const set = hooks[type] ??= new Set();
    set.add(fn);
    return () => set.delete(fn);
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
  // createApp(vnode: Vnode): unknown;
  initState(): S;
  isEnvNode(vnode: unknown): vnode is EnvNode;
  // 
  createNode(vnode: EnvVnode, parentState: S): { node: N; state: S };
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
  function mount(parentNode: N, referenceNode: N | null, parentState: S, vnode: Vnode, ctx: any): Ref<N, S> {
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
        hooks.update?.forEach(tryCatchLog);
        let updated = true;
        try {
          ref.renderedRef = update(ref.renderedRef, parentState, vnode, instance.ctx);
        } catch (error) {
          updated = false;
          const hooks_error = hooks.error;
          if (!hooks_error?.size) {
            throw error;
          }
          hooks_error.forEach(tryCatchLog);
        }
        updated && hooks.updated?.forEach(tryCatchLog);
      });
      const hooks = instance[symbol];
      const render = type(props, instance);
      const renderedVnode = render(props);
      hooks.mount?.forEach(tryCatchLog);
      const renderedRef = mount(parentNode, referenceNode, parentState, renderedVnode, instance.ctx);
      hooks.mounted?.forEach(tryCatchLog);
      const ref = {
        type: RefType.MAGALETA as const,
        vnode,
        instance,
        render,
        renderedRef,
      };
      return ref;
    }
    if (env.isEnvNode(vnode)) {
      env.insertBefore(parentNode, vnode, referenceNode);
      return { type: RefType.ITEM, vnode, node: vnode, childrenRef: null, state: parentState };
    }
    throw new Error('mount: Invalid Vnode!');
  }

  function update(ref: Ref<N, S>, parentState: S, vnode: Vnode, ctx: any): Ref<N, S> {
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
      const rl = ref as ListRef<N, S>;

      const lastNode = refNodeLast(ref);
      const parentNode = env.parentNode(lastNode)!;
      const lastNext = env.nextSibling(lastNode);

      const oldRefList: (Ref<N, S> | null)[] = rl.refList.slice();
      const newRefList = Array<Ref<N, S>>(vnode.length);
      // const oldRefSet = new Set(oldRefList);
      let oldStart = 0,
        newStart = 0,
        oldEnd = oldRefList.length - 1,
        newEnd = vnode.length - 1;
      let oldRefKeyIdx: Map<any, number> = null!;
      let referenceNode: N | null = undefined!;
      // 如果 while 条件里还加上 `oldStart <= oldEnd &&`，则在 while 循环结束后，可能 newVnode 还没用完，还要继续 mount(newVnode)
      // 所以这里去掉此条件，直接在下面的判断条件里加上 ` && oldRefSet.delete(oldRef)` 判断 oldRef 还没被用掉
      // --算了，下面判断太多了，除了 ` && oldRefSet.delete(oldRef)` 外，还有获取 refNodeFirst(oldRefList[oldStart]) 要判断
      // 还是不能用 oldStart <= oldEnd 去判断。因为下面的 oldStartHasKey 会暂时跳过这个 old 元素，但并不是说不用它
      // 而是准备在之后从 oldRefKeyIdx 里抽取它使用，如果加上了 oldStart <= oldEnd 判断逻辑，就会导致跳出，没用上它了
      while (newStart <= newEnd) {
        // 需要判断 oldStart<=oldEnd 否则 oldEnd 会左进至之前有 key 准备从 oldRefKeyIdx 里复用，于是被跳过的 oldRef 上
        // 于是在 doSuit(oldRefList[oldEnd].vnode, vnode[newEnd]) 里被使用。虽然匹配的元素对了，但 dom 定位不对
        if (oldStart <= oldEnd) {
          // 下面有设置 oldRefList[i] = null 是因为从 keyMap 中抽取，导致 oldRefList 中出现空的
          // 空的因为已经被用了，所以要跳过，而且得最先跳过，后续才能按顺序匹配，避免无意义地移动 dom
          if (oldRefList[oldStart] === null) {
            oldStart++;
            continue;
          }
          if (oldRefList[oldEnd] === null) {
            oldEnd--;
            continue;
          }
        }
        // oldRefList[idx] 不为 null，也可能为 undefined，此时 oldStart/oldEnd/idx >= list.length 了

        // 直接按顺序匹配，不会移动 dom ，而从 keyMap 中获取的，就得移动 dom。所以优先不判断 key
        let oldRef = oldRefList[oldStart];
        let newVnode = vnode[newStart];
        // // 如果 oldRefSet.has(oldRefList[oldStart]) 为 false，说明 oldStart 已经大于 oldEnd，甚至已经大于 oldRefList.length
        // if (!oldRefSet.has(oldRef)) {
        //   // 不用担心 newRefList[newStart-1] 为空，为空说明 newStart 为 0，那时候 oldRef 肯定有
        //   referenceNode = env.nextSibling(refNodeLast(newRefList[newStart-1]));
        //   newRefList[newStart] = mount(parentNode, referenceNode, parentState, newVnode, ctx);
        //   newStart++;
        //   continue;
        // }

        // doSuit 如果只比较 key，则对于有 key 的，key 相同但 type 不同的，不复用理所当然
        // 但对于没有 key 的，它 key 都为 undefined，key 相同，type 不同，此时应该从反方向
        if (oldRef && doSuit(oldRef.vnode, newVnode)) {
          newRefList[newStart] = update(oldRef, parentState, newVnode, ctx);
          newStart++;
          oldRefList[oldStart] = null;
          // 已经置为 null 了就不要改 old 的游标了，避免上面判断 ===null 重复改变游标
          // 不，单纯依赖上面判断 ===null 来改变游标，除了会让 oldStart 超出 oldRefList 长度以外，还会让 oldEnd 指向已被跳过的 oldVnode
          oldStart++;
          continue;
        }

        oldRef = oldRefList[oldEnd];
        newVnode = vnode[newEnd];
        if (oldRef && doSuit(oldRef.vnode, newVnode)) {
          newRefList[newEnd] = update(oldRef, parentState, newVnode, ctx);
          newEnd--;
          oldRefList[oldEnd] = null;
          oldEnd--;
          continue;
        }

        if (!oldRefKeyIdx) {
          oldRefKeyIdx = new Map();
          for (let i = oldStart; i <= oldEnd; i++) {
            const v = oldRefList[i]!.vnode;
            if (hasKey(v)) {
              oldRefKeyIdx.set(v.key, i);
            }
          }
        }

        newVnode = vnode[newStart];
        const oldRefStart = oldRefList[oldStart];
        oldRef = oldRefStart;
        // ? 下面的部分 oldRef=oldRefList[oldStart] 可能已经不存在了，不存在不是指 ===null，而是 ===undefined
        // ? 或者 oldRefSet.has(oldRef)===false 了，因为 oldStart>oldEnd，甚至已经超出了数组长度，按顺序匹配的 old 资源已经复用完了
        // ? 但按 key 复用的可能在前面有遗漏的，仍需要继续等待 newStart++

        // if (newHasKey && sameKey) {
        //   // update_idx ( oldRef )
        //   update()
        //   continue;
        // } else if (oldRef) {
        //   if (newHasKey) {
        //     mount()
        //   } else {
        //     if (oldHasKey) {
        //       oldStart++;
        //       continue;
        //     }
        //     update();
        //     continue;
        //   }
        // } else {
        //   mount();
        // }

        // if (newHasKey && sameKey) {
        // } else if (!oldRef) {
        // } else if (newHasKey) {}
        // else if (oldHasKey) {} else {}

        if (!oldRefStart && referenceNode === undefined) {
          // 当 key 重复时，后一个 newVnode 会被忽略，则 newRefList[newStart-1] 可能为空，所以下面的不行。
          // 还是不忽略 newVnode 避免 rl.vnode.length!==rl.refList.length 。但仍然根据 newEnd 定位
          // referenceNode = env.nextSibling(refNodeLast(newRefList[newStart-1]));
          referenceNode = newEnd < vnode.length - 1 ? refNodeFirst(newRefList[newEnd + 1]) : lastNext;
        }
        if (hasKey(newVnode) && oldRefKeyIdx.has(newVnode.key)) {
          // const oldStartHasKey = !!oldRefStart && hasKey(oldRefStart.vnode);
          const oldRefIdx = oldRefKeyIdx.get(newVnode.key)!;
          // oldRefIdx 与 oldStart 有可能相同，是 key 相同但 type 不同。所以应该先移动后置空。呃，其实此时不需要移动
          oldRef = oldRefList[oldRefIdx];
          // 如果 oldRefSet.has(oldRef) 为 false，说明 key 有重复，此时无论有没有 newRefList[newStart] = update() 都 newStart++
          if (oldRef) {
            if (oldRefIdx !== oldStart) {
              update_idx(oldRef, parentNode, referenceNode !== undefined ? referenceNode : refNodeFirst(oldRefStart!));
            }
            newRefList[newStart] = update(oldRef, parentState, newVnode, ctx);
            newStart++;
            oldRefList[oldRefIdx] = null;
            // oldRefSet.delete(oldRef);

            // // 应该是 oldStart < oldRefIdx 而不是 oldStart <= oldRefIdx。等于的时候不改变游标，避免最上方 ===null 重复改变游标
            // if (oldStartHasKey && oldStart <= oldRefIdx) {
            //   // 这段 if(oldStart <= oldRefIdx) 适用于这种情况
            //   // xabcdefgy
            //   // xgbcdefay
            //   // 否则，适用于
            //   // xabcdefgy
            //   // xgabcdefy
            //   // 在大部分元素顺序未变的时候，这个判断极大地提高了效率，限制 oldStart++，从而充分利用了上面的“按顺序匹配不移动DOM”，即
            //   // 找到的东西在 oldStart 前面，则假如说元素不缺，相对顺序也没变，则就是 oldStart 比 new 要偏靠后，所以不加 oldStart 让 newStart 赶上来
            //   oldStart++;
            // }
          } else {
            // 这里可以选择是 mount newVnode 还是忽略这个 key 已经重复的 vnode 。如果忽略，那不能用 refNodeLast(newRefList[newStart-1]) 来定位
            // 且最后的 rl.refList=newRefList.filter(v=>v)...还是不忽略吧，不然 rl.vnode 就与 rl.refList 就不等长了
            // 可以在 dev 模式下提示错误
            newRefList[newStart] = mount(
              parentNode,
              referenceNode !== undefined ? referenceNode : refNodeFirst(oldRefStart!),
              parentState,
              newVnode,
              ctx
            );
            newStart++;
          }
          if (oldRefStart && hasKey(oldRefStart.vnode) && oldStart <= oldRefIdx) {
            oldStart++;
          }
          // // 本来 newStart++ 应放在上面 newRefList[newStart] = update() 那句下面，但是
          // newStart++;
          continue;
        }
        if (!oldRef) {
          newRefList[newStart] = mount(parentNode, referenceNode, parentState, newVnode, ctx);
          newStart++;
          continue;
        }
        if (hasKey(newVnode)) {
          newRefList[newStart] = mount(parentNode, refNodeFirst(oldRef), parentState, newVnode, ctx);
          newStart++;
          continue;
        }
        if (hasKey(oldRef.vnode)) {
          oldStart++;
          continue;
        }
        newRefList[newStart] = update(oldRef, parentState, newVnode, ctx);
        newStart++;
        oldRefList[oldStart] = null;
        oldStart++;
        continue;

        // // const oldStartHasKey = hasKey(oldRef.vnode);
        // if (hasKey(newVnode)) {
        //   if (oldRefKeyIdx.has(newVnode.key)) {
        //     const oldRefIdx = oldRefKeyIdx.get(newVnode.key)!;
        //     // oldRefIdx 与 oldStart 有可能相同，是 key 相同但 type 不同。所以应该先移动后置空。呃，其实此时不需要移动
        //     oldRef = oldRefList[oldRefIdx];
        //     // 如果 oldRefSet.has(oldRef) 为 false，说明 key 有重复
        //     if (oldRefSet.has(oldRef)) {
        //       if (oldRefIdx !== oldStart) {
        //         update_idx(oldRef, parentNode, refNodeFirst(oldRefList[oldStart]));
        //       }
        //       oldRefList[oldRefIdx] = null!;
        //       newRefList[newStart] = update(oldRef, parentState, newVnode, ctx);
        //       oldRefSet.delete(oldRef);

        //       if (oldStartHasKey && oldStart <= oldRefIdx) {
        //         // 这段 if(oldStart <= oldRefIdx) 适用于这种情况
        //         // xabcdefgy
        //         // xgbcdefay
        //         // 否则，适用于
        //         // xabcdefgy
        //         // xgabcdefy
        //         // 在大部分元素顺序未变的时候，这个判断极大地提高了效率，限制 oldStart++，从而充分利用了上面的“按顺序匹配不移动DOM”，即
        //         // 找到的东西在 oldStart 前面，则假如说元素不缺，相对顺序也没变，则就是 oldStart 比 new 要偏靠后，所以不加 oldStart 让 newStart 赶上来
        //         oldStart++;
        //       }
        //     }
        //     newStart++;
        //     continue;
        //   }
        //   // oldRef = oldRefList[oldStart];
        //   referenceNode = refNodeFirst(oldRef);
        //   // referenceNode = env.nextSibling(refNodeLast(newRefList[newStart-1]));
        //   newRefList[newStart] = mount(parentNode, referenceNode, parentState, newVnode, ctx);
        //   newStart++;
        //   continue;
        // } else {
        //   if (oldStartHasKey) {
        //     oldStart++;
        //     continue;
        //   }
        //   newRefList[newStart] = update(oldRef, parentState, newVnode, ctx);
        //   oldRefSet.delete(oldRef);
        //   oldStart++;
        //   newStart++;
        //   continue;
        // }
      }
      // referenceNode = undefined!;
      // while (newStart <= newEnd) {
      //   if (referenceNode === undefined) {
      //     referenceNode = env.nextSibling(refNodeLast(newRefList[newStart-1]));
      //   }
      //   newRefList[newStart] = mount(parentNode, referenceNode, parentState, vnode[newStart], ctx);
      //   newStart++;
      // }
      // oldRefSet.forEach(unmount);
      oldRefList.forEach(it => it && unmount(it));
      // 新增是从前往后，删除就从后往前，可能会减少浏览器的重排重绘（其实理应不会）
      // oldRefList.reduceRight((_acc, it) => it && unmount(it), null as any);
      rl.refList = newRefList as any;
      rl.vnode = vnode;
      return rl;
    }
    // if (isNonEmptyArray(vnode) && isNonEmptyArray(ref.vnode)) {
    //   const rl = ref as ListRef<N, S>;
    //   const refList = rl.refList.slice() as typeof rl.refList;
    //   const lastNode = refNodeLast(rl);
    //   const parentNode = env.parentNode(lastNode)!;
    //   const lastNext = env.nextSibling(lastNode);
    //   const oldList: Ref<N,S>[] = [];
    //   const oldKeySet = new Set<Ref<N,S>>();
    //   const oldMap = refList.reduce((acc, cv: any) => {
    //     if (hasKey(cv.vnode)) {
    //       oldKeySet.add(cv);
    //       // acc[cv.vnode.key] = cv;
    //       acc.set(cv.vnode.key, cv);
    //     } else {
    //       oldList.push(cv);
    //     }
    //     return acc;
    //   }, new Map());
    //   const newList = vnode.filter(v => !hasKey(v));
    //   let ai = 0, bi = 0, ci=0, aj = oldList.length-1, bj = vnode.length-1, cj=newList.length-1;
    //   const newRefList: Ref<N, S>[] = [];
    //   const get_ref_type = (v: any) => isComponent(v) ? RefType.MAGALETA : isNonEmptyArray(v) ? RefType.LIST : RefType.ITEM;
    //   const is_same_ref = (v: any, ref: any) => get_ref_type(v) === ref.type && v?.type === ref.vnode?.type;
    //   while (ai <= aj && bi <= bj) {
    //     let aref = oldList[ai];
    //     let bv = vnode[bi];
    //     if (hasKey(bv)) {
    //       update_idx(oldMap[bv.key], parentNode, refNodeFirst(aref))
    //       newRefList.push(update(oldMap[bv.key], parentState, bv, ctx));
    //       oldMap[bv.key]=null;
    //       bi++;
    //       continue;
    //     }
    //     if (is_same_ref(bv, aref)) {
    //       newRefList.push(update(aref, parentState, bv, ctx));
    //       ai++;
    //       bi++;
    //       ci++;
    //       continue;
    //     }
    //     if (aj - ai > cj - ci) {
    //       unmount(aref);
    //       ai++;
    //       continue;
    //     } else if (aj - ai < cj - ci) {
    //       mount(parentNode, refNodeFirst(aref), parentState, bv, ctx);
    //       bi++;
    //       ci++;
    //       continue;
    //     } else {
    //       // mount(parentNode, refNodeFirst(aref), parentState, bv, ctx);
    //       // unmount(aref);
    //       update(aref, parentState, bv, ctx);
    //       ai++;
    //       bi++;
    //       ci++;
    //       continue;
    //     }
    //     // let xi = ai, xj = aj, yi = ci, yj = cj;
    //     // while (xi<=xj && yi<=yj && xj - xi !== yj - yi) {
    //     //   if (xj - xi > yj - yi) {

    //     //   }
    //     // }
    //   }
    // }
    // if (isNonEmptyArray(vnode) && isNonEmptyArray(ref.vnode)) {
    //   // TODO: 也许需要优化。见分支 dev-0.1.0-update_idx
    //   // 之前的 abcz 更新顺序 az-abz-abcz 的算法很简单，但无论真实顺序变没变，都dom重新整理了顺序，可能访问并变更了太多次 dom，性能可能有问题
    //   // 而且浏览器开发者工具会收起所有的 dom(因为父元素的顺序都有改变)，开发体验不好
    //   // preact 的逻辑似乎是先不管顺序 update 完，然后统一去 appendChild/insertBefore
    //   const rl = ref as ListRef<N, S>;
    //   const refList = rl.refList.slice() as typeof rl.refList;

    //   const lastNode = refNodeLast(rl);
    //   const parentNode = env.parentNode(lastNode);
    //   const lastNext = env.nextSibling(lastNode);

    //   // <><img/><audio/></> 变为 <><audio/><img/></> 会是全部重新创建
    //   // <><img key="a"/><audio/></> 变为 <><audio/><img key="a"/></> 会复用 img，audio 理论上可以复用
    //   // <><img key="a"/><audio/><video/></> 变为 <><audio/><video/><img key="a"/></> 会复用 img，audio+video 理论上也可以复用
    //   // <><img key="a"/><audio/><video/></> 变为 <><video/><audio/><img key="a"/></> 会复用 img，audio/video 不会复用
    //   // 整体逻辑也就是 只有key才会移动，没有 key 的都不移动，只是没有改变顺序的话会尽量复用（尽量复用就是每次游标变化后都优先从上从下对比）
    //   let ai = 0, bi = 0, aj = vnode.length-1, bj = refList.length-1;
    //   const get_ref_type = (v: any) => isComponent(v) ? RefType.MAGALETA : isNonEmptyArray(v) ? RefType.LIST : RefType.ITEM;
    //   const is_same_ref = (v: any, ref: any) => get_ref_type(v) === ref.type && v?.key === ref.vnode?.key && v?.type === ref.vnode?.type;
    //   const propertyKeySet = new Set(['number', 'string', 'symbol']);
    //   const hasKey = (v: any) => propertyKeySet.has(typeof v?.key)
    //   const noKeyOld: Ref<N,S>[] = [];
    //   const refMap = refList.reduce((acc, cv: any) => {
    //     if (hasKey(cv.vnode)) {
    //       acc[cv.vnode.key] = cv;
    //     } else {
    //       noKeyOld.push(cv);
    //     }
    //     return acc;
    //   }, {} as any);
    //   while (ai <= aj && bi <= bj) {
    //     let av = vnode[ai];
    //     let ref = refList[bi];
    //     if (is_same_ref(av, ref)) {
    //       update(ref, parentState, av, ctx);
    //       ai++;
    //       bi++;
    //       continue;
    //     }

    //     av = vnode[aj];
    //     ref = refList[bj];
    //     if (is_same_ref(av, refList[bj])) {
    //       update(refList[bj], parentState, av, ctx);
    //       aj--;
    //       bj--;
    //       continue;
    //     }
    //   }

    //   let referenceNode = refNodeFirst(refList[0]);
    //   const parentNode = env.parentNode(referenceNode)!;
    //   // const tasks: number[] = [];
    //   let lastRef: Ref<N, S> | null = null;

    //   let oldRefList = rl.refList.slice();
    //   const tasks = vnode.map((v:any) => {
    //     const v_type = isComponent(v) ? RefType.MAGALETA : isNonEmptyArray(v) ? RefType.LIST : RefType.ITEM;
    //     let foundIdx = -1;
    //     const foundRef = refList.find((it, idx) => {
    //       foundIdx = idx;
    //       const rv: any = it.vnode;
    //       return v_type === it.type && v?.key === rv?.key && v?.type === rv?.type;
    //     });
    //     if (foundRef) {
    //       oldRefList.push(foundRef);
    //       refList.splice(foundIdx, 1);
    //       return { foundRef, v };
    //       // return { foundRef, update: () => update(foundRef, parentState, v, ctx) };
    //     }
    //     return { foundRef, v };
    //     // return { foundRef, update: (rn: N|null) => mount(parentNode, rn, parentState, v, ctx) };
    //   });
    //   oldRefList = oldRefList.filter(it => refList.indexOf(it) === -1);
    //   unmount({ type: RefType.LIST, vnode: [null], refList });
    //   tasks.map((it, newIdx) => {

    //   });

    //   rl.refList = vnode.map((v: any, newIdx) => {
    //     const v_type = isComponent(v) ? RefType.MAGALETA : isNonEmptyArray(v) ? RefType.LIST : RefType.ITEM;
    //     let foundIdx = -1;
    //     const foundRef = refList.find((it, idx) => {
    //       foundIdx = idx;
    //       const rv: any = it.vnode;
    //       return v_type === it.type && v?.key === rv?.key && v?.type === rv?.type;
    //     });
    //     if (foundRef) {
    //       refList.splice(foundIdx, 1);
    //       if (foundIdx !== 0) {
    //         tasks.push();
    //       }
    //       // 如果 foundIdx !== 0 说明要移动，直接移动到当前 refList[0] 的上面，或者上一个 ref 的下面
    //       // 这就是第一个 ref，不存在上一个 ref，则必须 refList[0] 。所以需要 refNodeFirst
    //       // 为 0 则不用移动。。。另外，因为定位基于其他的 ref，所以 Portal 必须要在原位留个 empty_dom。干脆 Portal 直接新的 mount 好了，反正 ctx 可以传递
    //       // 另外，根据 foundIdx 是否为 0 来移动，不为 0 就要移动到上面，但更可能是删除了东西，这样移动操作就太多了。所以，先删除，后判断为 0 更划算
    //       // 另外，不为 0 除了可能是删除了东西以外，也可能是把上面的移动到了下面，这样先删除也不能优化。或许真的就是大家的从上从下双向判断的算法
    //       // 移动位置可以是弄个位置任务。即 foundIdx==0 时没有任务，不为 0 时
    //       // update_idx(foundRef, parentNode, referenceNode);
    //       return lastRef = update(foundRef, parentState, v, ctx);
    //     }
    //     if (tasks.indexOf(newIdx-1) > -1) {
    //       tasks.push(newIdx);
    //     }
    //     return lastRef = mount(parentNode, !lastRef ? referenceNode : env.nextSibling(refNodeLast(lastRef)), parentState, v, ctx);
    //   }) as [any, ...any[]];
    //   unmount({ type: RefType.LIST, vnode: [null], refList });
    //   rl.vnode = vnode;
    //   return rl;
    // }
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

  // TODO: unmount 真正的 removeChild 操作可以放外层（即 update）执行，这里不执行，只执行 ref 置空和组件的生命周期事件，速度应该会快点，等 benchmark 出来后再尝试
  // update 里的 unmount 全都 touch_dom, 而 unmount 里的 RefType.ITEM 递归 unmount 就不 touch_dom 了
  function unmount(ref: Ref<N, S>, touch_dom=true) {
    if (ref.type === RefType.ITEM) {
      env.unmountAttributesBeforeChildren(ref.node, ref.vnode, ref.state);
      ref.childrenRef && unmount(ref.childrenRef, false);
      env.unmountAttributesAfterChildren(ref.node, ref.vnode, ref.state);
      touch_dom && env.removeChild(env.parentNode(ref.node)!, ref.node);
    } else if (ref.type === RefType.LIST) {
      ref.refList
        .slice()
        .reverse()
        .forEach(it => unmount(it, touch_dom));
    } else {
      ref.instance[symbol].unmount?.forEach(tryCatchLog);
      unmount(ref.renderedRef, touch_dom);
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

// const propertyKeySet = new Set(['number', 'string', 'symbol']);
// const hasKey = (v: any): v is {key:PropertyKey} => propertyKeySet.has(typeof v?.key)
// const hasKey = (v: any): v is { key: PropertyKey } => v?.key !== undefined;
const hasKey = (v: any): v is { key: PropertyKey } => !!v && v.key !== undefined;
const doSuit = (a: any, b: any) => a?.key === b?.key && a?.type === b?.type;

export type Component<P extends {} = {}, C extends {} = {}> = (
  init: P,
  ins: ReturnType<typeof createInstance<P, C>>
) => (props: P) => Vnode;
