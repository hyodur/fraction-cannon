import assert from "node:assert/strict";
import {Vec3} from "cannon-es";
import {BlockWorld,STEP,SHELF_Y,CLEAR_Y} from "../src/world.ts";
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
for(const p of a.pieces.filter(p=>p.cleared)){p.body.updateAABB();assert(p.body.aabb.upperBound.y<CLEAR_Y);}
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
// Regression: a floor pile can stand taller than 0.65 m and still be entirely
// below the shelf. This used to leave the tall pillar and beam selectable.
const pile=new BlockWorld();settle(pile);
for(const p of pile.pieces){
 p.body.position.y-=SHELF_Y;p.body.velocity.setZero();p.body.angularVelocity.setZero();
 p.body.updateAABB();
}
assert(pile.pieces[1].body.aabb.upperBound.y>.65);
assert(pile.pieces[2].body.aabb.upperBound.y>.65);
pile.moving=true;
const clearedPile=pile.step();
assert.equal(clearedPile.length,9,"All blocks in the under-shelf pile must clear");
assert.equal(pile.active.length,0,"No floor debris can remain targetable");
assert.equal(pile.moving,false,"The last crossing must end the game immediately");
assert.equal(pile.pieces.length,9,"Debris stays visible and physical");
for(const p of pile.pieces)assert(!pile.hit(p.id,p.body.position,muzzle),"A cleared block cannot be shot");
assert.deepEqual(pile.step(),[],"Crossings must not score twice");
// A partly crossed or airborne block above the shelf is not yet cleared.
const boundary=new BlockWorld();settle(boundary);const edge=boundary.pieces[8];
edge.body.position.set(6,CLEAR_Y+.10,0);edge.body.velocity.setZero();edge.body.angularVelocity.setZero();edge.body.quaternion.set(0,0,0,1);boundary.moving=true;
boundary.step();assert(!edge.cleared,"A block straddling the clearing plane is still in play");
edge.body.position.set(6,CLEAR_Y-edge.height/2-.04,0);edge.body.velocity.setZero();
assert.deepEqual(boundary.step(),[edge.id],"Clear before landing on the floor");
settle(boundary);assert(!boundary.moving);
assert(!boundary.hit(edge.id,edge.body.position,muzzle),"Cleared targets stay excluded after controls unlock");
edge.body.position.set(6,SHELF_Y+1,0);boundary.step();
assert(edge.cleared,"A bounce cannot restore a cleared target");
// Floor debris can spin without blocking the next question. Physics continues
// after unlocking, so this is not a timeout that freezes unsupported bodies.
const debris=new BlockWorld();settle(debris);const d=debris.pieces[8];d.cleared=true;d.body.position.set(8,.25,0);debris.moving=true;
for(let i=0;i<240&&debris.moving;i++){d.body.angularVelocity.set(0,0,4);debris.step();}
assert(!debris.moving,"Floor debris must not lock controls");
d.body.position.set(8,3,0);d.body.velocity.setZero();
for(let i=0;i<60;i++)debris.step();
assert(d.body.position.y<2,"Gravity must continue after controls unlock");
// Balance must reward a normal hit without clearing the whole structure.
// Cover aim offsets and time spent reading a question, not only one exact shot.
const targets=[];
for(const id of [4,5,6])for(const x of [-.08,0,.08])for(const y of [-.08,0,.08])for(const idle of [0,3]){
 const w=new BlockWorld();settle(w);for(let i=0;i<idle*120;i++)w.step();
 assert.equal(w.pieces[id-1].level,2);
 assert(shoot(w,id,x,y));const seconds=settle(w);
 for(let i=0;i<360;i++)w.step();
 const removed=9-w.active.length;
 targets.push({id,x,y,idle,removed,seconds});
 assert(removed>=1&&removed<=3,"Normal hit should remove 1–3 blocks: "+JSON.stringify(targets.at(-1)));
 assert(w.pieces.slice(0,3).every(p=>!p.cleared),"Normal hit must preserve the base");
}
const bridge=new BlockWorld();settle(bridge);
assert.equal(bridge.pieces[2].level,3,"Load-bearing beam requires a challenge question");
assert(shoot(bridge,3));settle(bridge);
assert(9-bridge.active.length>=5,"A challenge beam hit must have greater reach");
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
console.log(JSON.stringify({passed:true,balanceCases:targets.length,normalMin:Math.min(...targets.map(t=>t.removed)),normalMax:Math.max(...targets.map(t=>t.removed)),challengeRemoved:9-bridge.active.length,sequences,step:STEP,questions:300}));
