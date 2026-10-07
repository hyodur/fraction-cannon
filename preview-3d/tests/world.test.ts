import assert from "node:assert/strict";
import {BlockWorld,STEP,SHELF_Y} from "../src/world.ts";
import {makeQuestion,isCorrect} from "../../lib/questions.ts";
function settle(w:BlockWorld){
 for(let i=0;i<120*60&&w.moving;i++)w.step();
 assert(!w.moving,"World did not settle: "+JSON.stringify(w.pieces.map(p=>({id:p.id,v:p.body.velocity.length(),a:p.body.angularVelocity.length(),y:p.body.position.y}))));
}
const muzzle={x:0,y:1.65,z:5};
function shoot(w:BlockWorld,id:number){const p=w.active.find(p=>p.id===id)!;return w.hit(id,{x:p.body.position.x,y:p.body.position.y,z:p.body.position.z+p.depth/2},muzzle)}
const a=new BlockWorld();settle(a);assert.equal(a.active.length,9);
assert(!a.hit(999,muzzle,muzzle));assert(shoot(a,9));assert(!shoot(a,8),"A second shot cannot interrupt motion");
let spin=false,depth=false;
for(let i=0;i<120*15&&a.moving;i++){a.step();const p=a.pieces[8];spin ||= Math.abs(p.body.quaternion.x)>.02||Math.abs(p.body.quaternion.y)>.02;depth ||= Math.abs(p.body.position.z)>.1;}
settle(a);assert(spin&&depth,"Shot must move and rotate in depth, not just in a flat plane");
assert(a.pieces[8].cleared,"The top block should fall off the raised shelf");
assert(a.active.length>0,"A top shot must leave a new strategic choice");
assert.equal(a.pieces.length,9,"Fallen blocks remain as physical debris on the floor");
for(const p of a.pieces.filter(p=>p.cleared)){p.body.updateAABB();assert(p.body.aabb.upperBound.y<.65);}
const b=new BlockWorld();settle(b);shoot(b,9);settle(b);
const snapshot=(w:BlockWorld)=>w.pieces.map(p=>({id:p.id,p:p.body.position.toArray(),q:p.body.quaternion.toArray(),cleared:p.cleared}));
assert.deepEqual(snapshot(a),snapshot(b),"Same input must produce the same result");
const falling=new BlockWorld();settle(falling);
falling.pieces[8].body.position.set(6,SHELF_Y+2,0);falling.pieces[8].body.velocity.setZero();falling.moving=true;
for(let i=0;i<120*4;i++)falling.step();
settle(falling);assert(falling.pieces[8].cleared,"An unsupported stationary block must fall under gravity");
const game=new BlockWorld();settle(game);let shots=0;
while(game.active.length&&shots<40){const p=[...game.active].sort((a,b)=>a.body.position.y-b.body.position.y)[0];assert(shoot(game,p.id));settle(game);shots++;}
assert.equal(game.active.length,0,"Stage one must be clearable");
for(let seed=1;seed<=100;seed++)for(const level of [1,2,3] as const){const q=makeQuestion(1,level,seed);assert.equal(q.kind,"fraction");assert(isCorrect(q,q.answer));assert(!isCorrect(q,"999/0"));assert(!q.prompt.includes("없음"));}
console.log(JSON.stringify({passed:true,shots,step:STEP,questions:300}));
