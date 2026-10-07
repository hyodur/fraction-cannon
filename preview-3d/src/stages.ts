export type BlockLevel=1|2|3;
export type BlockMaterial={id:string;name:string;resistance:number;color:number;roughness:number;metalness:number};
export const MATERIALS:BlockMaterial[]=[
 {id:"wood",name:"나무",resistance:1,color:0xd3a15f,roughness:.79,metalness:0},
 {id:"brick",name:"벽돌",resistance:1.02,color:0xb86d51,roughness:.92,metalness:0},
 {id:"stone",name:"돌",resistance:1.04,color:0x98a5a3,roughness:.88,metalness:.03},
 {id:"iron",name:"철",resistance:1.06,color:0x8399ab,roughness:.48,metalness:.65}
];
const counts=[9,10,11,10,11,12,11,12,13,12,13,14];
const titles=["첫 번째 작전","하나 더 쌓아 볼까","나무 탑 탐험","벽돌과 첫 만남","차곡차곡 벽돌","벽돌 작전 완성","돌 블록 탐험","분수로 여는 길","돌 탑의 비밀","철 블록과 첫 만남","마지막 준비","분수 탐험대 완주"];
const topics=["전체와 부분","분수만큼의 양","여러 가지 분수","분수의 크기 비교"];
export const STAGES=counts.map((count,i)=>({id:i+1,count,title:titles[i],topic:topics[Math.floor(i/3)],material:MATERIALS[Math.floor(i/3)],step:i%3}));
export function getStage(id:number){if(!Number.isInteger(id)||id<1||id>12)throw new Error("Unknown stage");return STAGES[id-1];}
export type BlockSpec={id:number;x:number;y:number;width:number;height:number;depth:number;level:BlockLevel};
export function stageBlocks(stageId:number):BlockSpec[]{
 const stage=getStage(stageId),blocks:BlockSpec[]=[
  {id:1,x:-.68,y:.36,width:.28,height:.72,depth:.48,level:3},
  {id:2,x:.68,y:.36,width:.28,height:.72,depth:.48,level:3},
  {id:3,x:0,y:.90,width:2.10,height:.36,depth:.48,level:3}
 ];
 // Keep the tested central structure intact; add small side stacks gradually.
 for(let row=0;row<2;row++)for(const x of [-.60,0,.60])
  blocks.push({id:blocks.length+1,x,y:1.26+.36*row,width:.56,height:.36,depth:.48,level:row===1?1:2});
 const extra=stage.count-9,sideCount=Math.min(extra,4),heights=[Math.ceil(sideCount/2),Math.floor(sideCount/2)];
 for(let row=0;row<Math.max(...heights);row++)for(let col=0;col<2;col++){
  if(row>=heights[col])continue;
  blocks.push({id:blocks.length+1,x:col===0?-1.42:1.42,y:.18+.36*row,width:.36,height:.36,depth:.48,level:row===heights[col]-1?1:2});
 }
 if(extra>4)blocks.push({id:blocks.length+1,x:0,y:.18,width:.36,height:.36,depth:.48,level:1});
 return blocks;
}
export function blockLevel(stageId:number,id:number):BlockLevel{return stageBlocks(stageId).find(b=>b.id===id)?.level??1;}
export type Progress={current:number;unlocked:number;completed:number[]};
export const PROGRESS_KEY="fraction-cannon-3d-progress-v1";
export function readProgress(raw:string|null):Progress{
 const fallback={current:1,unlocked:1,completed:[] as number[]};
 try{
  const value=JSON.parse(raw??"null");if(!value||typeof value!=="object")return fallback;
  const completed=[...new Set<number>((Array.isArray(value.completed)?value.completed:[]).filter((n:unknown)=>typeof n==="number"&&Number.isInteger(n)&&n>=1&&n<=12))].sort((a,b)=>a-b);
  let unlocked=1;while(unlocked<12&&completed.includes(unlocked))unlocked++;
  return {completed,unlocked,current:Number.isInteger(value.current)&&value.current>=1&&value.current<=unlocked?value.current:unlocked};
 }catch{return fallback;}
}
export function completeStage(progress:Progress,id:number):Progress{
 const stage=getStage(id);if(stage.id>progress.unlocked)return progress;
 return readProgress(JSON.stringify({current:id,completed:[...progress.completed,id]}));
}
