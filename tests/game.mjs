import assert from 'node:assert/strict';
import {makeQuestion,isCorrect,publicQuestion} from '../lib/questions.ts';
import {initialBlocks,simulateShot,difficulty,score,SHELF,FALL_CLEAR_Y,blockProperties} from '../lib/physics.ts';
import {playbackPosition} from '../lib/playback.ts';
assert.deepEqual(playbackPosition(99,100,80),{index:0,done:false});
assert.deepEqual(playbackPosition(0,100,0),{index:-1,done:true});
assert.deepEqual(playbackPosition(4100,100,80),{index:79,done:true});
assert.deepEqual(playbackPosition(100000,100,80),{index:79,done:true});
assert.deepEqual(playbackPosition(100,100,1),{index:0,done:false});
// A front-on shot must hit the chosen face, even with another block to its left.
const wall=[{id:1,x:650,y:435,w:40,h:50,a:0,hp:4,maxHp:4,material:3},{id:2,x:750,y:435,w:40,h:50,a:0,hp:4,maxHp:4,material:3}];
const direct=simulateShot(wall,2);
assert.equal(direct.frames.length,80);
assert(direct.frames.slice(0,11).every(f=>f.blocks.every(b=>b.hp===4)));
assert.equal(direct.frames[11].blocks.find(b=>b.id===2).hp,3);
assert.equal(direct.frames[11].blocks.find(b=>b.id===1).hp,4);
assert.equal(direct.frames[0].ball.depth,1);
assert(direct.frames[10].ball.depth<direct.frames[0].ball.depth);
assert.equal(direct.frames[11].ball,undefined);
let supported=initialBlocks(1);
supported=simulateShot(supported,1).blocks;
if(supported.some(b=>b.id===2))supported=simulateShot(supported,2).blocks;
assert(supported.some(b=>b.id>3&&b.y>380)||supported.length<5,'Unsupported upper blocks must fall, even if caught by the shelf');
const topShot=simulateShot(initialBlocks(1),9),lowerShot=simulateShot(initialBlocks(1),1);
assert.equal(topShot.cleared,1,'A top shot should only knock off the top block');
assert(lowerShot.blocks.filter(b=>b.id>3&&b.y>initialBlocks(1).find(original=>original.id===b.id).y+30).length>=3||lowerShot.cleared>topShot.cleared,'A missing support must disturb the upper stack without forced deletion');
assert.equal(topShot.frames[11].blocks.length,9,'Impact must not delete a block');
assert.equal(topShot.frames[11].blocks.find(b=>b.id===9).hp,0,'A fully damaged block still falls visibly');
function verifyFalls(result){
 const frames=[...result.frames,{blocks:result.blocks}];
 for(let i=1;i<frames.length;i++)for(const b of frames[i-1].blocks){
  if(frames[i].blocks.some(next=>next.id===b.id))continue;
  const top=b.y-(Math.abs(Math.sin(b.a))*b.w+Math.abs(Math.cos(b.a))*b.h)/2;
  assert(top>SHELF.y+180,`Block ${b.id} vanished before falling below the shelf`);
  assert(top>FALL_CLEAR_Y-100,`Block ${b.id} must reach the exit before removal`);
 }
}
verifyFalls(topShot);verifyFalls(lowerShot);
// Isolated airborne blocks remove contact friction from the comparison.
// Damage must not alter the shot impulse, spin, mass, gravity or air drag.
const airborne={id:1,x:690,y:40,w:56,h:36,a:0,hp:3,maxHp:3,material:2};
const motion=b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,va:b.va,a:b.a});
const damageFlights=[1,2,3].map(hp=>simulateShot([{...airborne,hp}],1));
for(const flight of damageFlights)for(const index of [10,11,15])assert.deepEqual(motion(flight.frames[index].blocks[0]),motion(damageFlights[0].frames[index].blocks[0]));
const light=simulateShot([{...airborne,material:0}],1),heavy=simulateShot([{...airborne,material:3}],1);
assert(Math.abs(light.frames[11].blocks[0].vx)>Math.abs(heavy.frames[11].blocks[0].vx),'Equal shots move lighter blocks more');
assert.deepEqual(simulateShot(initialBlocks(1),1),simulateShot(initialBlocks(1),1),'Identical states and shots must replay identically');
for(let material=0;material<4;material++){
 const maxHp=material+1,properties=Array.from({length:maxHp+1},(_,hp)=>blockProperties({...airborne,material,hp,maxHp}));
 for(let hp=1;hp<=maxHp;hp++)assert(properties[hp].friction>properties[hp-1].friction);
 assert(properties.every(p=>p.frictionAir===properties[0].frictionAir&&p.density===properties[0].density));
}
let count=0;
for(let s=1;s<=12;s++) for(let l=1;l<=3;l++) for(let seed=1;seed<=80;seed++){
 const q=makeQuestion(s,l,seed); assert(isCorrect(q,q.answer),JSON.stringify(q)); assert(!('answer' in publicQuestion(q)));assert(!('explanation' in publicQuestion(q)));assert(!isCorrect(q,'999/0'));assert(!isCorrect(q,'NaN'));assert(!q.prompt.includes('없음'));assert(q.hints.length===2);
 if(s<=3){let {groups,size,selected}=q.diagram;assert(groups>=3&&groups<=7);assert(size>=2&&size<=5);assert(isCorrect(q,`${selected*size}/${groups*size}`));assert(!isCorrect(q,`${selected+1}/${groups}`));}
 if(s>=7&&s<=9){
  assert(q.expression&&publicQuestion(q).expression===q.expression);
  assert(!q.prompt.includes('분의'),'Classification and conversion prompts display the fraction directly');
  if(l===2){const [whole,part]=q.answer.split(' '),[n,d]=part.split('/').map(Number);assert.equal(q.expression,`${Number(whole)*d+n}/${d}`);}
  if(l===3){const [whole,part]=q.expression.split(' '),[n,d]=part.split('/').map(Number);assert.equal(q.answer,`${Number(whole)*d+n}/${d}`);}
 }
 count++;
}
const stages=[];
for(let s=1;s<=12;s++){
 let b=initialBlocks(s);assert(b.length>5);assert(b.every(x=>x.y<490));const total=b.length;let shots=0;
 while(b.length&&shots<55){const target=[...b].sort((a,b)=>b.y-a.y||a.x-b.x)[0];assert(difficulty(target)>=1);const result=simulateShot(b,target.id);verifyFalls(result);b=result.blocks;shots++}
 assert.equal(b.length,0,`stage ${s} failed to clear`);stages.push({stage:s,blocks:total,shots});
}
assert(score(2,0,1)>score(3,0,1));assert(score(2,0,1)>score(2,1,1));assert(score(2,0,2)>score(2,0,1));
console.log(JSON.stringify({questions:count,stages,passed:true}));

