
export namespace JSX {
  export interface IntrinsicAttributes {
    key?: PropertyKey;
  }
  // export interface IntrinsicElements {
  //   [tag: string]: any;
  // }
  type SpecialProps = {
    class?: any;
    style?: any;
    [k: string]: any;
  };
  export type IntrinsicElements = {
    [k in keyof HTMLElementTagNameMap]: Partial<Omit<HTMLElementTagNameMap[k], 'className' | 'style' | 'children'>> & SpecialProps;
  } & {
    [k in Exclude<keyof SVGElementTagNameMap, keyof HTMLElementTagNameMap>]: Partial<
      Omit<SVGElementTagNameMap[k], 'className' | 'style' | 'children'>
    > &
      SpecialProps;
  } & {
    [k in Exclude<keyof MathMLElementTagNameMap, keyof SVGElementTagNameMap | keyof HTMLElementTagNameMap>]: Partial<
      Omit<MathMLElementTagNameMap[k], 'className' | 'style' | 'children'>
    > &
      SpecialProps;
  } & {
    [k: string]: any;
  };
}

// 声明 t 的时候要把 返回类型一块儿写上，这样在下面的 t(e => {}) e 才能继承类型
// function t<T>(f: T): T {
//   return f;
// }
// type A = { onclick: HTMLDivElement['onclick'] }
// const a: A = {
//   onclick: t(e => {
//     e.x
//   })
// }


// 如果有必要的话，可以参考 https://www.npmjs.com/package/tsx-dom-types 但它还不够好，没有区分不同的元素，例如 audio 和 img 的属性肯定是不同的
// https://juejin.cn/post/7091661845756379167

// type Equal<X, Y> =
//   (<T>() => T extends X ? 1 : 2) extends
//   (<T>() => T extends Y ? 1 : 2) ? true : false

// type AA = {readonly a: string};
// type BB = {a: string};
// type CC = BB extends AA ? 1 : 0;

// type X = {a():void;b:string;c:number;readonly d:string};
// // type x = X['b'|'c'] extends string|number ? true: 0;
// type Xn = keyof X;
// type F<T, K extends keyof T> = T[K] extends Function ? K : never;
// type Xfn = F<X, Xn>;

// type SomeKv<T, V> = V extends T[keyof T] ? true : false; // 不准确, 应该 oneof T[keyof T] extends V
// type EveryKv<T, V> = T[keyof T] extends V ? true : false;

// type FilteredKeys<T, U> = { [P in keyof T]: T[P] extends U ? P : never }[keyof T];
// type XXX = FilteredKeys<X, Function>

type PickByValueType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K]
}
// type XX = keyof PickByValueType<X, Function>

// type GetReadonlyKeys<T, K extends keyof T=keyof T> = Equal<Pick<T, K>, Pick<Readonly<T>, K>> extends true ? K : never
// type GetKeysFunction<T>

// type GetReadonlyKeys<T, K extends keyof T=keyof T> = { -readonly [k in K]: T[k] } extends T ? K : never;
// type NR<T> = { -readonly [k in keyof T]: T[k] }
// type xxx = GetReadonlyKeys<HTMLAudioElement>

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

type GetReadonlyKeys<
  T,
  U extends Readonly<T> = Readonly<T>,
  K extends keyof T = keyof T
> = K extends keyof T ? Equal<Pick<T, K>, Pick<U, K>> extends true ? K : never : never;


const l: xmk = null!;

type DefaultOmitKeys = 'className';
type OmitKeys = {
  a: 'name' | 'age'
};
type PickJsxAttr1<T, k> = Omit<PickByValueType<T, string|number|boolean>, GetReadonlyKeys<T> | (k extends keyof OmitKeys ? OmitKeys[k] : never)>
type PickJsxAttr<T extends {addEventListener:any}> = Omit<PickByValueType<T, string|number|boolean>, GetReadonlyKeys<T>> & {
  // [K in Parameters]
}
type xmk = PickJsxAttr1<HTMLElement, 'div'> // 之后直接加上 HTMLElement 的 on 开头的属性就行了
// 其实这样还是可能有问题， lib.dom.d.ts 里的属性是 ele.xxx = yyy 而不是 ele.setAttribute('xxx', 'yyy') 。可能有缺漏，可能有多的，容易造成误解
// 额，经过实际 chrome 测试，直接 ele.xxx = yyy 对应也会变动 html ，可能反而更好。 甚至 boolean 属性，传 undefined/0 就是移除
type addd = Parameters<HTMLDivElement['addEventListener']>[0]

type add = html[keyof html]['addEventListener']
// function abc(a: {addEventListener:any}) {

// }
// abc(a);

type JsxAttr<k> = MergeT<
  k extends key_h ? PickJsxAttr<html[k]> : {},
  k extends key_s ? PickJsxAttr<svg[k]> : {},
  k extends key_m ? PickJsxAttr<mathml[k]> : {}
>

type l = JsxAttr<'title'>
const x: PickJsxAttr<svg['title']> = null!
const y: PickJsxAttr<html['title']> = null!
const m: l = null!
// m.
type m = key_h & key_s

type JsxE<k> = k extends key_h ? html[k] : k extends key_s ? svg[k] : k extends key_m ? mathml[k] : any;

// 因为 html & svg = "title" | "style" | "a" | "script" , 其他 html & mathml 与 svg & mathml 都是 never
// 而这四个元素都不会在svg里用到，所以为了提升 ts 的速度，只取 html的
type Merge<A, B> = Omit<A, keyof B> & Omit<B, keyof A> & { [k in (keyof A & keyof B)]: A[k] | B[k] };
type MergeT<A, B, C> = Merge<Merge<A, B>, C>
// type a = {a: string,b:number}
// type b = {b:string,c:number}
// type x = keyof a & keyof b
type html = HTMLElementTagNameMap;
type svg = SVGElementTagNameMap;
type mathml = MathMLElementTagNameMap;
type key_h = keyof html;
type key_s = keyof svg;
type key_m = keyof mathml;
type ins = {
  [k in key_h|key_s|key_m]: PickJsxAttr<JsxE<k>>
} & { [k: string]: any }


l.accessKey
l.autocapitalize
l.autofocus
l.autoplay
l.className
l.contentEditable
l.controls
l.currentTime
l.defaultMuted
l.defaultPlaybackRate
l.dir
l.disableRemotePlayback
l.draggable
l.enterKeyHint
l.hidden
l.id
l.inert
l.innerHTML
l.innerText
l.inputMode
l.lang
l.loop
l.muted
l.outerHTML
l.outerText
l.playbackRate
l.preload
l.preservesPitch
l.scrollLeft
l.scrollTop
l.slot
l.spellcheck
l.src
l.tabIndex
l.title
l.translate
l.volume

