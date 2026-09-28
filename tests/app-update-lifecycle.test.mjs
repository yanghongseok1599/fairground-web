import {test} from 'node:test';import assert from 'node:assert/strict';import {moduleLoader} from './helpers/load-ts-module.mjs';
function browser(t,path,{controller=true,editor=false}={}){
 const previous=Object.fromEntries(['window','document','navigator'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));const oldEnv=process.env.NODE_ENV;process.env.NODE_ENV='production';
 const calls={reloads:0,messages:0,updates:0};const window=new EventTarget();window.location={pathname:path,reload:()=>calls.reloads++};
 const document=new EventTarget();document.visibilityState='visible';document.querySelector=()=>editor?{}:null;
 const sw=new EventTarget();sw.controller=controller?{}:null;const reg=new EventTarget();reg.waiting={postMessage:()=>calls.messages++};reg.update=async()=>{calls.updates++;};reg.installing=null;sw.register=async(_url,options)=>{calls.options=options;return reg;};
 for(const [k,value]of Object.entries({window,document,navigator:{serviceWorker:sw}}))Object.defineProperty(globalThis,k,{value,configurable:true});let cleanup;
 const {SwRegister}=moduleLoader({'react':{useEffect:fn=>{cleanup=fn();}},'next/navigation':{usePathname:()=>path}})('src/components/sw-register.tsx');SwRegister();
 t.after(()=>{cleanup?.();for(const[k,descriptor]of Object.entries(previous))if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];if(oldEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnv;});
 return{calls,window,document,sw,ready:async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();}};
}
test('Safari 뒤로가기 복원은 읽기 화면을 한 번만 갱신하며 SW HTTP 캐시를 우회한다',async t=>{const b=browser(t,'/admin/matches');await b.ready();assert.equal(b.calls.options.updateViaCache,'none');const event=new Event('pageshow');Object.defineProperty(event,'persisted',{value:true});b.window.dispatchEvent(event);b.sw.dispatchEvent(new Event('controllerchange'));assert.equal(b.calls.reloads,1);});
test('경기 입력·회원 수정·열린 작성창에서는 강제 갱신하지 않는다',async t=>{const b=browser(t,'/admin/match/synthetic');await b.ready();b.sw.dispatchEvent(new Event('controllerchange'));const event=new Event('pageshow');Object.defineProperty(event,'persisted',{value:true});b.window.dispatchEvent(event);assert.equal(b.calls.reloads,0);assert.equal(b.calls.messages,0);});
test('경기 목록에서도 새 대회 작성창이 열려 있으면 입력을 보존한다',async t=>{const b=browser(t,'/admin/matches',{editor:true});await b.ready();b.sw.dispatchEvent(new Event('controllerchange'));assert.equal(b.calls.reloads,0);assert.equal(b.calls.messages,0);});
test('최초 SW 설치는 화면을 불필요하게 새로고침하지 않는다',async t=>{const b=browser(t,'/',{controller:false});await b.ready();b.sw.dispatchEvent(new Event('controllerchange'));assert.equal(b.calls.reloads,0);});
