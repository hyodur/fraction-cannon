// RAF timestamps may precede performance.now() sampled in the same browser frame.
// Anchor playback to its first callback and clamp defensively at both ends.
export function playbackPosition(now:number,start:number,count:number,interval=50){
 const elapsed=Number.isFinite(now-start)?Math.max(0,now-start):0;
 return {index:count>0?Math.min(count-1,Math.max(0,Math.floor(elapsed/interval))):-1,done:count<=0||elapsed>=count*interval};
}
