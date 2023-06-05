之前的 `update.non_empty_array` 时的逻辑是：获取旧的 dom 的最后的节点的 nextSibling，然后根据最新的 vnode（是一个 array），从旧的里面找可复用的，不论是否需要移动位置，都移动到上面的 nextSibling 的上面去，从而整个的重新排序了一次。即 abcdez 的更新顺序是 az-abz-abcz-abcdz-abcdez ，访问了太多次 dom，性能可能有问题。而且浏览器开发者工具会因此收起下层 dom(因为上层 dom 顺序有改变)。用户在调试下层 dom 的时候，开发体验不好

```ts
if (isNonEmptyArray(vnode) && isNonEmptyArray(ref.vnode)) {
  // TODO: 也许需要优化。见分支 dev-0.1.0-update_idx
  // 之前的 abcz 更新顺序 az-abz-abcz 的算法很简单，但可能访问并变更了太多次 dom，性能可能有问题
  // 而且浏览器开发者工具会收起所有的 dom(因为顺序中间有改变)，开发体验不好
  const rl = ref as ListRef<N, S>;
  const refList = rl.refList.slice() as typeof rl.refList;
  const lastNode = refNodeLast(refList[refList.length - 1]);
  const parentNode = env.parentNode(lastNode)!;
  const referenceNode = env.nextSibling(lastNode);
  rl.refList = vnode.map((v: any) => {
    let foundIdx = -1;
    const foundRef = refList.find((it, idx) => {
      foundIdx = idx;
      const rv: any = it.vnode;
      return v?.key === rv?.key && v?.type === rv?.type;
    });
    if (foundRef) {
      refList.splice(foundIdx, 1);
      update_idx(foundRef, parentNode, referenceNode);
      return update(foundRef, parentState, v, ctx);
    }
    return mount(parentNode, referenceNode, parentState, v, ctx);
  }) as [any, ...any[]];
  unmount({ type: RefType.LIST, vnode: [null], refList });
  rl.vnode = vnode;
  return rl;
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
```

其实可以更改逻辑为：
```jsx
// <><img/><audio/></> 变为 <><audio/><img/></> 会是全部重新创建
// <><img key="a"/><audio/></> 变为 <><audio/><img key="a"/></> 会复用 img，audio 理论上可以复用
// <><img key="a"/><audio/><video/></> 变为 <><audio/><video/><img key="a"/></> 会复用 img，audio+video 理论上也可以复用
// <><img key="a"/><audio/><video/></> 变为 <><video/><audio/><img key="a"/></> 会复用 img，audio/video 不会复用
// 整体逻辑也就是 只有有 key 才会移动，没有 key 的都不移动，只是没有改变顺序的话会尽量复用（尽量复用就是每次游标变化后都优先从上从下对比）
```
没 key 的如果顺序变化，认为是重新创建其实是更很符合直觉的。比旧方法的“从旧的refList里找一个符合条件的用上”要更符合直觉。而且旧方法“从list里找一个”这个过程就已经丢失了顺序信息，之后想再低成本地补上也非常困难。

另外，key 不可重复，就算 refType/vnode?.type 都不同，key 也不可重复，否则必须得是 refType+vnode.key+vnode.type 三者为唯一主键，否则就丢失了顺序信息，跟“从旧的refList里找一个符合条件的用上”没有区别。而那 三者为唯一主键 的逻辑又太过复杂，毫无必要。

思路演化：
1. abcdefg -> acdeg: a对a，然后各自游标加1，然后 b对c 对不上，且 b 没有 key，此时可以删除 b。旧游标加1，然后 c对c，d对d，e对e，然后 f对g，对不上，f没有key，删除f，g对g
2. abcdefg -> ahcdeig: b对h 对不上，删除 b，然后 c对h，仍然对不上，此时怎么办。。。 甚至 abc 变 ahbc ，这个 abc 变 ahbc 因为又从上从下两边前进，所以 bc 能复用。但是abcde 变 axbcdye 会只有 ae 能复用。x 跟 b 对不上，因为不清楚 x 是不是在 b 后面，是该当前位置插入 x 还是移除 b
3. 先挑出来新旧的所有有 key 的，然后剩下的部分对比，然后按照剩余高度(newEnd-newStart < oldEnd-oldStart)去 peek 后面的有没有跟自己相匹配的

abcdefg
axcdebhg  按剩余高度适用于这个

abcdefg
axyzbg    但是按剩余高度不适用于这个，b不能复用，尽管bg相对位置没有变化

abcdefg
axycdbg   这里更应该 cd 复用，但是

abcdefg   理应是 插入一个 x，插入一个 h
axcdefhg  但只是按序号和长度匹配的话，这里 bx对不上，对bc，然后bc后面的长度相同，但bc对不上，于是bc全消，cd全消，。。。只剩个g匹配

abcdefg   理应是 插入一个 xyza 或者 axyz 都可以
axyzabcdefg

aebcd
bcdae  这里不应该有 ae 移动，只有 ae 删除，然后新建 ae

aebcd
cdaeb 这里李虎又是 删除cd后创建cd

```ts

```
