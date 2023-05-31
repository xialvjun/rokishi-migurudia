# eternal-senia

A simple framework with imperative code to build declarative UI.

## usage

```jsx
import { defineComponent, ref, render } from 'senia';
const Counter = defineComponent(_ => {
  const count = ref(0);
  const onclick = () => count.value++;
  return _ => <button onclick={onclick}>{count.value}</button>
});
render(<Counter />, document.querySelector('#app'));
```

## api

### render

```tsx
function render(vnode: Vnode, node: Node): void;
```
render `vnode` as `node`'s last child.

### defineComponent<span id="API_defineComponent" />

```tsx
function createInstance<P extends {} = {}, C extends {} = {}>(init: P, ctx: C | null, doUpdate: () => void): {
  props: P;
  ctx: C & Record<PropertyKey, any>;
  on: <K extends keyof EventMap>(type: K, fn: (event: EventMap[K]) => any) => () => boolean;
  update: (fn?: () => any) => void;
  [symbol]: Record<keyof EventMap, Set<Function>>;
};

type Component<P extends {} = {}, C extends {} = {}> = (init: P, ins: ReturnType<typeof createInstance<P, C>>) => (props: P) => Vnode;

function defineComponent<P extends {} = any, C extends {} = any>(type: Component<P, C>): Component<P, C>;
```

`defineComponent` defines a autobind reactive state component. 

```jsx
const Counter = defineComponent((init, ins) => {
  const count = ref(0);
  const onclick = () => count.value++;
  return props => <button onclick={onclick}>{count.value}</button>
});
```

- type: `defineComponent(type)`, a function returns a render function, is the real component. **Use imperative `type` function to build the declarative `render` function**
  - init: init props
  - ins: component instance
    - ins.props: current props
    - ins.ctx: current component instance context with prototype linked to parent component instance context, ie: `ins.ctx = Object.create(parentInstance.ctx)`, but you can never get `parentInstance`
    - ins.on: lifecycle events: `instance.on('mount|mounted|update|updated|unmount|unmounted', fn)`, returns a revoke function.
    - ins.update: component refresh function
  - return a render function:
    - props: props in current render cycle. You can always use `ins.props` to get the newest props
- defineComponent: autobind reactive state to component.
  > In fact, you can define a component with only `type`, but reactive state, ie `ref` or `computed`, will not autobind to it. `defineComponent` is just a way to bind component's `ins.update` to reactive state .


### ref

```tsx
type Ref<T> = { value: T; };
function ref<T>(): Ref<T | undefined>;
function ref<T>(value: T): Ref<T>;
```

`ref` defines a reactive state. Unlike `vue-composition-api/ref`, `ref` in `senia` is just shallow reactive.
> reactive state can only be autobind with [`defineComponent`](#API_defineComponent).

### computed

```tsx
function computed<T>(fn: () => T): {
  readonly value: T;
  force(): T;
};
```

### watch

watch reactive state and do effect when state change.

```tsx
const count = ref(0);
watch(count, (cv, pv) => { xxx }, { immediate: false, flush: 'post' });
```

- immediate: run the effect function immediately, default to false
- flush:
  - post: run the effect function after a macro task, default to `post`
  - pre: run the effect function after a micro task
  - sync: run the effect function immediate after reactive state changed

## concepts in qa style

Q: What's a state?  
A: `let a = 0` or `var a = 0`.

Q: A variable?  
A: Yes, so `const a = 0` isn't a state.

Q: How to change the state?  
A: Change the variable and if needed, tell those components which depend on the variable to update themselves.

Q: So you write `instance.update(() => count++)`?  
A: Yes, and `count++; instance.update()` is right too. `instance.update(fn)` is just to make `fn` async.

Q: What's a reactive state?  
A: It's just a state with getter, setter and listeners.

Q: So `senia` use `const count = ref(0)` to define a reactive state?  
A: Yes. And **reactive state can only be used in components defined with `defineComponent`**. `defineComponent` is a function to bind `instance.update` to reactive state's listeners.

Q: How to define `Context`?  
A: Just `instance.ctx.abc = xyz` and tell the component to `instance.update`. In fact it's `instance.ctx = Object.create(parentComponentInstance.ctx)` internally, changes to `parentComponentInstance.ctx` will be accessed in `instance.ctx`.
> There is no way to get `parentComponentInstance.ctx` except `Object.getPrototypeOf(instance.ctx)`, but don't do that.

Q: Then, lifecycle?  
A: Just `instance.on('mount|mounted|update|updated|unmount|unmounted', fn)`. You can have multiple hooks in one lifecycle: `instance.on('mounted', hook_one); some_other_things(); instance.on('mounted', hook_two())`.
