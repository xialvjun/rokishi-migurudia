# eternal-senia

A simple framework with imperative code to build declarative UI.

## it's simple

```jsx
const Counter = (initProps, instance) => {
  let count = initProps.initCount;
  const onclick = () => instance.update(() => count++);
  return () => <button onclick={onclick}>{count}</button>
}
```

with reactive state
```jsx
import { defineComponent, ref } from 'senia';
const Counter = defineComponent((initProps, instance) => {
  const count = ref(initProps.initCount);
  const onclick = () => count.value++;
  return () => <button onclick={onclick}>{count.value}</button>
})
```

## how in qa style

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
A: Yes, and **reactive state can only be used in components defined with `defineComponent`**. `defineComponent` is a function to bind `instance.update` to reactive state's listeners.