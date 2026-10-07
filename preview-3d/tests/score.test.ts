import assert from "node:assert/strict";
import {stageScore} from "../src/score.ts";
import {isCorrect,makeQuestion,type Question} from "../src/questions.ts";
import {isCorrect as legacyCorrect} from "../../lib/questions.ts";
const clean=stageScore({shots:4,mistakes:0,answerSeconds:30});
const one=stageScore({shots:4,mistakes:1,answerSeconds:30});
const two=stageScore({shots:4,mistakes:2,answerSeconds:30});
assert.equal(clean.total-one.total,350,"First error loses clean bonus and incurs a penalty");
assert.equal(one.total-two.total,150,"Each later error incurs the same penalty");
assert.equal(one.mistakePenalty,150);assert.equal(clean.cleanBonus,200);
assert(stageScore({shots:5,mistakes:0,answerSeconds:30}).total<clean.total);
assert(stageScore({shots:4,mistakes:0,answerSeconds:60}).total<clean.total);
assert.equal(stageScore({shots:100,mistakes:100,answerSeconds:1000}).total,0);
const fixture=(kind:Question["kind"],answer:string):Question=>({...makeQuestion(1,1,1),kind,answer});
for(const grade of [isCorrect,legacyCorrect]){
 for(const [expected,equivalent] of [["2/3","4/6"],["4/6","2/3"],["2/4","1/2"],["8/3","16/6"]]){
  const q=fixture("fraction",expected);assert(grade(q,expected));assert(!grade(q,equivalent),"Equivalent values must not replace the required fraction");
 }
 const mixed=fixture("mixed","1 2/4");assert(grade(mixed,"1 2/4"));assert(!grade(mixed,"1 1/2"));assert(!grade(mixed,"1 4/8"));assert(!grade(mixed,"6/4"));
 for(const bad of ["1/0","-1/3","1.5/3","1/3/2","",null])assert(!grade(fixture("fraction","1/3"),bad));
}
for(let stage=1;stage<=12;stage++)for(const level of [1,2,3] as const)for(let seed=1;seed<=100;seed++){
 const q=makeQuestion(stage,level,seed);
 if(q.kind!=="fraction"&&q.kind!=="mixed")continue;
 const prefix=q.kind==="mixed"?q.answer.split(" ")[0]+" ":"";
 const f=q.answer.split(" ").at(-1)!.split("/").map(Number);
 const scaled=prefix+(f[0]*2)+"/"+(f[1]*2);
 assert(isCorrect(q,q.answer));assert(!isCorrect(q,scaled));
}
console.log("SCORING_AND_EXACT_ANSWERS:"+JSON.stringify({passed:true,clean:clean.total,oneError:one.total,twoErrors:two.total}));
