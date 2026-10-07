import {BlockWorld,STEP} from "../preview-3d/src/world.ts";
function wait(w:BlockWorld){let n=0;for(;w.moving&&n<1800;n++)w.step();return {seconds:n*STEP,locked:w.moving};}
for(const id of [1,2])for(const y of [-.24,-.18,-.10,0,.10,.24]){
 const w=new BlockWorld({woodFriction:.08,shelfFriction:.25,ballSpeed:8,columns:true,supportDepth:.48});wait(w);
 let shots=0;
 for(;shots<3&&w.active.some(p=>p.id===id);shots++){
  w.hit(id,w.frontPoint(id,0,y),{x:0,y:1.65,z:5});const rest=wait(w);for(let i=0;i<360;i++)w.step();
  console.log("SUPPORT:"+JSON.stringify({id,y,shot:shots+1,removed:9-w.active.length,remaining:w.active.map(p=>p.id),locked:rest.locked}));
 }
}
