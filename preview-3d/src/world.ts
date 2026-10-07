import {Body,Box,ContactMaterial,GSSolver,Material,Vec3,World} from "cannon-es";
export const SHELF_Y=2.2;
export const STEP=1/120;
export const IMPULSE=2.6;
export type Point={x:number;y:number;z:number};
export type Piece={id:number;width:number;height:number;depth:number;level:1|2|3;body:Body;cleared:boolean};
export class BlockWorld{
 world:World;
 pieces:Piece[]=[];
 moving=true;
 private time=0;
 private quietSince=0;
 private anchors=new Map<number,{position:Vec3;quaternion:Body["quaternion"]}>();
 private lastSupported=new Map<Body,number>();
 private statics:Body[]=[];
 constructor(){
  this.world=new World({gravity:new Vec3(0,-9.82,0),allowSleep:false});
  (this.world.solver as GSSolver).iterations=20;
  const wood=new Material("wood"),support=new Material("support");
  this.world.addContactMaterial(new ContactMaterial(wood,wood,{friction:.28,restitution:.035}));
  this.world.addContactMaterial(new ContactMaterial(wood,support,{friction:.32,restitution:.025}));
  const fixed=(x:number,y:number,z:number,w:number,h:number,d:number)=>{
   const body=new Body({mass:0,material:support,shape:new Box(new Vec3(w/2,h/2,d/2)),position:new Vec3(x,y,z)});
   this.statics.push(body);this.world.addBody(body);
  };
  fixed(0,-.12,0,40,.24,40);
  fixed(0,SHELF_Y-.10,0,3.6,.20,1.20);
  fixed(-1.5,1.05,-.35,.13,2.10,.13);fixed(1.5,1.05,-.35,.13,2.10,.13);
  const add=(x:number,y:number,w:number,h:number,level:1|2|3)=>{
   const depth=.48,body=new Body({mass:w*h*depth*3,material:wood,shape:new Box(new Vec3(w/2,h/2,depth/2)),position:new Vec3(x,SHELF_Y+y,0),linearDamping:.12,angularDamping:.18});
   const piece:Piece={id:this.pieces.length+1,width:w,height:h,depth,level,body,cleared:false};
   this.pieces.push(piece);this.world.addBody(body);
  };
  add(-.68,.36,.28,.72,3);add(.68,.36,.28,.72,3);
  add(0,.90,2.10,.36,2);
  for(const x of [-.60,0,.60])add(x,1.26,.56,.36,2);
  for(const x of [-.30,.30])add(x,1.62,.56,.36,1);
  add(0,1.98,.56,.36,1);
  for(let i=0;i<180;i++)this.step();
 }
 get active(){return this.pieces.filter(p=>!p.cleared)}
 hit(id:number,point:Point,muzzle:Point):boolean{
  if(this.moving)return false;
  const piece=this.active.find(p=>p.id===id);if(!piece)return false;
  const impulse=new Vec3(point.x-muzzle.x,point.y-muzzle.y,point.z-muzzle.z);
  impulse.normalize();impulse.scale(IMPULSE,impulse);
  const offset=new Vec3(point.x-piece.body.position.x,point.y-piece.body.position.y,point.z-piece.body.position.z);
  piece.body.applyImpulse(impulse,offset);this.moving=true;this.resetQuiet();
  return true;
 }
 frontPoint(id:number,x=0,y=0):Point{
  const p=this.active.find(p=>p.id===id);
  if(!p)throw new Error("Unknown active block: "+id);
  return p.body.pointToWorldFrame(new Vec3(x,y,p.depth/2));
 }
 private resetQuiet(){
  this.quietSince=this.time;
  this.anchors.clear();
  for(const p of this.active)this.anchors.set(p.id,{position:p.body.position.clone(),quaternion:p.body.quaternion.clone()});
 }
 private supported(){
  // Contacts can disappear for a single solver step while boxes rest together.
  const seen=new Set(this.statics),links=new Map<Body,Set<Body>>();
  for(const c of this.world.contacts){
   if(!links.has(c.bi))links.set(c.bi,new Set());
   if(!links.has(c.bj))links.set(c.bj,new Set());
   links.get(c.bi)!.add(c.bj);links.get(c.bj)!.add(c.bi);
  }
  const queue=[...seen];
  for(let i=0;i<queue.length;i++)for(const b of links.get(queue[i])||[]){
   if(!seen.has(b)){seen.add(b);queue.push(b);}
  }
  for(const body of seen)this.lastSupported.set(body,this.time);
  return this.active.every(p=>this.time-(this.lastSupported.get(p.body)??-Infinity)<.12);
 }
 step(){
  // Keep gravity running after controls unlock, including for cleared floor debris.
  this.world.step(STEP);this.time+=STEP;
  const fallen:number[]=[];
  for(const p of this.pieces){
   p.body.updateAABB();
   if(!p.cleared&&p.body.aabb.upperBound.y<.65){p.cleared=true;fallen.push(p.id);}
  }
  if(this.moving){
   const supported=this.supported();
   const stable=this.active.every(p=>{
    const anchor=this.anchors.get(p.id);if(!anchor)return false;
    const q=p.body.quaternion,a=anchor.quaternion;
    const dot=Math.abs(q.x*a.x+q.y*a.y+q.z*a.z+q.w*a.w);
    return p.body.position.distanceSquared(anchor.position)<.012**2&&dot>Math.cos(.035/2);
   });
   // Measure actual displacement over a supported rest window. Solver velocity
   // noise and debris that has already fallen must not lock the next question.
   if(!stable||!supported)this.resetQuiet();
   if(this.time-this.quietSince>.6)this.moving=false;
  }
  return fallen;
 }
}
