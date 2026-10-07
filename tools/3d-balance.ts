import {BlockWorld,STEP} from "../preview-3d/src/world.ts";
import {stageBlocks} from "../preview-3d/src/stages.ts";
const muzzle={x:0,y:1.65,z:5};
function wait(w:BlockWorld){let n=0;for(;w.moving&&n<1800;n++)w.step();return {seconds:n*STEP,locked:w.moving};}
for(const stage of [1,4,7,10,12])for(const id of [3,7])for(const x of [-.35,0,.35]){
 const w=new BlockWorld({stage});wait(w);const specs=stageBlocks(stage);
 const other=specs.filter(p=>p.group===(id===3?"right":"left")).map(p=>p.id);
 const hits=[];
 for(let n=0;n<5&&w.active.some(p=>p.id===id);n++){
  if(!w.hit(id,w.frontPoint(id,x,0),muzzle))throw new Error("Shot rejected");
  const rest=wait(w);for(let i=0;i<240;i++)w.step();
  hits.push({removed:specs.length-w.active.length,otherStanding:other.every(id=>w.active.some(p=>p.id===id)),...rest});
 }
 console.log("LAYOUT_BALANCE:"+JSON.stringify({stage,id,x,hits}));
}
