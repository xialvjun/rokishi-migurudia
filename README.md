# eternal-senia

A simple framework with imperative code to build declarative UI.

## it's simple

```jsx
import { defineComponent, render } from 'senia';
const Counter = defineComponent((initProps, instance) => {
  let count = initProps.initCount;
  const onclick = () => instance.update(() => count++);
  return props => <button onclick={onclick}>{count}</button>
});
render(<Counter />, document.querySelector('#app'));
```

with reactive state
```jsx
import { defineComponent, ref, render } from 'senia';
const Counter = defineComponent((initProps, instance) => {
  const count = ref(initProps.initCount);
  const onclick = () => count.value++;
  return props => <button onclick={onclick}>{count.value}</button>
});
render(<Counter />, document.querySelector('#app'));
```

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

## a complex example showing all concepts

```tsx
import { defineComponent, ref, render } from 'senia';
const App = defineComponent((_, ins) => {
  const reactive_count = ref(0);
  const reactive_onclick = () => reactive_count.value++;
  let noreactive_count = 0;
  const noreactive_onclick = () => ins.update(() => noreactive_count++);
  ins.ctx.app_reactive_count = reactive_count;
  ins.ctx.app_ctx_noreactive = 0;
  const app_ctx_noreactive_onclick = () => ins.update(() => ins.ctx.app_ctx_noreactive++);
  return _ => <div>
    <div>
      <span>App: </span>
      <button onclick={reactive_onclick}>app_reactive_count: {reactive_count.value}</button>
      <button onclick={noreactive_onclick}>app_noreactive_count: {noreactive_count}</button>
      <button onclick={app_ctx_noreactive_onclick}>app_ctx_noreactive: {ins.ctx.app_ctx_noreactive}</button>
    </div>
    <Sub
      reactive_count={reactive_count}
      noreactive_count={noreactive_count}
      noreactive_count_onclick={() => { noreactive_count++; ins.update() }}
      app_ctx_noreactive_onclick={app_ctx_noreactive_onclick}
    />
  </div>
});
const Sub = defineComponent((init, ins) => {
  // ins.props is always the newest props
  const app_reactive_count_onclick = () => ins.props.reactive_count.value++;
  return props => <div>
    <span>Sub: </span>
    <button onclick={app_reactive_count_onclick}>app_reactive_count: {props.reactive_count.value}</button>
    <button onclick={props.noreactive_count_onclick}>app_noreactive_count: {props.noreactive_count}</button>
  </div>
});
render(<App />, document.querySelector('#app')!);
```

## API

#### render

```tsx
function render(vnode: Vnode, node: Node): void;
```
render `vnode` as `node`'s last child.

```jsx
// before: <body><div id="app"/><script src="xxx" /></body>
render(<div>abc</div>, document.querySelector('#app'));
// after: <body><div id="app"><div>abc</div></div><script src="xxx" /></body>
```

#### defineComponent<span id="API_defineComponent" />
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
> In fact, you can define a component with only defining a function that conforms to that type `Component`, but reactive state will not autobind to it. `defineComponent` is just a way to bind reactive state to components' `ins.update`.

```jsx
const Counter = defineComponent((init, ins) => {
  const count = ref(0);
  const onclick = () => count.value++;
  return props => <button onclick={onclick}>{count.value}</button>
});
```

#### ref
```tsx
type Ref<T> = { value: T; };
function ref<T>(): Ref<T | undefined>;
function ref<T>(value: T): Ref<T>;
```

`ref` defines a reactive state. Unlike `vue-composition-api/ref`, `ref` in `senia` is just shallow reactive.
> reactive state can only be autobind with [`defineComponent`](#API_defineComponent).

#### computed
```tsx
function computed<T>(fn: () => T): {
  readonly value: T;
  force(): T;
};
```

