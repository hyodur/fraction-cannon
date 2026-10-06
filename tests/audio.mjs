import assert from 'node:assert/strict';
import {closeGameAudio,playGameTone,playGameEffect,effectSamples} from '../lib/audio.ts';
import {shotSoundCues} from '../lib/sound-events.ts';
import {initialBlocks,simulateShot,SHELF} from '../lib/physics.ts';
const previous=globalThis.AudioContext,unhandled=[];
const listener=e=>unhandled.push(e);process.on('unhandledRejection',listener);
let created=0,closed=0,started=0;
class TestContext{
 constructor(){created++;this.state='suspended';this.currentTime=0;this.destination={};this.sampleRate=48000;}
 createBuffer(channels,length,rate){return {copyToChannel(samples){assert.equal(samples.length,length);assert.equal(rate,48000);assert.equal(channels,1);}};}
 createBufferSource(){return {connect(){},disconnect(){},start(){started++;}};}
 resume(){return Promise.reject(new Error('resume unavailable'));}
 close(){closed++;this.state='closed';return Promise.reject(new Error('close raced with browser teardown'));}
 createOscillator(){return {frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(){},stop(){}};}
 createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
}
try{
 globalThis.AudioContext=TestContext;
 const ref={current:null};playGameTone(ref,720);assert.equal(created,1);
 closeGameAudio(ref);closeGameAudio(ref);assert.equal(closed,1);assert.equal(ref.current,null);
 playGameTone(ref,130);assert.equal(created,2);ref.current.state='closed';
 playGameTone(ref,720);assert.equal(created,3,'Closed contexts must be replaced');
 ref.current.state='closed';closeGameAudio(ref);assert.equal(closed,1,'Already-closed contexts must not be closed twice');
 ref.current={state:'running',close(){throw Error('sync failure')}};closeGameAudio(ref);assert.equal(ref.current,null);
 playGameEffect(ref,'impact');playGameEffect(ref,'collapse');assert.equal(started,2,'Both effects must start an audio source');
 ref.current.state='closed';playGameEffect(ref,'impact');assert.equal(created,5);assert.equal(started,3);closeGameAudio(ref);
 for(const effect of ['impact','collapse']){
  const samples=effectSamples(effect,48000);
  assert(samples.every(Number.isFinite));assert(samples.some(x=>Math.abs(x)>.1));
  assert(samples.every(x=>Math.abs(x)<1),'Audio must not clip');
  assert(Math.abs(samples.at(-1))<.01,'Sound tail should fade out');
  assert.equal(samples.length,Math.ceil((effect==='impact'?.12:.62)*48000));
 }
 for(const target of [1,9]){
  const {frames}=simulateShot(initialBlocks(1),target),cues=shotSoundCues(frames,SHELF.y);
  assert.deepEqual(cues.filter(c=>c.effect==='impact'),[{frame:11,effect:'impact'}]);
  const falls=cues.filter(c=>c.effect==='collapse');assert(falls.length>0);
  for(const [i,cue] of falls.entries()){
   assert(cue.frame>11);assert(frames[cue.frame].blocks.some(b=>b.y>SHELF.y+30&&b.vy>.7));
   if(i)assert(cue.frame-falls[i-1].frame>=6,'Collapse clusters must not overload the audio');
  }
 }
 assert.deepEqual(shotSoundCues([{blocks:initialBlocks(1),broken:[]}],SHELF.y),[]);
 assert.deepEqual(shotSoundCues([undefined,{broken:[]}],SHELF.y),[]);
 await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(unhandled,[]);
 console.log('Audio lifecycle, synthesized effects and physics cue checks passed');
}finally{globalThis.AudioContext=previous;process.removeListener('unhandledRejection',listener)}
