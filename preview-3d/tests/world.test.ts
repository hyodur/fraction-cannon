import {STAGES,MATERIALS,stageBlocks,readProgress,completeStage} from "../src/stages.ts";
import assert from "node:assert/strict";
import {Vec3} from "cannon-es";
import {BlockWorld,STEP,SHELF_Y,CLEAR_Y,BLOCK_DENSITY,SHELF_WIDTH} from "../src/world.ts";
import {makeQuestion,isCorrect} from "../src/questions.ts";
const muzzle={x:0,y:1.65,z:5};
function settle(w:BlockWorld){
 let ticks=0;
 for(;ticks<120*12&&w.moving;ticks++)w.step();
 assert(!w.moving,"Controls stayed locked for 12 seconds: "+JSON.stringify(w.pieces.map(p=>({id:p.id,cleared:p.cleared,v:p.body.velocity.length(),a:p.body.angularVelocity.length(),y:p.body.position.y}))));
 return ticks*STEP;
}
function shoot(w:BlockWorld,id:number,x=0,y=0){return w.hit(id,w.frontPoint(id,x,y),muzzle)}
function snapshot(w:BlockWorld){return w.pieces.map(p=>({id:p.id,p:p.body.position.toArray(),q:p.body.quaternion.toArray(),cleared:p.cleared}))}
const a=new BlockWorld();settle(a);assert.equal(a.active.length,8);
assert(!a.hit(999,muzzle,muzzle));assert(shoot(a,4));assert(!shoot(a,8),"A second shot cannot interrupt motion");
let spin=false,depth=false;
for(let i=0;i<120*12&&a.moving;i++){a.step();const p=a.pieces[3];spin ||= Math.abs(p.body.quaternion.x)>.02||Math.abs(p.body.quaternion.y)>.02;depth ||= Math.abs(p.body.position.z)>.1;}
settle(a);assert(spin&&depth,"Shot must move and rotate in depth");
assert(a.pieces[3].cleared,"The top block should fall off the shelf");
assert(a.active.length>0,"A top shot must leave another strategic choice");
assert.equal(a.pieces.length,8,"Fallen blocks remain as physical debris");
for(const p of a.pieces.filter(p=>p.cleared)){p.body.updateAABB();assert(p.body.aabb.upperBound.y<CLEAR_Y);}
const b=new BlockWorld();settle(b);shoot(b,4);settle(b);
assert.deepEqual(snapshot(a),snapshot(b),"Same input must produce the same result");
// Actual front-face coordinates must track a rotated body, like pointer/number aiming.
const rotated=new BlockWorld();const p=rotated.pieces[3];p.body.quaternion.setFromEuler(.2,.4,.1);
const front=rotated.frontPoint(4),local=p.body.pointToLocalFrame(new Vec3(front.x,front.y,front.z));
assert(Math.abs(local.x)<1e-6&&Math.abs(local.y)<1e-6&&Math.abs(local.z-p.depth/2)<1e-6);
const falling=new BlockWorld();settle(falling);
falling.pieces[3].body.position.set(6,SHELF_Y+2,0);falling.pieces[3].body.velocity.setZero();falling.moving=true;
for(let i=0;i<24;i++){falling.step();assert(falling.moving,"Airborne blocks must never count as resting");}
settle(falling);assert(falling.pieces[3].cleared);
// Regression: a floor pile can stand taller than 0.65 m and still be entirely
// below the shelf. This used to leave the tall pillar and beam selectable.
const pile=new BlockWorld();settle(pile);
for(const p of pile.pieces){
 p.body.position.y-=SHELF_Y;p.body.velocity.setZero();p.body.angularVelocity.setZero();
 p.body.updateAABB();
}

