import Matter from "matter-js";
const {Bodies,Body,Composite,Engine}=Matter;
export type Block={id:number;x:number;y:number;w:number;h:number;a:number;hp:number;maxHp:number;material:number;vx?:number;vy?:number;va?:number};
export type Frame={blocks:Block[];ball?:{x:number;y:number;depth:number};broken:{x:number;y:number}[]};
export const MATERIALS=["나무","강화 나무","돌","철"];
export const SHELF={x:700,y:460,width:300,thickness:26};
export const FALL_CLEAR_Y=780;
export const SHOT_IMPULSE=65;
// All shots transfer the same momentum. Damage gradually lowers contact grip;
// it never changes mass, gravity, air resistance, or the shot's strength.
export function blockProperties(block:Block){
 const integrity=Math.max(0,Math.min(1,block.hp/block.maxHp));
 const grip=.55+.45*integrity;
 return {density:.0015+block.material*.0006,friction:(.28+block.material*.055)*grip,frictionStatic:.65*grip,frictionAir:.06};
}
export const STAGE_NAMES=["첫 번째 작전","두 개의 탑","흔들리는 다리","단단한 첫 만남","엇갈린 받침","강화 성의 비밀","묵직한 도전","돌과 나무","연결부를 찾아라","철벽의 등장","기울어진 작전","마지막 대포"];
export function initialBlocks(stage:number):Block[]{
 const material=Math.floor((stage-1)/3),variant=(stage-1)%3,arr:Block[]=[];
 const add=(x:number,y:number,w:number,h:number,mat=material)=>arr.push({id:arr.length+1,x,y,w,h,a:0,hp:mat+1,maxHp:mat+1,material:mat});
 if(variant===0){add(620,424,30,72,Math.max(0,material-1));add(750,424,30,72,Math.max(0,material-1));add(685,370,210,36);for(let i=0;i<3;i++)add(625+i*60,334,56,36);add(655,298,56,36);add(715,298,56,36);add(685,262,56,36);}
 if(variant===1){[600,770].forEach(x=>{add(x,420,34,80,Math.max(0,material-1));add(x,364,110,32);add(x-27,326,48,44);add(x+27,326,48,44);add(x,288,105,32);add(x,250,48,44)});}
 if(variant===2){[570,690,810].forEach(x=>add(x,424,28,72,Math.max(0,material-1)));add(630,370,154,36);add(750,334,150,36);add(790,370,62,36);[610,675,740,805].forEach((x,i)=>add(x,i<2?334:298,54,36));add(710,262,180,36);add(710,226,54,36);}
 return settle(arr);
}
function world(blocks:Block[]){
 const engine=Engine.create({enableSleeping:true,positionIterations:8,velocityIterations:8});
 engine.gravity.y=1;engine.gravity.scale=.001;
 const base=Bodies.rectangle(SHELF.x,SHELF.y+SHELF.thickness/2,SHELF.width,SHELF.thickness,{isStatic:true,friction:.35});
 const bodies=blocks.map(b=>{const body=Bodies.rectangle(b.x,b.y,b.w,b.h,{angle:b.a,...blockProperties(b),restitution:.08,label:String(b.id)});Body.setVelocity(body,{x:b.vx||0,y:b.vy||0});Body.setAngularVelocity(body,b.va||0);return body;});
 Composite.add(engine.world,[base,...bodies]);return {engine,bodies};
}
function snapshots(bodies:Matter.Body[],map:Map<number,Block>):Block[]{return bodies.filter(b=>map.has(+b.label)).map(b=>({...map.get(+b.label)!,x:+b.position.x.toFixed(3),y:+b.position.y.toFixed(3),a:+b.angle.toFixed(5),vx:+b.velocity.x.toFixed(4),vy:+b.velocity.y.toFixed(4),va:+b.angularVelocity.toFixed(5)}));}
function settle(blocks:Block[]){const {engine,bodies}=world(blocks);for(let i=0;i<100;i++)Engine.update(engine,1000/60);const out=snapshots(bodies,new Map(blocks.map(b=>[b.id,b])));Engine.clear(engine);return out;}
export function difficulty(block:Block):1|2|3{return block.y>=385?3:block.y>=315?2:1}
export function simulateShot(blocks:Block[],targetId:number){
 const target=blocks.find(b=>b.id===targetId);if(!target)throw Error("대상이 사라졌어요.");
 const {engine,bodies}=world(blocks),map=new Map(blocks.map(b=>[b.id,{...b}]));
 const frames:Frame[]=[];let broken:{x:number;y:number}[]=[];
 const impactStep=32,targetBody=bodies.find(b=>+b.label===targetId)!;
 // The shot travels along depth from the viewer, so neighboring front faces do
 // not intercept it sideways. Matter handles the resulting collapse in x/y.
 for(let t=0;t<240;t++){
   if(t===impactStep){
     const hit=map.get(targetId);
     if(hit){
       // The target stays in the simulation: a hit pushes it, never deletes it.
       for(const body of bodies)if(map.has(+body.label))Matter.Sleeping.set(body,false);
       hit.hp=Math.max(0,hit.hp-1);broken.push({...targetBody.position});
       const properties=blockProperties(hit);
       targetBody.friction=properties.friction;targetBody.frictionStatic=properties.frictionStatic;
       const direction=targetBody.position.x<SHELF.x?-1:1;
       const impulse={x:direction*SHOT_IMPULSE,y:-SHOT_IMPULSE*.12};
       Body.setVelocity(targetBody,{x:targetBody.velocity.x+impulse.x/targetBody.mass,y:targetBody.velocity.y+impulse.y/targetBody.mass});
       Body.setAngularVelocity(targetBody,targetBody.angularVelocity+Math.min(hit.h*.12,5)*impulse.x/targetBody.inertia);
     }
   }
   Engine.update(engine,1000/60);
   for(const body of bodies){
     if(map.has(+body.label)&&body.bounds.min.y>FALL_CLEAR_Y){
       // Count only after the entire block has fallen well below the shelf.
       // No removal on damage, tilt, displacement, or horizontal screen exit.
       map.delete(+body.label);Composite.remove(engine.world,body);
     }
   }
   if(t%3===0){frames.push({blocks:snapshots(bodies,map),ball:t<impactStep?{x:targetBody.position.x,y:targetBody.position.y,depth:1-t/impactStep}:undefined,broken});broken=[];}
 }
 const result=snapshots(bodies,map);Engine.clear(engine);
 return {blocks:result,frames,cleared:blocks.length-result.length};
}
export function score(shots:number,errors:number,speedTotal:number){if(!shots)return 0;return Math.round(70000/(1+(shots-1)*.25)+20000*shots/(shots+errors)+10000*speedTotal/shots)}
