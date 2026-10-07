import {getStage,stageBlocks} from "./stages.ts";
import {Body,Box,ContactMaterial,GSSolver,Material,Vec3,World} from "cannon-es";
export const SHELF_Y=2.2;
export const SHELF_THICKNESS=.20;
// A block is cleared once its entire rotated bounds pass below the shelf.
export const CLEAR_Y=SHELF_Y-SHELF_THICKNESS-.02;
export const STEP=1/120;
export const BALL_MASS=.65;
export const BALL_SPEED=8;
// Fixed density for every block of a material; increased inertia prevents a
// fully loaded beam from collapsing the tower with its first central hit.
export const BLOCK_DENSITY=4.05;
export function impactImpulse(mass:number,speed=BALL_SPEED){return 1.1*BALL_MASS*mass/(BALL_MASS+mass)*speed;}
export type Point={x:number;y:number;z:number};
export type Piece={id:number;width:number;height:number;depth:number;level:1|2|3;body:Body;cleared:boolean};
export class BlockWorld{
 world:World;
 pieces:Piece[]=[];
 moving=true;
 private ballSpeed=BALL_SPEED;
 private time=0;
 private quietSince=0;
 private anchors=new Map<number,{position:Vec3;quaternion:Body["quaternion"]}>();
 private lastSupported=new Map<Body,number>();
 private statics:Body[]=[];
 constructor(options:{woodFriction?:number;shelfFriction?:number;ballSpeed?:number;columns?:boolean;supportDepth?:number;stage?:number}={}){
  this.ballSpeed=options.ballSpeed??BALL_SPEED;
  const stage=getStage(options.stage??1);
  this.world=new World({gravity:new Vec3(0,-9.82,0),allowSleep:false});
  (this.world.solver as GSSolver).iterations=20;
  const wood=new Material("wood"),support=new Material("support");
  this.world.addContactMaterial(new ContactMaterial(wood,wood,{friction:options.woodFriction??.08,restitution:.035}));
  this.world.addContactMaterial(new ContactMaterial(wood,support,{friction:options.shelfFriction??.25,restitution:.025}));
  const fixed=(x:number,y:number,z:number,w:number,h:number,d:number)=>{
   const body=new Body({mass:0,material:support,shape:new Box(new Vec3(w/2,h/2,d/2)),position:new Vec3(x,y,z)});
   this.statics.push(body);this.world.addBody(body);
  };
  fixed(0,-.12,0,40,.24,40);
  fixed(0,SHELF_Y-SHELF_THICKNESS/2,0,3.6,SHELF_THICKNESS,1.20);
  fixed(-1.5,1.05,-.35,.13,2.10,.13);fixed(1.5,1.05,-.35,.13,2.10,.13);
  const add=(x:number,y:number,w:number,h:number,level:1|2|3,depth=.48)=>{
   const body=new Body({mass:w*h*depth*BLOCK_DENSITY*stage.material.resistance,material:wood,shape:new Box(new Vec3(w/2,h/2,depth/2)),position:new Vec3(x,SHELF_Y+y,0),linearDamping:.12,angularDamping:.18});
   const piece:Piece={id:this.pieces.length+1,width:w,height:h,depth,level,body,cleared:false};
   this.pieces.push(piece);this.world.addBody(body);
  };
  for(const block of stageBlocks(stage.id)){
   add(block.x,block.y,block.width,block.height,block.level,block.id<=2?(options.supportDepth??block.depth):block.depth);
  }
  for(let i=0;i<180;i++)this.step();
 }
 get active(){return this.pieces.filter(p=>!p.cleared)}
 hit(id:number,point:Point,muzzle:Point):boolean{
  if(this.moving)return false;
  const piece=this.active.find(p=>p.id===id);if(!piece)return false;
  const impulse=new Vec3(point.x-muzzle.x,point.y-muzzle.y,point.z-muzzle.z);
  impulse.normalize();// Momentum transfer from the same cannonball for every target.
  // Reduced mass prevents light blocks receiving the beam's full impulse.
  impulse.scale(impactImpulse(piece.body.mass,this.ballSpeed),impulse);
  const offset=new Vec3(point.x-piece.body.position.x,point.y-piece.body.position.y,point.z-piece.body.position.z);
  piece.body.applyImpulse(impulse,offset);this.moving=true;this.resetQuiet();
  return true;
 }
 frontPoint(id:number,x=0,y=0):Point{
  const p=this.active.find(p=>p.id===id);
  if(!p)throw new Error("Unknown active block: "+id);
  // Choose the face facing the cannon even after the block has tipped over.
  const localCannon=p.body.pointToLocalFrame(new Vec3(0,1.65,5));
  const ax=Math.abs(localCannon.x),ay=Math.abs(localCannon.y),az=Math.abs(localCannon.z);
  const point=az>=ax&&az>=ay?new Vec3(x,y,Math.sign(localCannon.z)*p.depth/2)
   :ay>=ax?new Vec3(x,Math.sign(localCannon.y)*p.height/2,y)
   :new Vec3(Math.sign(localCannon.x)*p.width/2,y,x);
  return p.body.pointToWorldFrame(point);
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
   if(!p.cleared&&p.body.aabb.upperBound.y<CLEAR_Y){p.cleared=true;fallen.push(p.id);}
  }
  // The objective is the shelf, not the eventual resting height of floor piles.
  // Preserve debris and keep simulating it, but finish immediately at zero targets.
  if(this.active.length===0){this.moving=false;return fallen;}
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
