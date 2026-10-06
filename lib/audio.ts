type AudioRef={current:AudioContext|null};

export function closeGameAudio(ref:AudioRef){
 const context=ref.current;
 // Detach before closing: StrictMode and hot reload may repeat cleanup.
 ref.current=null;
 if(!context||context.state==="closed")return;
 try{void context.close().catch(()=>{});}catch{}
}

export function playGameTone(ref:AudioRef,freq:number,duration=.12){
 try{
  if(!ref.current||ref.current.state==="closed")ref.current=new AudioContext();
  const ctx=ref.current;
  // Audio availability must never interrupt the game (including async errors).
  void ctx.resume().catch(()=>{});
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
