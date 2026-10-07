import {BlockWorld,STEP} from "../preview-3d/src/world.ts";
const muzzle={x:0,y:1.65,z:5};
function wait(w:BlockWorld){let n=0;for(;w.moving&&n<1800;n++)w.step();return {seconds:n*STEP,locked:w.moving};}
for(const supportDepth of [.48,.64,.8])for(const density of [1,1.35,1.7])for(const friction of [.08,.18,.28]){
 const rows=[];
 for(const stage of [1,4])for(const id of [3,5,9])for(const x of [-.08,0,.08]){
  const w=new BlockWorld({stage,supportDepth,woodFriction:friction});wait(w);
  for(const p of w.pieces){p.body.mass*=density;p.body.updateMassProperties();}
  for(let i=0;i<240;i++)w.step();
  const hits=[];
  for(let n=0;n<3&&w.active.some(p=>p.id===id);n++){
   if(!w.hit(id,w.frontPoint(id,x,0),muzzle))throw new Error("Shot rejected");
   const rest=wait(w);for(let i=0;i<240;i++)w.step();
   hits.push({removed:w.pieces.length-w.active.length,locked:rest.locked,seconds:+rest.seconds.toFixed(2),target:w.pieces[id-1].cleared});
  }
  rows.push({stage,id,x,hits});
 }
 console.log("CALIBRATE:"+JSON.stringify({supportDepth,density,friction,rows}));
}
