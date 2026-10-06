import { difficulty, blockName, SHELF, type Block, type Frame } from "@/lib/physics";

const levels=["","쉬움","보통","도전"];
const colors=[
 {front:"#edb55b",top:"#ffe0a0",side:"#b67532",edge:"#956129"},
 {front:"#c88a48",top:"#edbc7c",side:"#8b542e",edge:"#734727"},
 {front:"#a6bacd",top:"#dce8f1",side:"#718ba4",edge:"#566e87"},
 {front:"#7d96ba",top:"#c4d7f0",side:"#475f86",edge:"#364d74"},
];
const project=(x:number,y:number)=>({x:500+(x-700)*1.4,y:340+(y-SHELF.y)*1.02});
const shelfLeft=project(SHELF.x-SHELF.width/2,SHELF.y).x;
const shelfRight=project(SHELF.x+SHELF.width/2,SHELF.y).x;
function blockSides(block:Block){
 const cos=Math.cos(block.a),sin=Math.sin(block.a),w=block.w/2-.65,h=block.h/2-.65;
 const corners=[[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,y])=>project(block.x+x*cos-y*sin,block.y+x*sin+y*cos));
 return corners.flatMap((a,i)=>{
  const b=corners[(i+1)%4],nx=b.y-a.y,ny=a.x-b.x;
  // Depth is fixed in the scene, even when a block rotates in the front plane.
  if(nx*6-ny*7<=0)return [];
  return [{points:`${a.x},${a.y} ${a.x+6},${a.y-7} ${b.x+6},${b.y-7} ${b.x},${b.y}`,top:ny<0&&Math.abs(ny)>Math.abs(nx)}];
 });
}

