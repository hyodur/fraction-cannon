import {BlockWorld,STEP,BALL_SPEED,impactImpulse} from "../preview-3d/src/world.ts";
const muzzle={x:0,y:1.65,z:5};
function wait(w:BlockWorld){
 let n=0;for(;w.moving&&n<1800;n++)w.step();
 return {seconds:n*STEP,locked:w.moving};
}
function shoot(w:BlockWorld,id:number,speed:number,x:number){
 const piece=w.active.find(p=>p.id===id)!;
 const point=w.frontPoint(id,x,0),offset=piece.body.position.clone();
 offset.set(point.x-piece.body.position.x,point.y-piece.body.position.y,point.z-piece.body.position.z);
 if(!w.hit(id,point,muzzle))throw new Error("Shot rejected");
 const impulse=offset.clone();impulse.set(point.x-muzzle.x,point.y-muzzle.y,point.z-muzzle.z);impulse.normalize();
 impulse.scale(impactImpulse(piece.body.mass)*(speed/BALL_SPEED-1),impulse);
 piece.body.applyImpulse(impulse,offset);
}
for(const speed of [6,7,8,9,10,12]){
 const rows=[];
 for(const id of [1,2,3,4,5,6,9])for(const x of [-.07,0,.07])for(const idle of [0,2]){
  const w=new BlockWorld();wait(w);
  for(let i=0;i<idle*120;i++)w.step();
  shoot(w,id,speed,x);const rest=wait(w),immediate=9-w.active.length;
  for(let i=0;i<360;i++)w.step();
  const removed=9-w.active.length;
  rows.push({id,x,idle,removed,immediate,seconds:+rest.seconds.toFixed(2),locked:rest.locked,target:w.pieces[id-1].cleared});
 }
 for(const id of [1,2,3,4,5,6,9]){
  const r=rows.filter(r=>r.id===id);
  console.log("BALANCE:"+JSON.stringify({speed,id,min:Math.min(...r.map(r=>r.removed)),max:Math.max(...r.map(r=>r.removed)),avg:r.reduce((a,r)=>a+r.removed,0)/r.length,lock:r.some(r=>r.locked),rows:r}));
 }
}
