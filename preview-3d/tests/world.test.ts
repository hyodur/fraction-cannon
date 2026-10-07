import assert from "node:assert/strict";
import {Vec3} from "cannon-es";
import {BlockWorld,STEP,SHELF_Y} from "../src/world.ts";
import {makeQuestion,isCorrect} from "../../lib/questions.ts";
const muzzle={x:0,y:1.65,z:5};
function settle(w:BlockWorld){
 let ticks=0;
 for(;ticks<120*12&&w.moving;ticks++)w.step();
 assert(!w.moving,"Controls stayed locked for 12 seconds: "+JSON.stringify(w.pieces.map(p=>({id:p.id,cleared:p.cleared,v:p.body.velocity.length(),a:p.body.angularVelocity.length(),y:p.body.position.y}))));
 return ticks*STEP;
}
function shoot(w:BlockWorld,id:number,x=0,y=0){return w.hit(id,w.frontPoint(id,x,y),muzzle)}
function snapshot(w:BlockWorld){return w.pieces.map(p=>({id:p.id,p:p.body.position.toArray(),q:p.body.quaternion.toArray(),cleared:p.cleared}))}
const a=new BlockWorld();settle(a);assert.equal(a.active.length,9);
assert(!a.hit(999,muzzle,muzzle));assert(shoot(a,9));assert(!shoot(a,8),"A second shot cannot interrupt motion");
let spin=false,depth=false;
for(let i=0;i<120*12&&a.moving;i++){a.step();const p=a.pieces[8];spin ||= Math.abs(p.body.quaternion.x)>.02||Math.abs(p.body.quaternion.y)>.02;depth ||= Math.abs(p.body.position.z)>.1;}
settle(a);assert(spin&&depth,"Shot must move and rotate in depth");
assert(a.pieces[8].cleared,"The top block should fall off the shelf");
assert(a.active.length>0,"A top shot must leave another strategic choice");
assert.equal(a.pieces.length,9,"Fallen blocks remain as physical debris");
for(const p of a.pieces.filter(p=>p.cleared)){p.body.updateAABB();assert(p.body.aabb.upperBound.y<.65);}
const b=new BlockWorld();settle(b);shoot(b,9);settle(b);
assert.deepEqual(snapshot(a),snapshot(b),"Same input must produce the same result");
// Actual front-face coordinates must track a rotated body, like pointer/number aiming.
const rotated=new BlockWorld();const p=rotated.pieces[8];p.body.quaternion.setFromEuler(.2,.4,.1);
const front=rotated.frontPoint(9),local=p.body.pointToLocalFrame(new Vec3(front.x,front.y,front.z));
assert(Math.abs(local.x)<1e-6&&Math.abs(local.y)<1e-6&&Math.abs(local.z-p.depth/2)<1e-6);
const falling=new BlockWorld();settle(falling);
falling.pieces[8].body.position.set(6,SHELF_Y+2,0);falling.pieces[8].body.velocity.setZero();falling.moving=true;
for(let i=0;i<24;i++){falling.step();assert(falling.moving,"Airborne blocks must never count as resting");}
settle(falling);assert(falling.pieces[8].cleared);
// Floor debris can spin without blocking the next question. Physics continues
// after unlocking, so this is not a timeout that freezes unsupported bodies.
const debris=new BlockWorld();settle(debris);const d=debris.pieces[8];d.cleared=true;d.body.position.set(8,.25,0);debris.moving=true;
for(let i=0;i<240&&debris.moving;i++){d.body.angularVelocity.set(0,0,4);debris.step();}
assert(!debris.moving,"Floor debris must not lock controls");
d.body.position.set(8,3,0);d.body.velocity.setZero();
for(let i=0;i<60;i++)debris.step();
assert(d.body.position.y<2,"Gravity must continue after controls unlock");
const targets=[];
for(const id of [3,4,5,6]){
 const w=new BlockWorld();settle(w);let shots=0,maxWait=0;
 while(w.active.some(p=>p.id===id)&&shots<2){assert(shoot(w,id));maxWait=Math.max(maxWait,settle(w));shots++;}
 targets.push({id,shots,maxWait,remaining:w.active.length,targetCleared:w.pieces[id-1].cleared});
 console.log("MIDDLE_TARGET:"+JSON.stringify(targets.at(-1)));
 assert(w.pieces[id-1].cleared,"Middle block "+id+" should leave the shelf within two center hits");
}
// User report: repeated middle hits, then top hit. Include off-center aims and
// realistic idle time spent answering the next question.
const sequences=[];
for(const offset of [-.08,0,.08]){
 const w=new BlockWorld();settle(w);let shots=0,maxWait=0;
 for(const target of [5,5,5,5,9,8,7,6,4,3,2,1]){
  for(let i=0;i<120*3;i++)w.step();
  const piece=w.active.find(p=>p.id===target);if(!piece)continue;
  assert(shoot(w,target,offset,.04));maxWait=Math.max(maxWait,settle(w));shots++;
 }
 while(w.active.length&&shots<20){assert(shoot(w,w.active[0].id));maxWait=Math.max(maxWait,settle(w));shots++;}
 assert.equal(w.active.length,0,"Repeated-shot stage must be clearable");
 sequences.push({offset,shots,maxWait});
}
for(let seed=1;seed<=100;seed++)for(const level of [1,2,3] as const){const q=makeQuestion(1,level,seed);assert.equal(q.kind,"fraction");assert(isCorrect(q,q.answer));assert(!isCorrect(q,"999/0"));assert(!q.prompt.includes("없음"));}
console.log(JSON.stringify({passed:true,targets,sequences,step:STEP,questions:300}));