type Props={blocks:Block[];target:number|null;ball:Frame["ball"];bursts:Frame["broken"];locked:boolean;animating:boolean;topic:string;onSelect:(block:Block)=>void};
export function GameArena({blocks,target,ball,bursts,locked,animating,topic,onSelect}:Props){
 const selected=blocks.find(b=>b.id===target);
 const aim=selected?project(selected.x,selected.y):{x:500,y:250};
 const muzzle={x:500+(aim.x-500)*.14,y:510+(aim.y-250)*.06};
 const depth=ball?Math.max(0,Math.min(1,ball.depth)):0;
 const impact=ball?project(ball.x,ball.y):aim;
 const shot=ball?{x:impact.x+(muzzle.x-impact.x)*depth,y:impact.y+(muzzle.y-impact.y)*depth-45*Math.sin(Math.PI*depth),r:10+25*depth}:null;
 return <svg className="game-board front-view" viewBox="0 0 1000 650" role="group" aria-label="대포 뒤에서 바라본 블록 성. 정면의 블록을 눌러 조준하세요.">
  <defs>
   <linearGradient id="arena-sky" x2="0" y2="1"><stop stopColor="#a8dfff"/><stop offset="1" stopColor="#edfaff"/></linearGradient>
   <linearGradient id="arena-ground" x2="0" y2="1"><stop stopColor="#c8e6eb"/><stop offset="1" stopColor="#94c8d5"/></linearGradient>
   <linearGradient id="cannon-metal"><stop stopColor="#1c3269"/><stop offset=".3" stopColor="#577bdf"/><stop offset=".5" stopColor="#91b3ff"/><stop offset=".72" stopColor="#4063c4"/><stop offset="1" stopColor="#182e65"/></linearGradient>
   <radialGradient id="cannonball" cx=".3" cy=".25"><stop stopColor="#8299ba"/><stop offset=".5" stopColor="#304968"/><stop offset="1" stopColor="#12243e"/></radialGradient>
  </defs>
  <rect width="1000" height="650" fill="url(#arena-sky)"/>
  <path d="M0 440 Q500 390 1000 440 V650 H0Z" fill="url(#arena-ground)"/>
  <g fill="none" stroke="#effcff" strokeWidth="2" opacity=".35" aria-hidden="true">
   {[0,200,400,600,800,1000].map(x=><path key={x} d={`M500 410 L${(x-500)*2+500} 650`}/>)}
   {[440,490,570].map(y=><path key={y} d={`M0 ${y} Q500 ${y-25} 1000 ${y}`}/>)}
  </g>
  <text x="32" y="43" fontSize="17" fill="#305a77" fontWeight="700">{topic}</text>
  <text x="968" y="43" textAnchor="end" fontSize="16" fill="#305a77">{animating?"명중! 무너지는 중…":"정면의 블록을 눌러 조준!"}</text>
  <ellipse cx="505" cy="566" rx="255" ry="25" fill="#517b91" opacity=".19"/>
  <g aria-hidden="true">
   <path d={`M${shelfLeft+28} 358 V556 M${shelfRight-28} 358 V556`} stroke="#7892ad" strokeWidth="19"/>
   <path d={`M${shelfLeft+30} 545 L${shelfRight-30} 375 M${shelfRight-30} 545 L${shelfLeft+30} 375`} stroke="#90a9bd" strokeWidth="9"/>
   <path d={`M${shelfLeft} 340 l14 -16 H${shelfRight+14} l-14 16Z`} fill="#bdcddd"/>
   <path d={`M${shelfLeft} 340 H${shelfRight} V367 H${shelfLeft}Z`} fill="#5b7393"/>
   <path d={`M${shelfRight} 340 l14 -16 v27 l-14 16Z`} fill="#415775"/>
   <path d={`M${shelfLeft+6} 345 H${shelfRight-6}`} stroke="#88a1bf" strokeWidth="5"/>
  </g>
  <text x="965" y="587" textAnchor="end" fontSize="16" fill="#2d536c">선반 아래로 떨어뜨려요!</text>
  <g className="block-stack">
  {/* All depth faces sit behind the physical front plane. A neighboring face
      must never be covered by another block's decorative extrusion. */}
  <g className="block-depth" pointerEvents="none" aria-hidden="true">
   {[...blocks].sort((a,b)=>b.y-a.y||b.x-a.x).map(b=><g key={b.id}>{blockSides(b).map((side,i)=><polygon key={i} points={side.points} fill={side.top?colors[b.material].top:colors[b.material].side} stroke={colors[b.material].edge} strokeWidth="1.25" strokeLinejoin="round"/>)}</g>)}
  </g>
  {[...blocks].sort((a,b)=>Math.round(b.y/2)-Math.round(a.y/2)||b.x-a.x).map(b=>{
   const p=project(b.x,b.y),w=(b.w-1.3)*1.4,h=(b.h-1.3)*1.02,c=colors[b.material],lv=difficulty(b),isTarget=b.id===target;
   const cos=Math.cos(b.a),sin=Math.sin(b.a);
   return <g key={b.id} role="button" aria-label={`${b.id}번 ${blockName(b)} 블록, ${levels[lv]}, 남은 단단함 ${b.hp}`} aria-pressed={isTarget} aria-disabled={locked} tabIndex={locked?-1:0}
    onClick={()=>{if(!locked)onSelect(b)}} onKeyDown={e=>{if((e.key==="Enter"||e.key===" ")&&!locked){e.preventDefault();onSelect(b)}}}
    style={{cursor:locked?"default":"crosshair"}} transform={`translate(${p.x} ${p.y}) matrix(${cos} ${sin*1.02/1.4} ${-sin*1.4/1.02} ${cos} 0 0)`}>
    <rect className="block-face" x={-w/2} y={-h/2} width={w} height={h} rx="1" fill={c.front} stroke={isTarget?"#2857ed":c.edge} strokeWidth={isTarget?3:1.25}/>
    <path d={`M${-w/2+6} ${-h/2+6} H${w/2-6}`} stroke={c.top} strokeWidth="3"/>
    {b.material===1?<path d={`M${-w/2+8} ${-h/2} v${h} M${w/2-8} ${-h/2} v${h}`} stroke="#815431" strokeWidth="4" opacity=".6"/>:null}
    {b.maxHp>b.hp?<path d={`M0 ${-h/2} l-8 12 l13 9 l-8 14`} fill="none" stroke="#34465b" strokeWidth="3"/>:null}
    <circle cx={w/2-8} cy={h/2-8} r="4" fill={["","#168365","#d18a15","#bf4f6a"][lv]}/>
    {b.maxHp>1?<g aria-hidden="true">{Array.from({length:b.maxHp},(_,i)=><circle key={i} cx={-w/2+7+i*7} cy={h/2-8} r="2.2" fill={i<b.hp?"#344665":"#ffffff80"}/>)}</g>:null}
   </g>
  })}
  </g>
  {selected&&!animating?<g pointerEvents="none" className="aim-reticle" transform={`translate(${aim.x} ${aim.y})`}>
   <circle r="23" fill="#ffffff26" stroke="#234cc8" strokeWidth="5"/>
   <circle r="23" fill="none" stroke="#fff" strokeWidth="2"/>
   <path d="M-33 0 H-14 M14 0 H33 M0 -33 V-14 M0 14 V33" stroke="#fff" strokeWidth="3"/>
   <circle r="3" fill="#fff"/>
  </g>:null}
  {bursts.map((b,i)=>{const p=project(b.x,b.y);return <g key={i} pointerEvents="none" transform={`translate(${p.x} ${p.y})`}>
   <circle r="30" fill="#ffcf50" opacity=".6"/><circle r="17" fill="#fff6b2"/>
   {[0,1,2,3,4,5].map(j=><path key={j} transform={`rotate(${j*60})`} d="M0 -23 L5 -38 L-4 -34Z" fill="#fff5bf"/>)}
  </g>})}
  <g pointerEvents="none" className={ball&&depth>.7?"player-cannon recoil":"player-cannon"}>
   <ellipse cx="500" cy="630" rx="142" ry="30" fill="#366079" opacity=".24"/>
   <path d="M369 650 V594 Q380 568 402 594 V650 M598 650 V594 Q620 568 631 594 V650" fill="#253e66" stroke="#162e54" strokeWidth="8"/>
   <path d="M399 637 L443 577 H557 L601 637Z" fill="#e4a13d" stroke="#af6b28" strokeWidth="6"/>
   <path d={`M425 650 Q416 611 ${muzzle.x-35} ${muzzle.y} Q${muzzle.x} ${muzzle.y-18} ${muzzle.x+35} ${muzzle.y} Q584 611 575 650Z`} fill="url(#cannon-metal)" stroke="#213968" strokeWidth="5"/>
   <ellipse cx={muzzle.x} cy={muzzle.y} rx="36" ry="21" fill="#10253f" stroke="#759ae8" strokeWidth="9"/>
   <ellipse cx={muzzle.x} cy={muzzle.y+1} rx="24" ry="12" fill="#091727"/>
   <path d="M438 620 Q500 606 562 620" fill="none" stroke="#a8c8ff" strokeWidth="6" opacity=".6"/>
   {ball&&depth>.7?<circle cx={muzzle.x} cy={muzzle.y-10} r={45*depth} fill="#ffe9a2" opacity={depth*.8}/>:null}
  </g>
  {shot?<g pointerEvents="none" data-testid="flying-ball">
   <path d={`M${shot.x} ${shot.y} L${shot.x+(muzzle.x-shot.x)*.13} ${shot.y+38*depth}`} stroke="#ffffffbb" strokeWidth={shot.r} strokeLinecap="round"/>
   <circle cx={shot.x} cy={shot.y} r={shot.r} fill="url(#cannonball)" stroke="#d2e8ff" strokeWidth="2"/>
  </g>:null}
  <text x="32" y="615" fontSize="16" fill="#2d536c" fontWeight="700">{selected?`${selected.id}번 블록 조준 중` :"대포 뒤에서 목표를 골라요"}</text>
 </svg>;
}
