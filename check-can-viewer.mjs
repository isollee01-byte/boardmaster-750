import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Exercise user controls independently of a GPU; this does not replace visual QA.
const elements = new Map(), frames = new Map(), uniformValues = {};
let frameId = 0, loadedImage;
function element(selector) {
  if (!elements.has(selector)) elements.set(selector, {
    hidden: true, clientWidth: 500, clientHeight: 600, listeners: {},
    addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); },
    emit(name, event = {}) { for (const fn of this.listeners[name] ?? []) fn({ preventDefault() {}, ...event }); },
    focus() {}, setPointerCapture() {}, getBoundingClientRect() { return {left:0,top:0,width:this.clientWidth,height:this.clientHeight}; },
    append(child) { child.parentElement = this; },
    insertBefore(child) { child.parentElement = this; },
    querySelector: element,
    showModal() { this.open = true; },
    close() { this.open = false; this.emit('close'); }
  });
  return elements.get(selector);
}
const gl = new Proxy({}, { get(_, key) {
  if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
  if (key === 'getParameter') return () => 8192;
  if (key === 'getUniformLocation' || key === 'getAttribLocation') return (_, name) => name;
  if (key === 'uniform1f') return (name, value) => { uniformValues[name] = value; };
  if (key === 'uniformMatrix3fv') return (name, transpose, value) => { assert.equal(transpose,false);uniformValues[name]=Array.from(value); };
  if (key === 'bufferData') return (_, vertices) => assert(vertices.every(Number.isFinite), 'Geometry must be finite');
  return () => ({});
} });
element('#can-viewer').getContext = () => gl;
const document = { querySelector: element, body: { classList: { add() {}, remove() {} } } };
const context = vm.createContext({ document, console, devicePixelRatio: 1,
  requestAnimationFrame(fn) { const id=++frameId; frames.set(id,fn); return id; },
  Image: class { constructor() { this.width=1215; this.height=1406; loadedImage=this; } },
  ResizeObserver: class { observe() {} }
});
vm.runInContext(await readFile(new URL('./dist/can-viewer.js', import.meta.url),'utf8'), context);
function flush() { const pending=[...frames.values()]; frames.clear(); for (const fn of pending) fn(); }
const canvas=element('#can-viewer'), label=element('#can-zoom-level');
loadedImage.onload(); flush();
assert.equal(label.value,'100%'); assert.equal(element('#can-zoom-out').disabled,true);
assert.equal(frames.size,0,'No automatic animation after the initial render');
const initialRotation=[...uniformValues.rotation];
assert(initialRotation.every(Number.isFinite));
function checkRigidRotation(matrix) {
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const dot=matrix[i*3]*matrix[j*3]+matrix[i*3+1]*matrix[j*3+1]+matrix[i*3+2]*matrix[j*3+2];
    assert(Math.abs(dot-(i===j?1:0))<1e-5,'Rotation must preserve the can proportions');
  }
}
element('#can-zoom-in').emit('click'); flush();
assert.equal(label.value,'125%'); assert.equal(uniformValues.zoom,1.25);
for(let i=0;i<20;i++) element('#can-zoom-in').emit('click');
flush(); assert.equal(label.value,'400%'); assert.equal(element('#can-zoom-in').disabled,true);
canvas.emit('pointerdown',{pointerId:1,clientX:100,clientY:100});
canvas.emit('pointermove',{pointerId:1,clientX:150,clientY:150}); flush();
assert.notDeepEqual(uniformValues.rotation,initialRotation,'Diagonal drag rotates the can');
assert.equal(uniformValues.pan,0,'Default drag rotates rather than moving the image');
checkRigidRotation(uniformValues.rotation);
const diagonalRotation=[...uniformValues.rotation];
canvas.emit('pointermove',{pointerId:1,clientX:150,clientY:190});flush();
assert.notDeepEqual(uniformValues.rotation,diagonalRotation,'Vertical drag rotates');
const verticalRotation=[...uniformValues.rotation];
canvas.emit('pointermove',{pointerId:1,clientX:210,clientY:190});flush();
assert.notDeepEqual(uniformValues.rotation,verticalRotation,'Horizontal drag rotates');
const beforePan=[...uniformValues.rotation];
canvas.emit('pointermove',{pointerId:1,clientX:210,clientY:240,shiftKey:true});flush();
assert.deepEqual(uniformValues.rotation,beforePan);assert.notEqual(uniformValues.pan,0,'Shift drag retains vertical pan');
for(let i=0;i<100;i++)canvas.emit('pointermove',{pointerId:1,clientX:250+100*Math.sin(i),clientY:300+100*Math.cos(i)});
flush();checkRigidRotation(uniformValues.rotation);
canvas.emit('pointerup',{pointerId:1});
canvas.emit('keydown',{key:'Home'}); flush();
assert.deepEqual(uniformValues.rotation,initialRotation); assert.equal(uniformValues.pan,0); assert.equal(label.value,'100%');
canvas.emit('wheel',{deltaY:-300}); flush(); assert(uniformValues.zoom>1);
canvas.emit('keydown',{key:'Home'}); flush();
canvas.emit('pointerdown',{pointerId:1,clientX:100,clientY:100});
canvas.emit('pointerdown',{pointerId:2,clientX:200,clientY:100});
canvas.emit('pointermove',{pointerId:2,clientX:300,clientY:100});flush();
assert.equal(uniformValues.zoom,2,'Two finger distance controls zoom');
canvas.emit('pointerup',{pointerId:1});canvas.emit('pointerup',{pointerId:2});
for(let i=0;i<20;i++)element('#can-zoom-out').emit('click');flush();assert.equal(label.value,'100%');
canvas.emit('keydown',{key:'+'});flush();assert.equal(label.value,'125%');
canvas.emit('keydown',{key:'ArrowUp'});flush();assert.notDeepEqual(uniformValues.rotation,initialRotation);
checkRigidRotation(uniformValues.rotation);
canvas.emit('webglcontextlost');assert.equal(canvas.hidden,true);assert.equal(element('.product-can').hidden,false);
console.log('PASS: free trackball rotation, proportions preserved, no autoplay, zoom buttons and limits, wheel, pinch, Shift pan, keyboard, context-loss fallback');
