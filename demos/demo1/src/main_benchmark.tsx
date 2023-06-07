import { render, defineComponent, ref, useMemo } from 'senia';

const Row = defineComponent<{ item: BussItem; selected: boolean; actions: BussActions }>((init, ins) => {
  const onselect = () => ins.props.actions.select(ins.props.item.id);
  const onremove = () => ins.props.actions.remove(ins.props.item.id);
  const memo = useMemo();
  // memo.render = (v: any) => v;
  return memo.render(props => {
    const { selected, item } = props;
    return (
      <tr className={selected ? 'danger' : ''}>
        <td className="col-md-1">{item.id}</td>
        <td className="col-md-4">
          <a onClick={onselect}>{item.label}</a>
        </td>
        <td className="col-md-1">
          <a onClick={onremove}>
            <span className="glyphicon glyphicon-remove" aria-hidden="true" />
          </a>
        </td>
        <td className="col-md-6" />
      </tr>
    );
  });
});

const Button = defineComponent<{ id: string; cb: ()=>any; title: string }>(_ => {
  return props => {
    return (
      <div className="col-sm-6 smallpad">
        <button type="button" className="btn btn-primary btn-block" id={props.id} onClick={props.cb}>
          {props.title}
        </button>
      </div>
    );
  };
});

const Jumbotron = defineComponent<{ actions: BussActions }>((init, ins) => {
  return props => {
    return (
      <div className="jumbotron">
        <div className="row">
          <div className="col-md-6">
            <h1>senia keyed</h1>
          </div>
          <div className="col-md-6">
            <div className="row">
              <Button id="run" title="Create 1,000 rows" cb={() => props.actions.run()} />
              <Button id="runlots" title="Create 10,000 rows" cb={() => props.actions.run_lots()} />
              <Button id="add" title="Append 1,000 rows" cb={() => props.actions.add()} />
              <Button id="update" title="Update every 10th row" cb={() => props.actions.update()} />
              <Button id="clear" title="Clear" cb={() => props.actions.clear()} />
              <Button id="swaprows" title="Swap Rows" cb={() => props.actions.swap_rows()} />
            </div>
          </div>
        </div>
      </div>
    );
  };
});

const buildBussiness = () => {
  const random = (max: number) => Math.round(Math.random() * 1000) % max;
  const A = [
    'pretty',
    'large',
    'big',
    'small',
    'tall',
    'short',
    'long',
    'handsome',
    'plain',
    'quaint',
    'clean',
    'elegant',
    'easy',
    'angry',
    'crazy',
    'helpful',
    'mushy',
    'odd',
    'unsightly',
    'adorable',
    'important',
    'inexpensive',
    'cheap',
    'expensive',
    'fancy',
  ];
  const C = ['red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'brown', 'white', 'black', 'orange'];
  const N = ['table', 'chair', 'house', 'bbq', 'desk', 'car', 'pony', 'cookie', 'sandwich', 'burger', 'pizza', 'mouse', 'keyboard'];

  let nextId = 0;

  const buildData = (count: number) => {
    const data = new Array<BussItem>(count);
    for (let i = 0; i < count; i++) {
      data[i] = {
        id: nextId++,
        label: `${A[random(A.length)]} ${C[random(C.length)]} ${N[random(N.length)]}`,
      };
    }
    return data;
  };

  const state = ref({ data: [] as BussItem[], selected: 0 });
  const run = () => (state.value = { data: buildData(1000), selected: 0 });
  const run_lots = () => (state.value = { data: buildData(10000), selected: 0 });
  const add = () => (state.value = { ...state.value, data: state.value.data.concat(buildData(1000)) });
  const update = () => {
    let { data, selected } = state.value;
    data = data.slice(0);
    for (let i = 0; i < data.length; i += 10) {
      const r = data[i];
      data[i] = { id: r.id, label: r.label + " !!!" };
    }
    state.value = { data, selected };
  };
  const clear = () => {
    state.value = { data: [], selected: 0 }
    nextId = 0;
  };
  const swap_rows = () => {
    let { data, selected } = state.value;
    if (data.length > 998) {
      data = [data[0], data[998], ...data.slice(2, 998), data[1], data[999]];
      state.value = { data, selected };
    }
  };
  const remove = (id: number) => {
    let { data, selected } = state.value;
    const idx = data.findIndex(it => it.id === id);
    data = [...data.slice(0, idx), ...data.slice(idx + 1)];
    state.value = { data, selected };
  };
  const select = (id: number) => (state.value = { ...state.value, selected: id });
  return { state, actions: { run, run_lots, add, update, clear, swap_rows, remove, select } };
};
type Bussiness = ReturnType<typeof buildBussiness>;
type BussActions = Bussiness['actions'];
type BussItem = { id: number; label: string };

const App = defineComponent(_ => {
  const buss = buildBussiness();
  return _ => {
    const { data, selected } = buss.state.value;
    return (
      <div className="container">
        <Jumbotron actions={buss.actions} />
        <table className="table table-hover table-striped test-data">
          <tbody>
            {data.map(item => (
              <Row key={item.id} item={item} selected={selected === item.id} actions={buss.actions} />
            ))}
          </tbody>
        </table>
        <span className="preloadicon glyphicon glyphicon-remove" aria-hidden="true" />
      </div>
    );
  };
});

render(<App />, document.querySelector('#app')!);