assert(pile.pieces[2].body.aabb.upperBound.y>.65);
pile.moving=true;
const clearedPile=pile.step();
assert.equal(clearedPile.length,8,"All blocks in the under-shelf pile must clear");
assert.equal(pile.active.length,0,"No floor debris can remain targetable");
assert.equal(pile.moving,false,"The last crossing must end the game immediately");
assert.equal(pile.pieces.length,8,"Debris stays visible and physical");
for(const p of pile.pieces)assert(!pile.hit(p.id,p.body.position,muzzle),"A cleared block cannot be shot");
assert.deepEqual(pile.step(),[],"Crossings must not score twice");
// A partly crossed or airborne block above the shelf is not yet cleared.
const boundary=new BlockWorld();settle(boundary);const edge=boundary.pieces[3];
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
const debris=new BlockWorld();settle(debris);const d=debris.pieces[3];d.cleared=true;d.body.position.set(8,.25,0);debris.moving=true;
for(let i=0;i<240&&debris.moving;i++){d.body.angularVelocity.set(0,0,4);debris.step();}
assert(!debris.moving,"Floor debris must not lock controls");
d.body.position.set(8,3,0);d.body.velocity.setZero();
for(let i=0;i<60;i++)debris.step();
assert(d.body.position.y<2,"Gravity must continue after controls unlock");

