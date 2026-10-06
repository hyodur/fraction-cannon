type AudioRef={current:AudioContext|null};
export type GameEffect="impact"|"collapse";

function audioContext(ref:AudioRef){
 if(!ref.current||ref.current.state==="closed")ref.current=new AudioContext();
 void ref.current.resume().catch(()=>{});
 return ref.current;
}

export function closeGameAudio(ref:AudioRef){
 const context=ref.current;
 // Detach before closing: StrictMode and hot reload may repeat cleanup.
 ref.current=null;
 if(!context||context.state==="closed")return;
 try{void context.close().catch(()=>{});}catch{}
}

export function playGameTone(ref:AudioRef,freq:number,duration=.12){
 try{
  const ctx=audioContext(ref);
  // Audio availability must never interrupt the game (including async errors).
  const oscillator=ctx.createOscillator(),gain=ctx.createGain();
  oscillator.frequency.setValueAtTime(freq,ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40,freq/3),ctx.currentTime+duration);
  gain.gain.setValueAtTime(.1,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);
  oscillator.connect(gain);gain.connect(ctx.destination);
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
  oscillator.start();oscillator.stop(ctx.currentTime+duration);
 }catch{}
}

// Short percussive effects synthesized locally; no downloads or autoplay needed.
export function effectSamples(effect:GameEffect,sampleRate:number){
 const duration=effect==="impact"?.12:.62;
 const samples=new Float32Array(Math.ceil(duration*sampleRate));
 let seed=173,low=0;
 for(let i=0;i<samples.length;i++){
  const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const noise=seed/2147483648-1;low=low*.83+noise*.17;
  if(effect==="impact"){
   const attack=Math.min(1,t/.002);
   samples[i]=attack*(.55*Math.sin(2*Math.PI*185*t)*Math.exp(-t*48)+.35*(noise-low)*Math.exp(-t*75));
  }else{
   let value=0;
   for(const [j,start] of [0,.065,.14,.24,.36].entries()){
    const dt=t-start;if(dt<0)continue;
    const envelope=Math.min(1,dt/.005)*Math.exp(-dt*(19+j*2));
    value+=(low*.65+Math.sin(2*Math.PI*(105-j*11)*dt)*.24)*envelope*(1-j*.12);
   }
   samples[i]=value*Math.min(1,(duration-t)/.025);
  }
 }
 return samples;
}

export function playGameEffect(ref:AudioRef,effect:GameEffect){
 try{
  const ctx=audioContext(ref),samples=effectSamples(effect,ctx.sampleRate);
  const buffer=ctx.createBuffer(1,samples.length,ctx.sampleRate);buffer.copyToChannel(samples,0);
  const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;
  gain.gain.setValueAtTime(effect==="impact"?.28:.4,ctx.currentTime);
  source.connect(gain);gain.connect(ctx.destination);
  source.onended=()=>{source.disconnect();gain.disconnect()};source.start();
 }catch{}
}
