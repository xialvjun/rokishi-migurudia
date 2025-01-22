import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'

import { render, defineComponent, ref, computed, Setup, useMemo } from 'senia';

const Counter = defineComponent((_, ins) => {
  const c = ref(0);
  const onclick = () => c.value++;
  const cc = computed(() => c.value + 2);
  'mount,mounted,update,updated,unmount,unmounted'.split(',').forEach(v => ins.on(v as any, () => console.log(v)));
  return _ => {
    return <button id="counter" type="button" onclick={onclick}>{cc.value}</button>
  }
});

const App = defineComponent(_ => {
  const counter_if = ref(true);
  const counter_nums = ref(1);
  const oninput = e => counter_nums.value = parseInt(e.target.value)
  return _ => {
    return <div>
      <input style={{position:'absolute',top:0,left:0}} type="text" oninput={oninput} />
      {/* <Setup key="ashdfuad">{(_, {ctx,on,update}) => {
        // console.log(ctx,on,update);
          return _ => <>45646</>
        }}</Setup> */}
      <a href="https://vitejs.dev" target="_blank">
        <img src={viteLogo} className="logo" alt="Vite logo" />
      </a>
      <a href="https://www.typescriptlang.org/" target="_blank">
        <img src={typescriptLogo} className="logo vanilla" alt="TypeScript logo" />
      </a>
      <h1>Vite + TypeScript</h1>
      <button onclick={_ => counter_if.value=!counter_if.value}>toggle {counter_if.value+''}</button>
      <div className="card">
        {Array(counter_nums.value).fill(0).map(_ => <Counter />)}
      </div>
      <p className="read-the-docs">
        Click on the Vite and TypeScript logos to learn more
      </p>
    </div>
  }
});

render(<App />, document.querySelector('#app')!);