const errors:string[]=[];
const stageRuns:{stage:number;shots:number;count:number;maxWait:number}[]=[];
for(const stage of STAGES){
 const specs=stageBlocks(stage.id),w=new BlockWorld({stage:stage.id});settle(w);
 assert.equal(specs.length,stage.count);
 assert.equal(w.active.length,stage.count,"Nothing should fall before the first question");
 for(let i=0;i<120*5;i++)w.step();
 assert.equal(w.active.length,stage.count,"The initial structure must remain stable while reading");
 for(const p of w.pieces){
  assert(Math.abs(p.body.mass/(p.width*p.height*p.depth*BLOCK_DENSITY)-stage.material.resistance)<1e-10);
  assert(Math.abs(p.body.position.x)+p.width/2<SHELF_WIDTH/2,"All blocks fit on the shelf");
 }
 for(let i=0;i<specs.length;i++)for(let j=i+1;j<specs.length;j++){
  const a=specs[i],b=specs[j];
  const overlapX=(a.width+b.width)/2-Math.abs(a.x-b.x),overlapY=(a.height+b.height)/2-Math.abs(a.y-b.y);
  assert(!(overlapX>1e-7&&overlapY>1e-7),"Stage "+stage.id+" has intersecting initial blocks "+a.id+"/"+b.id);
 }
 let shots=0,maxWait=0;
 // A visible, repeatable strategy: finish each bridge, then its surviving
 // supports, then each small side/center stack from its lower block.
 for(const id of [3,7,1,2,5,6,11,13,9,...specs.map(p=>p.id)]){
  for(let attempt=0;attempt<6&&w.active.some(p=>p.id===id);attempt++){
   assert(shoot(w,id));shots++;maxWait=Math.max(maxWait,settle(w));
  }
 }
 const result={stage:stage.id,count:stage.count,shots,maxWait};
 console.log("LAYOUT_STAGE:"+JSON.stringify({...result,remaining:w.active.map(p=>p.id)}));
 if(w.active.length)errors.push("Stage cannot finish: "+JSON.stringify(result));
 if(shots>stage.count*2)errors.push("Too many shots: "+JSON.stringify(result));
 stageRuns.push(result);
}
for(let i=1;i<STAGES.length;i++){
 assert(STAGES[i].count>STAGES[i-1].count&&STAGES[i].count-STAGES[i-1].count<=2,"Add only one or two blocks per stage");
 if(i%3!==0)assert.equal(STAGES[i].material,STAGES[i-1].material);
 else assert(STAGES[i].material.resistance-STAGES[i-1].material.resistance<.021);
}
// Test a broad portion of BOTH beam faces, not only one center aim.
const isolation=[];
for(const stage of [1,3,6,9,12])for(const id of [3,7])for(const x of [-.35,0,.35])for(const y of [-.08,0,.08]){
 const w=new BlockWorld({stage});settle(w);const specs=stageBlocks(stage);
 const other=specs.filter(p=>p.group===(id===3?"right":"left")).map(p=>p.id);
 assert(shoot(w,id,x,y));settle(w);for(let i=0;i<240;i++)w.step();
 const firstRemoved=specs.length-w.active.length;
 if(!other.every(id=>w.active.some(p=>p.id===id)))errors.push("Opposite tower fell after one beam hit: "+JSON.stringify({stage,id,x,y}));
 let attempts=1;
 while(w.active.some(p=>p.id===id)&&attempts<5){assert(shoot(w,id,x,y));settle(w);attempts++;}
 if(!other.every(id=>w.active.some(p=>p.id===id)))errors.push("Repeated local collapse reached the other tower: "+JSON.stringify({stage,id,x,y}));
 if(w.active.some(p=>p.id===id))errors.push("Beam does not move after repeated shots: "+JSON.stringify({stage,id,x,y}));
 isolation.push({stage,id,x,y,firstRemoved,attempts,remaining:w.active.length});
}
console.log("ISOLATED_TOWERS:"+JSON.stringify({cases:isolation.length,firstMin:Math.min(...isolation.map(x=>x.firstRemoved)),firstMax:Math.max(...isolation.map(x=>x.firstRemoved)),errors:errors.slice(0,20)}));
for(let i=1;i<stageRuns.length;i++){
 if(stageRuns[i].shots<stageRuns[i-1].shots)errors.push("Reference strategy must not get shorter at stage "+stageRuns[i].stage);
}
for(const id of [2,4,6]){
 if(stageRuns[id-1].shots<=stageRuns[id-2].shots)errors.push("New early side/center target must add a question at stage "+id);
}
const early=stageRuns.slice(0,3).reduce((n,s)=>n+s.shots,0)/3,late=stageRuns.slice(9).reduce((n,s)=>n+s.shots,0)/3;
if(!(late>=early+3))errors.push("Later stages should require meaningfully more solved shots: "+JSON.stringify({early,late}));
if(!(stageRuns[11].shots>stageRuns[0].shots))errors.push("Final stage must involve more questions than the first stage");
console.log("LEARNING_LOAD:"+JSON.stringify({early,late,shots:stageRuns.map(s=>s.shots)}));
assert.deepEqual(errors,[],"Structure and progression regressions");
let progress=readProgress(null);assert.equal(progress.unlocked,1);
assert.deepEqual(completeStage(progress,2),progress,"Locked stages cannot unlock later ones");
for(let id=1;id<=12;id++){progress=completeStage(progress,id);assert.equal(progress.unlocked,Math.min(12,id+1));}
assert.equal(progress.completed.length,12);
assert.deepEqual(readProgress("broken"),readProgress(null));
assert.equal(readProgress('{"current":99,"completed":[12,-1,"1"]}').unlocked,1);
assert.equal(readProgress(JSON.stringify({...progress,current:7})).current,7);
// Independent arithmetic oracles for every question format and gradual number limits.
const formats=new Set<string>();
for(const stage of STAGES)for(const level of [1,2,3] as const)for(let seed=1;seed<=100;seed++){
 const q=makeQuestion(stage.id,level,seed);formats.add(q.kind);
 assert(isCorrect(q,q.answer));assert(!isCorrect(q,"999/0"));assert(!q.prompt.includes("없음"));
 assert(!/통분|약분|분수의 덧셈|분수의 뺄셈|분수의 곱셈|분수의 나눗셈/.test(q.prompt));
 const value=(s:string)=>{const m=/^(?:(\d+) )?(\d+)\/(\d+)$/.exec(s)!;return Number(m[1]||0)+Number(m[2])/Number(m[3]);};
 if(stage.id<=3){
  const nums=q.prompt.match(/\d+/g)!.map(Number),[total,size,part]=nums;
  const expected=level===3?(total/size-part)/(total/size):part/total;
  assert(Math.abs(value(q.answer)-expected)<1e-10);
  assert(total/size<=[4,5,7][stage.step]);
 }else if(stage.id<=6){
  const nums=q.prompt.match(/\d+/g)!.map(Number),total=nums[0],d=nums[1],k=nums.at(-1)!;
  assert.equal(Number(q.answer),level===3?total-total/d*k:total/d*k);
 }else if(stage.id<=9){
  assert(q.expression);
  if(q.kind==="choice"){const [n,d]=q.expression.split("/").map(Number);assert.equal(q.answer,n<d?"진분수":"가분수");}
  else assert(Math.abs(value(q.expression)-value(q.answer))<1e-10);
 }else{
  assert(q.choices?.length===2);
  const a=q.choices[0],b=q.choices[1],da=Number(a.split("/")[1]),db=Number(b.split("/")[1]);
  assert.equal(da,db,"Comparison must not require finding common denominators");
  assert.equal(q.answer,value(a)>value(b)?a:b);
 }
}
assert.deepEqual([...formats].sort(),["choice","fraction","mixed","number"]);
console.log("TWELVE_STAGES:"+JSON.stringify({passed:true,stageRuns,questions:3600,formats:[...formats],progress:progress.completed.length}));

