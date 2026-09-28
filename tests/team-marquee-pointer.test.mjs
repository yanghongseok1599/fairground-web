import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the component's real handlers. Browser QA additionally checks native
// click targeting, which a synthetic dispatchEvent cannot reproduce.
function fixture() {
  const path='src/components/team-marquee.tsx';
  const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const names=['onPointerDown','onPointerMove','endDrag','onClickCapture'];
  const handlers=[];
  const visit=node=>{if(ts.isVariableDeclaration(node)&&names.includes(node.name.getText(source)))handlers.push(`const ${node.getText(source)};`);ts.forEachChild(node,visit);};
  visit(source);
  const captures=[],releases=[];
  const el={scrollLeft:200,setPointerCapture:id=>captures.push(id),releasePointerCapture:id=>releases.push(id)};
  const drag={current:{active:false,pointerId:-1,startX:0,startScroll:0,moved:false}};
  const code=ts.transpileModule(handlers.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const actions=new Function('drag','scrollRef','wrap',code+`return {${names.join(',')}};`)(drag,{current:el},()=>{});
  const event=(extra={})=>({pointerType:'mouse',isPrimary:true,button:0,pointerId:1,clientX:100,...extra});
  const click=(detail=1)=>{let blocked=false;actions.onClickCapture({detail,preventDefault(){blocked=true;},stopPropagation(){}});return blocked;};
  return {...actions,el,drag,captures,releases,event,click};
}

test('a simple mouse click stays targeted at the team button, without pointer capture',()=>{
  const f=fixture();f.onPointerDown(f.event());f.onPointerMove(f.event({clientX:103}));f.endDrag(f.event());
  assert.deepEqual(f.captures,[]);assert.equal(f.el.scrollLeft,200);assert.equal(f.click(),false);assert.equal(f.drag.current.active,false);
});
test('a real drag captures once, scrolls, and suppresses only the following pointer click',()=>{
  const f=fixture();f.onPointerDown(f.event());f.onPointerMove(f.event({clientX:80}));f.onPointerMove(f.event({clientX:60}));
  assert.deepEqual(f.captures,[1]);assert.equal(f.el.scrollLeft,240);f.endDrag(f.event());assert.equal(f.drag.current.active,false);
  assert.equal(f.click(),true);assert.equal(f.click(),false);
});
test('a new click or keyboard activation is not swallowed after a previous drag',()=>{
  const f=fixture();f.onPointerDown(f.event());f.onPointerMove(f.event({clientX:70}));f.endDrag(f.event());assert.equal(f.click(0),false);
  f.onPointerDown(f.event());f.onPointerMove(f.event({clientX:70}));f.endDrag(f.event());f.onPointerDown(f.event());f.endDrag(f.event());assert.equal(f.click(),false);
});
test('touch, secondary pointers and context-menu clicks retain native behavior',()=>{
  for(const ignored of [{pointerType:'touch'},{isPrimary:false},{button:2}]){const f=fixture();f.onPointerDown(f.event(ignored));f.onPointerMove(f.event({clientX:70}));assert.deepEqual(f.captures,[]);assert.equal(f.drag.current.active,false);}
});
test('another pointer cannot move or end the active mouse/pen drag',()=>{
  const f=fixture();f.onPointerDown(f.event({pointerType:'pen'}));f.onPointerMove(f.event({pointerId:2,clientX:50}));f.endDrag(f.event({pointerId:2}));assert.equal(f.drag.current.active,true);assert.equal(f.el.scrollLeft,200);assert.deepEqual(f.captures,[]);f.endDrag(f.event());assert.equal(f.drag.current.active,false);
});
