import assert from 'node:assert/strict';
import {makeQuestion,isCorrect,publicQuestion} from '../lib/questions.ts';
import {initialBlocks,simulateShot,difficulty,score,SHELF,FALL_CLEAR_Y} from '../lib/physics.ts';
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
assert(supported.length<5,'Removing supports must collapse the upper stack');
const topShot=simulateShot(initialBlocks(1),9),lowerShot=simulateShot(initialBlocks(1),1);
assert.equal(topShot.cleared,1,'A top shot should only knock off the top block');
assert(lowerShot.cleared>topShot.cleared,'Removing a lower support should cause a cascade');
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
let count=0;
for(let s=1;s<=12;s++) for(let l=1;l<=3;l++) for(let seed=1;seed<=80;seed++){
 const q=makeQuestion(s,l,seed); assert(isCorrect(q,q.answer),JSON.stringify(q)); assert(!('answer' in publicQuestion(q)));assert(!('explanation' in publicQuestion(q)));assert(!isCorrect(q,'999/0'));assert(!isCorrect(q,'NaN'));assert(!q.prompt.includes('없음'));assert(q.hints.length===2);
 if(s<=3){let {groups,size,selected}=q.diagram;assert(groups>=3&&groups<=7);assert(size>=2&&size<=5);assert(isCorrect(q,`${selected*size}/${groups*size}`));assert(!isCorrect(q,`${selected+1}/${groups}`));}
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

