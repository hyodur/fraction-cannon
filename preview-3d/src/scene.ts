import {getStage} from "./stages";
import * as THREE from "three";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
import {BlockWorld,SHELF_Y,SHELF_THICKNESS,STEP} from "./world";
export type SceneState={remaining:number[];moving:boolean};
export type SceneEvents={state:(s:SceneState)=>void;select:(id:number|null)=>void;effect:(name:"impact"|"collapse")=>void;error:(message:string)=>void};
const MUZZLE=new THREE.Vector3(0,1.65,5);
export class CannonScene{
 private renderer:THREE.WebGLRenderer;
 private scene=new THREE.Scene();
 private camera=new THREE.PerspectiveCamera(43,1,.1,60);
 private simulation:BlockWorld;
 private meshes=new Map<number,THREE.Mesh>();
 private barrel=new THREE.Group();
 private ball=new THREE.Mesh(new THREE.SphereGeometry(.085,20,16),new THREE.MeshStandardMaterial({color:0x303d46,metalness:.8,roughness:.28}));
 private reticle=new THREE.Mesh(new THREE.TorusGeometry(.09,.007,8,40),new THREE.MeshBasicMaterial({color:0xffe08a,depthTest:false}));
 private selected:number|null=null;
 private hitPoint=new THREE.Vector3();
 private flight:{id:number;end:THREE.Vector3;elapsed:number}|null=null;
 private observer:ResizeObserver;
 private frame=0;
 private disposed=false;
 private accumulator=0;
 private previous=0;
 private stateKey="";
 private lastRumble=-1;
 private textures=new Set<THREE.Texture>();
 private events:SceneEvents;
 private canSelect:()=>boolean;
 constructor(private host:HTMLElement,events:SceneEvents,canSelect:()=>boolean,stageId=1){
  const stage=getStage(stageId);this.simulation=new BlockWorld({stage:stageId});
  this.events=events;this.canSelect=canSelect;
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.renderer.domElement.setAttribute("aria-label","정면의 입체 블록을 눌러 조준하세요. 아래의 번호 버튼으로도 선택할 수 있어요.");
  this.host.appendChild(this.renderer.domElement);
  this.scene.background=new THREE.Color("#dce5e5");this.scene.fog=new THREE.Fog("#dce5e5",16,35);
  this.camera.position.set(.15,4.3,10);this.camera.lookAt(0,2.1,0);
  this.scene.add(new THREE.HemisphereLight(0xf5faff,0x6d6651,2.3));
  const sun=new THREE.DirectionalLight(0xffedcb,3.7);sun.position.set(-4,9,5);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-6,right:6,top:8,bottom:-5,near:.1,far:25});
  sun.shadow.normalBias=.025;sun.shadow.bias=-.0002;this.scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0xabb49e,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;this.scene.add(ground);
  const steel=new THREE.MeshStandardMaterial({color:0x60737d,metalness:.65,roughness:.43});
  const shelf=new THREE.Mesh(new RoundedBoxGeometry(3.6,SHELF_THICKNESS,1.2,2,.035),steel);shelf.position.y=SHELF_Y-SHELF_THICKNESS/2;shelf.castShadow=true;shelf.receiveShadow=true;this.scene.add(shelf);
  for(const x of [-1.5,1.5]){
   const leg=new THREE.Mesh(new THREE.BoxGeometry(.13,2.1,.13),steel);leg.position.set(x,1.05,-.35);leg.castShadow=true;this.scene.add(leg);
   const foot=new THREE.Mesh(new THREE.BoxGeometry(.42,.08,.48),steel);foot.position.set(x,.04,-.35);this.scene.add(foot);
  }
  const woodTexture=this.woodTexture();
  for(const piece of this.simulation.pieces){
   const material=new THREE.MeshStandardMaterial({color:new THREE.Color(stage.material.color).multiplyScalar(piece.level===3?.86:1),map:stage.material.id==="wood"?woodTexture:null,bumpMap:woodTexture,bumpScale:stage.material.id==="iron"?.002:.009,roughness:stage.material.roughness,metalness:stage.material.metalness});
   const mesh=new THREE.Mesh(new RoundedBoxGeometry(piece.width-.004,piece.height-.004,piece.depth-.004,3,.018),material);
   mesh.userData.blockId=piece.id;mesh.castShadow=true;mesh.receiveShadow=true;
   const label=this.numberLabel(piece.id);label.position.set(0,0,piece.depth/2+.005);mesh.add(label);
   this.meshes.set(piece.id,mesh);this.scene.add(mesh);
  }
  const cannonMetal=new THREE.MeshStandardMaterial({color:0x344a58,metalness:.82,roughness:.27});
  // Barrel axis points from the muzzle toward the selected block.
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(.17,.28,.95,32,1,true),cannonMetal);
  tube.position.y=-.475;this.barrel.add(tube);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.175,.033,10,40),cannonMetal);rim.rotation.x=Math.PI/2;this.barrel.add(rim);
  const dark=new THREE.Mesh(new THREE.CircleGeometry(.14,24),new THREE.MeshBasicMaterial({color:0x07121a,side:THREE.DoubleSide}));dark.rotation.x=Math.PI/2;dark.position.y=-.07;this.barrel.add(dark);
  this.barrel.position.copy(MUZZLE);this.scene.add(this.barrel);
  const carriage=new THREE.Mesh(new THREE.BoxGeometry(.9,.2,.85),new THREE.MeshStandardMaterial({color:0x7a542e,roughness:.8}));
  carriage.position.set(0,.79,5.2);carriage.castShadow=true;this.scene.add(carriage);
  for(const x of [-.53,.53]){
   const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.12,24),cannonMetal);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.5,5.2);wheel.castShadow=true;this.scene.add(wheel);
  }
  this.ball.visible=false;this.ball.castShadow=true;this.scene.add(this.ball);
  this.reticle.visible=false;this.reticle.renderOrder=100;this.scene.add(this.reticle);
  this.aim(new THREE.Vector3(0,3.1,0));
  this.renderer.domElement.addEventListener("pointerdown",this.pointer);
  this.renderer.domElement.addEventListener("webglcontextlost",this.contextLost);
  document.addEventListener("visibilitychange",this.visibility);
  this.observer=new ResizeObserver(this.resize);this.observer.observe(host);this.resize();
  this.sync();this.emitState();this.frame=requestAnimationFrame(this.tick);
 }
 private woodTexture(){
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext("2d")!;ctx.fillStyle="#d0af7e";ctx.fillRect(0,0,256,256);
  let seed=37;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  for(let i=0;i<170;i++){
   const y=random()*256;ctx.strokeStyle="rgba(75,41,17,"+(.02+random()*.16)+")";ctx.lineWidth=.3+random();
   ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(80,y+random()*8,170,y-random()*8,256,y);ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.textures.add(texture);return texture;
 }
 private numberLabel(n:number){
  const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;const ctx=canvas.getContext("2d")!;
  ctx.font="bold 72px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="rgba(52,34,18,.68)";ctx.fillText(String(n),64,68);
  const texture=new THREE.CanvasTexture(canvas);this.textures.add(texture);
  return new THREE.Mesh(new THREE.PlaneGeometry(.16,.16),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
 }
 private resize=()=>{
  const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;
  this.renderer.setSize(width,height,false);this.camera.aspect=width/height;
  // Keep the entire tower and shelf inside narrow portrait canvases.
  this.camera.position.z=this.camera.aspect<1?12.5:10;this.camera.updateProjectionMatrix();
 };
 private contextLost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(this.frame);this.events.error("3D 화면 연결이 끊겼어요. 페이지를 새로고침해 주세요.");};
 private visibility=()=>{this.previous=0;this.accumulator=0;};
 private pointer=(event:PointerEvent)=>{
  if(!this.canSelect()||this.simulation.moving||this.flight)return;
  const rect=this.renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  const ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.camera);
  const objects=this.simulation.active.map(p=>this.meshes.get(p.id)!);
  const hit=ray.intersectObjects(objects,false)[0];if(hit)this.select(hit.object.userData.blockId,hit.point);
 };
 select(id:number,point?:THREE.Vector3){
  if(!this.canSelect()||this.simulation.moving||this.flight)return;
  const piece=this.simulation.active.find(p=>p.id===id);if(!piece)return;
  this.selected=id;
  // Keyboard selection aims at the center of the front face.
  const front=this.simulation.frontPoint(id),center=new THREE.Vector3(front.x,front.y,front.z);
  this.hitPoint.copy(point||center);this.reticle.position.copy(this.hitPoint);this.reticle.lookAt(this.camera.position);this.reticle.visible=true;
  this.aim(this.hitPoint);this.highlight();this.events.select(id);
 }
 private aim(point:THREE.Vector3){
  const direction=point.clone().sub(MUZZLE).normalize();
  this.barrel.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
 }
 private highlight(){
  for(const [id,mesh] of this.meshes)(mesh.material as THREE.MeshStandardMaterial).emissive.setHex(id===this.selected?0x493b0b:0);
 }
 fire(id:number){
  if(this.simulation.moving||this.flight||this.selected!==id||!this.simulation.active.some(p=>p.id===id))return false;
  this.flight={id,end:this.hitPoint.clone(),elapsed:0};this.ball.visible=true;this.reticle.visible=false;this.emitState();return true;
 }
 private sync(){
  if(this.selected!==null&&!this.simulation.active.some(p=>p.id===this.selected)){
   this.selected=null;this.reticle.visible=false;this.highlight();this.events.select(null);
  }
  for(const p of this.simulation.pieces){
   const mesh=this.meshes.get(p.id)!;mesh.position.copy(p.body.position);mesh.quaternion.copy(p.body.quaternion);
  }
 }
 private emitState(){
  const remaining=this.simulation.active.map(p=>p.id),moving=this.simulation.moving||!!this.flight,key=remaining.join(",")+":"+moving;
  if(key!==this.stateKey){this.stateKey=key;this.events.state({remaining,moving});}
 }
 private tick=(time:number)=>{
  if(this.disposed)return;
  if(document.hidden){this.previous=0;this.frame=requestAnimationFrame(this.tick);return;}
  const delta=this.previous?Math.min((time-this.previous)/1000,.25):0;this.previous=time;
  if(this.flight){
   this.flight.elapsed+=delta;const t=Math.min(1,this.flight.elapsed/.38);
   this.ball.position.lerpVectors(MUZZLE,this.flight.end,t);this.ball.position.y+=.12*Math.sin(Math.PI*t);
   if(t===1){
    this.simulation.hit(this.flight.id,this.flight.end,MUZZLE);this.flight=null;this.ball.visible=false;this.selected=null;this.highlight();this.events.effect("impact");
   }
  }
  this.accumulator+=delta;
  while(this.accumulator>=STEP){
   const fallen=this.simulation.step();
   if(fallen.length&&time-this.lastRumble>300){this.events.effect("collapse");this.lastRumble=time;}
   this.accumulator-=STEP;
  }
  this.sync();this.emitState();this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.tick);
 };
 dispose(){
  this.disposed=true;cancelAnimationFrame(this.frame);this.observer.disconnect();
  document.removeEventListener("visibilitychange",this.visibility);
  this.renderer.domElement.removeEventListener("pointerdown",this.pointer);
  this.renderer.domElement.removeEventListener("webglcontextlost",this.contextLost);
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  this.scene.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());
  this.renderer.dispose();this.renderer.domElement.remove();
 }
}
