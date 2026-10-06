import assert from 'node:assert/strict';
import {makeQuestion,isCorrect,publicQuestion} from '../lib/questions.ts';
import {initialBlocks,simulateShot,difficulty,score} from '../lib/physics.ts';
let count=0;
for(let s=1;s<=12;s++) for(let l=1;l<=3;l++) for(let seed=1;seed<=80;seed++){
 const q=makeQuestion(s,l,seed); assert(isCorrect(q,q.answer),JSON.stringify(q)); assert(!('answer' in publicQuestion(q)));assert(!('explanation' in publicQuestion(q)));assert(!isCorrect(q,'999/0'));assert(!isCorrect(q,'NaN'));assert(!q.prompt.includes('없음'));assert(q.hints.length===2);
 if(s<=3){let {groups,size,selected}=q.diagram;assert(groups>=3&&groups<=7);assert(size>=2&&size<=5);assert(isCorrect(q,`${selected*size}/${groups*size}`));assert(!isCorrect(q,`${selected+1}/${groups}`));}
 count++;
}
const stages=[];
for(let s=1;s<=12;s++){
 let b=initialBlocks(s);assert(b.length>5);assert(b.every(x=>x.y<490));const total=b.length;let shots=0;
 while(b.length&&shots<55){const target=[...b].sort((a,b)=>b.y-a.y||a.x-b.x)[0];assert(difficulty(target)>=1);b=simulateShot(b,target.id).blocks;shots++}
 assert.equal(b.length,0,`stage ${s} failed to clear`);stages.push({stage:s,blocks:total,shots});
}
assert(score(2,0,1)>score(3,0,1));assert(score(2,0,1)>score(2,1,1));assert(score(2,0,2)>score(2,0,1));
console.log(JSON.stringify({questions:count,stages,passed:true}));

