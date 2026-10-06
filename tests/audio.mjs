import assert from 'node:assert/strict';
import {closeGameAudio,playGameTone} from '../lib/audio.ts';
const previous=globalThis.AudioContext,unhandled=[];
const listener=e=>unhandled.push(e);process.on('unhandledRejection',listener);
let created=0,closed=0;
class TestContext{
 constructor(){created++;this.state='suspended';this.currentTime=0;this.destination={};}
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
 await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(unhandled,[]);
 console.log('Audio lifecycle regression checks passed');
}finally{globalThis.AudioContext=previous;process.removeListener('unhandledRejection',listener)}
