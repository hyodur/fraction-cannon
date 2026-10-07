import {BlockWorld,STEP} from "../preview-3d/src/world.ts";
const muzzle={x:0,y:1.65,z:5};
function wait(w:BlockWorld){let n=0;for(;w.moving&&n<1800;n++)w.step();return {seconds:n*STEP,locked:w.moving};}
for(const supportDepth of [.28,.48])for(const friction of [.08,.18])for(const speed of [6,8,10]){
 const rows=[];
 for(const id of [1,2,3,4,5,6,9])for(const x of [-.07,0,.07]){
  const w=new BlockWorld({woodFriction:friction,shelfFriction:.25,ballSpeed:speed,columns:true,supportDepth});wait(w);
  for(let i=0;i<240;i++)w.step();
  if(!w.hit(id,w.frontPoint(id,x,0),muzzle))throw new Error("Shot rejected");
  const rest=wait(w),immediate=9-w.active.length;
  for(let i=0;i<360;i++)w.step();
  rows.push({id,x,removed:9-w.active.length,immediate,seconds:+rest.seconds.toFixed(2),locked:rest.locked,target:w.pieces[id-1].cleared});
 }
 for(const id of [1,2,3,4,5,6,9]){
  const r=rows.filter(r=>r.id===id);
  console.log("BALANCE:"+JSON.stringify({supportDepth,friction,speed,id,min:Math.min(...r.map(r=>r.removed)),max:Math.max(...r.map(r=>r.removed)),avg:r.reduce((a,r)=>a+r.removed,0)/r.length,lock:r.some(r=>r.locked),rows:r}));
 }
}
