import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'

import { render, defineComponent, ref } from 'senia';

const Counter = defineComponent(_ => {
  const c = ref(0);
  const onclick = () => c.value++;
  return _ => {
    return <button id="counter" type="button" onclick={onclick}>{c.value}</button>
  }
});

const App = defineComponent(_ => {
  return _ => {
    return <div>
      <a href="https://vitejs.dev" target="_blank">
        <img src={viteLogo} class="logo" alt="Vite logo" />
      </a>
      <a href="https://www.typescriptlang.org/" target="_blank">
        <img src={typescriptLogo} class="logo vanilla" alt="TypeScript logo" />
      </a>
      <h1>Vite + TypeScript</h1>
      <div class="card">
        <Counter />
      </div>
      <p class="read-the-docs">
        Click on the Vite and TypeScript logos to learn more
      </p>
    </div>
  }
});

render(<App />, document.querySelector('#app')!);
