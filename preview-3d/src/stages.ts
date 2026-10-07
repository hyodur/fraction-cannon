export type BlockLevel=1|2|3;
export type BlockMaterial={id:string;name:string;resistance:number;color:number;roughness:number;metalness:number};
export const MATERIALS:BlockMaterial[]=[
 {id:"wood",name:"나무",resistance:1,color:0xd3a15f,roughness:.79,metalness:0},
 {id:"brick",name:"벽돌",resistance:1.02,color:0xb86d51,roughness:.92,metalness:0},
 {id:"stone",name:"돌",resistance:1.04,color:0x98a5a3,roughness:.88,metalness:.03},
 {id:"iron",name:"철",resistance:1.06,color:0x8399ab,roughness:.48,metalness:.65}
];
const counts=[8,9,10,11,12,13,14,15,16,17,18,20];
const layouts=["두 개의 작은 탑","가운데 작은 조각","왼쪽 탑 넓히기","왼쪽 곁다리 탑","양쪽 탑 넓히기","양옆 곁다리 탑","왼쪽에 한 층 더","양쪽에 한 층 더","왼쪽 곁다리 한 층 더","양옆 곁다리 한 층 더","가운데 작은 탑","마지막 징검 조각"];
const titles=["첫 번째 작전","하나 더 쌓아 볼까","나무 탑 탐험","벽돌과 첫 만남","차곡차곡 벽돌","벽돌 작전 완성","돌 블록 탐험","분수로 여는 길","돌 탑의 비밀","철 블록과 첫 만남","마지막 준비","분수 탐험대 완주"];
const topics=["전체와 부분","분수만큼의 양","여러 가지 분수","분수의 크기 비교"];
export const STAGES=counts.map((count,i)=>({id:i+1,count,layout:layouts[i],title:titles[i],topic:topics[Math.floor(i/3)],material:MATERIALS[Math.floor(i/3)],step:i%3}));
export function getStage(id:number){if(!Number.isInteger(id)||id<1||id>12)throw new Error("Unknown stage");return STAGES[id-1];}
export type BlockGroup="left"|"right"|"center"|"leftSide"|"rightSide"|"leftLoose"|"rightLoose";
export type BlockSpec={id:number;x:number;y:number;width:number;height:number;depth:number;level:BlockLevel;group:BlockGroup;role:"support"|"beam"|"stack"};
export function stageBlocks(stageId:number):BlockSpec[]{
 getStage(stageId);
 const blocks:BlockSpec[]=[];
 const add=(id:number,x:number,y:number,width:number,height:number,level:BlockLevel,group:BlockGroup,role:BlockSpec["role"]="stack",depth=.48)=>{
  blocks.push({id,x,y,width,height,depth,level,group,role});
 };
 // The two bridges never share a beam or pillar. A physical gap separates them.
 for(const [base,cx,group,widenAt,capAt] of [[0,-.9,"left",3,7],[4,.9,"right",5,8]] as const){
  add(base+1,cx-.31,.30,.22,.60,3,group,"support");
  add(base+2,cx+.31,.30,.22,.60,3,group,"support");
  add(base+3,cx,.72,1,.24,3,group,"beam");
  add(base+4,cx-(stageId>=widenAt?.26:0),1,.42,.32,stageId>=capAt?2:1,group);
 }
 if(stageId>=2)add(9,0,.16,.32,.32,stageId>=11?2:1,"center");
 if(stageId>=3)add(10,-.64,1,.42,.32,stageId>=7?2:1,"left");
 if(stageId>=4)add(11,-2.3,.16,.32,.32,stageId>=9?2:1,"leftSide");
 if(stageId>=5)add(12,1.16,1,.42,.32,stageId>=8?2:1,"right");
 if(stageId>=6)add(13,2.3,.16,.32,.32,stageId>=10?2:1,"rightSide");
 if(stageId>=7)add(14,-.9,1.32,.42,.32,1,"left");
 if(stageId>=8)add(15,.9,1.32,.42,.32,1,"right");
 if(stageId>=9)add(16,-2.3,.48,.32,.32,1,"leftSide");
 if(stageId>=10)add(17,2.3,.48,.32,.32,1,"rightSide");
 if(stageId>=11)add(18,0,.48,.32,.32,1,"center");
 if(stageId>=12){
  add(19,-1.75,.14,.28,.28,1,"leftLoose", "stack",.40);
  add(20,1.75,.14,.28,.28,1,"rightLoose", "stack",.40);
 }
 return blocks.sort((a,b)=>a.id-b.id);
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
