import {useEffect,useRef,useState,type FormEvent} from "react";
import {makeQuestion,isCorrect,type Question} from "./questions";
import {STAGES,getStage,blockLevel,PROGRESS_KEY,readProgress,completeStage} from "./stages";
import {closeGameAudio,playGameEffect,playGameTone} from "../../lib/audio";
import {stageScore} from "./score";
import {CannonScene} from "./scene";
const names=["","쉬움","보통","도전"];
function MathText({text}:{text:string}){
 return <>{text.split(/(\d+ \d+\/\d+|\d+\/\d+)/g).map((part,i)=>{
  const m=/^(?:(\d+) )?(\d+)\/(\d+)$/.exec(part);
  return m?<span className="math-value" data-math={part} key={i} role="math" aria-label={(m[1]?m[1]+" 그리고 ":"")+m[3]+"분의 "+m[2]}>{m[1]&&<span className="math-whole">{m[1]}</span>}<span className="math-fraction"><span>{m[2]}</span><span>{m[3]}</span></span></span>:<span key={i}>{part}</span>;
 })}</>;
}
function loadProgress(){try{return readProgress(localStorage.getItem(PROGRESS_KEY));}catch{return readProgress(null);}}
export function Game(){
 const [progress,setProgress]=useState(loadProgress),[storageNotice,setStorageNotice]=useState("");
 const stageId=progress.current,stage=getStage(stageId);
 const host=useRef<HTMLDivElement>(null),scene=useRef<CannonScene|null>(null),audio=useRef<AudioContext|null>(null);
 const questionStarted=useRef(0);
 const [answerSeconds,setAnswerSeconds]=useState(0);
 const questionRef=useRef<Question|null>(null),busyRef=useRef(true),mutedRef=useRef(false);
 const [round,setRound]=useState(0),[remaining,setRemaining]=useState<number[]>([]),[busy,setBusy]=useState(true),[graphics,setGraphics]=useState(false),[error,setError]=useState("");
 const [target,setTarget]=useState<number|null>(null),[question,setQuestion]=useState<Question|null>(null),[ready,setReady]=useState(false);
 const [numerator,setNumerator]=useState(""),[denominator,setDenominator]=useState(""),[whole,setWhole]=useState(""),[number,setNumber]=useState(""),[choice,setChoice]=useState("");
 const [hints,setHints]=useState(0),[shots,setShots]=useState(0),[mistakes,setMistakes]=useState(0),[muted,setMuted]=useState(false);
 const [message,setMessage]=useState("블록을 눌러 조준하세요.");
 useEffect(()=>{try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress));}catch{setStorageNotice("이 브라우저에서는 진행 상황을 저장할 수 없어요. 창을 닫으면 기록이 사라질 수 있어요.");}},[progress]);
 useEffect(()=>{
  if(!host.current)return;
  try{
   const arena=new CannonScene(host.current,{
    state:s=>{
     setRemaining(s.remaining);setBusy(s.moving);busyRef.current=s.moving;
     if(!s.moving){
      setMessage(s.remaining.length?"다음 블록을 골라 작전을 이어가세요.":"모든 블록을 떨어뜨렸어요!");
      if(!s.remaining.length)setProgress(p=>completeStage(p,stageId));
     }
    },
    select:id=>{
     setTarget(id);
     if(id===null){questionRef.current=null;setQuestion(null);setReady(false);setMessage("선택한 블록이 선반 아래로 떨어졌어요.");}
     else setMessage(id+"번 블록을 골랐어요. 문제를 풀면 발사할 수 있어요.");
    },
    effect:name=>{if(!mutedRef.current)playGameEffect(audio,name);},
    error:message=>{setError(message);setGraphics(false);}
   },()=>!questionRef.current&&!busyRef.current,stageId);
   scene.current=arena;setGraphics(true);
   return ()=>{arena.dispose();scene.current=null;closeGameAudio(audio);};
  }catch{setError("이 브라우저에서 3D 화면을 시작하지 못했어요. 최신 크롬이나 엣지에서 다시 열어 주세요.");setGraphics(false);}
 },[round,stageId]);
 function openQuestion(){
  if(target===null||!remaining.includes(target)||busyRef.current||questionRef.current||!graphics)return;
  const seed=crypto.getRandomValues(new Uint32Array(1))[0],q=makeQuestion(stageId,blockLevel(stageId,target),seed);
  questionStarted.current=performance.now();questionRef.current=q;setQuestion(q);setReady(false);setNumerator("");setDenominator("");setWhole("");setNumber("");setChoice("");setHints(0);setMessage("시간 제한은 없어요. 차근차근 풀어 보세요.");
 }
 function answer(event:FormEvent){
  event.preventDefault();if(!question||ready)return;
  const value=question.kind==="fraction"?numerator+"/"+denominator:question.kind==="mixed"?whole+" "+numerator+"/"+denominator:question.kind==="number"?number:choice;
  const missing=question.kind==="fraction"?(!numerator||!denominator):question.kind==="mixed"?(!whole||!numerator||!denominator):!value;
  if(missing){setMessage("답을 모두 입력하거나 골라 주세요.");return;}
  const correct=isCorrect(question,value);
  if(!mutedRef.current)playGameTone(audio,correct?720:200);
  if(correct){setAnswerSeconds(n=>n+Math.max(0,(performance.now()-questionStarted.current)/1000));setReady(true);setMessage("정답이에요! 대포를 발사해 보세요.");}
  else{setMistakes(n=>n+1);setMessage((question.kind==="fraction"||question.kind==="mixed")?"다시 도전할 수 있어요. 오답 1회가 기록되었어요. 문제에서 정한 분모와 분자를 확인해 보세요.":"다시 도전할 수 있어요. 오답 1회가 기록되었어요. 힌트도 살펴보세요.");}
 }
 function fire(){
  if(!ready||target===null||!scene.current?.fire(target))return;
  busyRef.current=true;setBusy(true);setShots(n=>n+1);questionRef.current=null;setQuestion(null);setReady(false);setTarget(null);setMessage("블록이 쓰러지고 있어요. 끝까지 지켜봐요!");
  if(!mutedRef.current)playGameTone(audio,130,.28);
 }
 function startStage(id:number){
  if(id<1||id>progress.unlocked)return;
  questionRef.current=null;setQuestion(null);setTarget(null);setReady(false);setShots(0);setMistakes(0);setAnswerSeconds(0);questionStarted.current=0;setError("");setGraphics(false);busyRef.current=true;setBusy(true);
  setMessage("새로운 작전을 세워 보세요.");setProgress(p=>({...p,current:id}));setRound(n=>n+1);
 }
 function sound(){const next=!mutedRef.current;mutedRef.current=next;setMuted(next);if(next)closeGameAudio(audio);}
 const score=stageScore({shots,mistakes,answerSeconds});
 const done=graphics&&!busy&&remaining.length===0;
 const digits=(value:string)=>value.replace(/\D/g,"");
 return <main className="preview-shell">
  <header className="header"><a className="brand" href="./">분수 <strong>팡!</strong><span>대포 탐험대</span></a><span className="preview-tag">3D · 12단계</span><button className="quiet-button" onClick={sound} aria-label={muted?"소리 켜기":"소리 끄기"}>{muted?"소리 켜기":"소리 끄기"}</button></header>
  <section className="intro"><div><p className="eyebrow">STAGE {String(stageId).padStart(2,"0")} / 12 · {stage.topic}</p><h1>{stage.title}</h1><p>문제를 풀고, 가장 멋진 한 발을 날려요.</p></div><p className="curriculum">초등 3학년 · 2학기</p></section>
  <section className="stage-strip" aria-label="단계와 재질">
   <label>단계 선택 <select aria-label="단계 선택" value={stageId} disabled={busy||!!question} onChange={e=>startStage(Number(e.target.value))}>{STAGES.map(s=><option key={s.id} value={s.id} disabled={s.id>progress.unlocked}>{s.id}단계 · {s.material.name}{progress.completed.includes(s.id)?" ✓":s.id>progress.unlocked?" · 잠김":""}</option>)}</select></label>
   <span className={"material-tag material-"+stage.material.id}>{stage.material.name} 블록</span><span>처음 블록 {stage.count}개</span><span>{stage.layout} · 같은 재질은 같은 단단함</span>
  </section>
  <div className="layout">
   <section className="arena" aria-label="3D 대포 게임">
    <div className="arena-top"><strong>모든 블록을 선반 아래로!</strong><span>대포알 <b>{shots}</b>발 · 남은 블록 <b data-testid="remaining">{remaining.length}</b>개</span></div>
    <div className="canvas-host" ref={host} data-testid="arena-3d"/>
    {error?<p className="error" role="alert">{error}</p>:null}
    <p className="arena-status" role="status">{!graphics&&!error?"입체 블록을 준비하고 있어요.":done?"작전 성공! 모두 떨어뜨렸어요.":busy?"블록이 멈출 때까지 기다려 주세요.":"블록의 맞히고 싶은 곳을 눌러 조준하세요."}</p>
    <div className="block-buttons" aria-label="번호로 블록 선택">{remaining.map(id=><button key={id} disabled={!graphics||busy||!!question} aria-label={id+"번 블록, "+names[blockLevel(stageId,id)]} aria-pressed={target===id} onClick={()=>scene.current?.select(id)}>{id}</button>)}</div>
   </section>
   <aside className="mission">
    {done?<><span className="eyebrow">{stageId===12?"ALL MISSIONS COMPLETE":"MISSION COMPLETE"}</span><h2>{stageId===12?"12단계 모두 성공!":"멋진 작전이었어요!"}</h2><p>{stageId}단계 · 대포알 {shots}발로 성공했어요.</p><div className="score-card" data-testid="stage-score"><strong>최종 점수 <span data-testid="score-total">{score.total}</span>점</strong><dl><div><dt>단계 성공</dt><dd>+{score.completion}</dd></div><div><dt>대포알 보너스</dt><dd>+{score.cannonBonus}</dd></div><div><dt>문제 풀이 시간 보너스</dt><dd data-testid="time-bonus">+{score.timeBonus}</dd></div><div><dt>실수 없이 성공</dt><dd data-testid="clean-bonus">+{score.cleanBonus}</dd></div><div><dt>오답 <span data-testid="mistake-count">{mistakes}</span>회</dt><dd data-testid="mistake-penalty">−{score.mistakePenalty}</dd></div></dl><p>오답 1회당 150점 감점 · 최저 0점</p></div>{stageId<12?<button className="primary" onClick={()=>startStage(stageId+1)}>다음 단계로</button>:<p>분수 탐험을 끝까지 해냈어요! 단계 선택에서 다시 도전할 수도 있어요.</p>}<button className="quiet-button" onClick={()=>startStage(stageId)}>다시 도전하기</button></>:question?<><span className={"badge level-"+question.level}>{names[question.level]} · {question.topic}</span><h2>분수 작전 문제</h2>
    {question.expression&&<div className="question-expression" data-testid="expression"><MathText text={question.expression}/></div>}
    <p className="question-text" data-question-id={question.id}><MathText text={question.prompt}/></p>
    {(question.visual||hints>0)&&question.diagram?<div className="groups" aria-label={"전체 "+question.diagram.groups+"묶음 중 "+question.diagram.selected+"묶음"}>{Array.from({length:question.diagram.groups},(_,g)=><div key={g} className={g<question.diagram!.selected?"beads chosen":"beads"}>{Array.from({length:question.diagram!.size},(_,i)=><i key={i}/>)}</div>)}</div>:null}
    {!ready&&<p className="answer-rule">{question.kind==="fraction"?(stageId<=3?"전체 묶음 수를 분모로, 해당 묶음 수를 분자로 쓰세요.":"보여 준 분수의 분모를 그대로 써 주세요."):question.kind==="mixed"?"분모를 그대로 두고 자연수 부분과 분자를 쓰세요.":"차근차근 풀어 보세요."}</p>}
    {ready?<><p className="correct"><MathText text={question.explanation}/></p><button className="fire" onClick={fire}>대포 발사!</button></>:<form onSubmit={answer}>
     {(question.kind==="fraction"||question.kind==="mixed")&&<div className="answer-mixed">{question.kind==="mixed"&&<input className="whole-input" aria-label="자연수 부분" inputMode="numeric" autoComplete="off" maxLength={2} placeholder="자연수" value={whole} onChange={e=>setWhole(digits(e.target.value))}/>}<div className="fraction-input"><input aria-label="분자" inputMode="numeric" autoComplete="off" maxLength={3} placeholder="분자" value={numerator} onChange={e=>setNumerator(digits(e.target.value))}/><span/><input aria-label="분모" inputMode="numeric" autoComplete="off" maxLength={3} placeholder="분모" value={denominator} onChange={e=>setDenominator(digits(e.target.value))}/></div></div>}
     {question.kind==="number"&&<label className="number-answer">답 <input aria-label="장수" inputMode="numeric" autoComplete="off" maxLength={3} value={number} onChange={e=>setNumber(digits(e.target.value))}/> 장</label>}
     {question.kind==="choice"&&<fieldset className="answer-choices"><legend>답을 고르세요</legend>{question.choices?.map((c,i)=><label key={c} className={choice===c?"chosen":""}><input type="radio" name="answer-choice" value={c} checked={choice===c} onChange={()=>setChoice(c)}/><span><MathText text={c}/></span></label>)}</fieldset>}
     <button className="primary" type="submit">정답 확인</button><button className="quiet-button" type="button" disabled={hints>=2} onClick={()=>setHints(n=>Math.min(2,n+1))}>힌트 {hints}/2</button>{question.hints.slice(0,hints).map(h=><p className="hint" key={h}><MathText text={h}/></p>)}
    </form>}</>:<><span className="eyebrow">AIM · THINK · FIRE</span><h2>어디를 맞힐까요?</h2><p>두 탑은 따로 서 있어요.<br/>한쪽 받침을 무너뜨린 뒤<br/>다음 탑도 공략해 보세요.</p><div className="lesson-note">각 탑의 기둥과 받침에는<br/><strong>조금 더 어려운 도전 문제!</strong></div><p>{target===null?"공격할 블록을 골라 주세요.":target+"번 블록 · "+names[blockLevel(stageId,target)]}</p><button className="primary" disabled={target===null||busy||!graphics} onClick={openQuestion}>문제 풀고 공격하기</button></>}
    {!done&&<p className="score-rule">이번 단계 오답 <b data-testid="mistake-count">{mistakes}</b>회 · 1회당 최종 점수 −150점<br/>틀려도 다시 풀 수 있어요. 실수 없이 성공하면 +200점!</p>}
    <p className="feedback" aria-live="polite">{message}</p>
   </aside>
  </div>
  {storageNotice&&<p role="status" className="storage-notice">{storageNotice}</p>}
  <footer><p>진행 단계는 이 브라우저에 저장돼요. 3D 체험 기록은 전국 랭킹에 등록되지 않아요.</p><button className="quiet-button" disabled={!graphics} onClick={()=>startStage(stageId)}>처음부터 다시</button></footer>
 </main>;
}
