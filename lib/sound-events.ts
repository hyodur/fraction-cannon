import type {Frame} from "./physics";
import type {GameEffect} from "./audio";

export type ShotSoundCue={frame:number;effect:GameEffect};
export function shotSoundCues(frames:Frame[],shelfY:number):ShotSoundCue[]{
 const cues:ShotSoundCue[]=[],falling=new Set<number>();
 let impacted=false,lastRumble=-6;
 for(let i=0;i<frames.length;i++){
  const frame=frames[i];
  if(!frame||!Array.isArray(frame.blocks))continue;
  if(!impacted&&frame.broken?.length){cues.push({frame:i,effect:"impact"});impacted=true;}
  let newlyFalling=false;
  for(const b of frame.blocks){
   if(!falling.has(b.id)&&b.y>shelfY+30&&(b.vy||0)>.7){falling.add(b.id);newlyFalling=true;}
  }
  // Group a cascade into short rumbles instead of one loud sound per block.
  if(newlyFalling&&i-lastRumble>=6){cues.push({frame:i,effect:"collapse"});lastRumble=i;}
 }
 return cues;
}
