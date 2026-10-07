export type ScoreInput={shots:number;mistakes:number;answerSeconds:number};
export function stageScore({shots,mistakes,answerSeconds}:ScoreInput){
 const count=(n:number)=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
 const completion=1000;
 const cannonBonus=Math.max(0,600-Math.max(0,count(shots)-1)*40);
 const timeBonus=Math.max(0,200-count(answerSeconds));
 const cleanBonus=count(mistakes)===0?200:0;
 const mistakePenalty=count(mistakes)*150;
 return {completion,cannonBonus,timeBonus,cleanBonus,mistakePenalty,total:Math.max(0,completion+cannonBonus+timeBonus+cleanBonus-mistakePenalty)};
}
