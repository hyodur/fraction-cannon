import {env} from "cloudflare:workers";
import {initialBlocks,difficulty,simulateShot,score,type Block} from "./physics";
import {makeQuestion,isCorrect,publicQuestion,type Question} from "./questions";
export const SEASON="2026-pilot-1";
type Challenge={q:Question;target:number;opened:number;errors:number;hints:number;ready:boolean;explanation?:string};
type State={blocks:Block[];total:number;shots:number;errors:number;milliseconds:number;speedTotal:number;done:boolean;challenge?:Challenge;cooldown:number};
type RunRow={id:string;player_id:string;stage:number;state:string;revision:number;updated_at:number};
type Player={id:string;nickname:string;unlocked:number};
export function db(){if(!env.DB)throw Error("기록 저장소를 연결하고 있어요. 잠시 뒤 다시 시도해 주세요.");return env.DB}
export class GameError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status}}
export async function player(req:Request):Promise<{user:Player;cookie?:string}>{
 const platform=req.headers.get("oai-authenticated-user-id");
 const match=/(?:^|;\s*)fraction_player=([a-f0-9-]{36})(?:;|$)/.exec(req.headers.get("cookie")||"");
 const guest=match?.[1]||crypto.randomUUID(),id=platform?"oai:"+platform:"guest:"+guest;
 const cookie=!platform&&!match?`fraction_player=${guest}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${new URL(req.url).protocol==="https:"?"; Secure":""}`:undefined;
 let user=await db().prepare("SELECT id,nickname,unlocked FROM players WHERE id=?").bind(id).first<Player>();
 if(!user){const adjectives=["용감한","반짝이는","씩씩한","날쌘","호기심많은"];const animals=["토끼","수달","곰","여우","펭귄"];const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(id)));const nickname=adjectives[bytes[0]%5]+" "+animals[bytes[1]%5]+" "+(bytes[2]*256+bytes[3]).toString().padStart(5,"0");await db().prepare("INSERT OR IGNORE INTO players (id,nickname,unlocked,created_at) VALUES (?,?,1,?)").bind(id,nickname,Date.now()).run();user={id,nickname,unlocked:1};}
 return {user,cookie};
}
export function view(row:RunRow,s:State){return {id:row.id,stage:row.stage,blocks:s.blocks,total:s.total,shots:s.shots,errors:s.errors,milliseconds:s.milliseconds,done:s.done,score:s.done?score(s.shots,s.errors,s.speedTotal):null,challenge:s.challenge?{...publicQuestion(s.challenge.q,s.challenge.hints),target:s.challenge.target,ready:s.challenge.ready,explanation:s.challenge.ready?s.challenge.explanation:undefined}:null}}
export async function start(user:Player,stage:number){
 if(!Number.isInteger(stage)||stage<1||stage>12||stage>user.unlocked)throw new GameError("앞의 성을 먼저 완료해 주세요.");
 const previous=await db().prepare("SELECT updated_at FROM runs WHERE player_id=? ORDER BY updated_at DESC LIMIT 1").bind(user.id).first<{updated_at:number}>();
 if(previous&&Date.now()-previous.updated_at<1000)throw new GameError("잠깐만 기다려 주세요.",429);
 const blocks=initialBlocks(stage),s:State={blocks,total:blocks.length,shots:0,errors:0,milliseconds:0,speedTotal:0,done:false,cooldown:0};
 const row={id:crypto.randomUUID(),player_id:user.id,stage,state:JSON.stringify(s),revision:0,updated_at:Date.now()};
 await db().batch([db().prepare("DELETE FROM runs WHERE player_id=?").bind(user.id),db().prepare("INSERT INTO runs (id,player_id,stage,state,revision,updated_at) VALUES (?,?,?,?,0,?)").bind(row.id,user.id,stage,row.state,row.updated_at)]);
 return view(row,s);
}
export async function resume(user:Player){const row=await db().prepare("SELECT * FROM runs WHERE player_id=? ORDER BY updated_at DESC LIMIT 1").bind(user.id).first<RunRow>();return row&&Date.now()-row.updated_at<86400000?view(row,JSON.parse(row.state)):null}
export async function act(user:Player,body:Record<string,unknown>){
 if(typeof body.run!=="string")throw new GameError("탐험을 먼저 시작해 주세요.");
 const row=await db().prepare("SELECT * FROM runs WHERE id=? AND player_id=?").bind(body.run,user.id).first<RunRow>();
 if(!row||Date.now()-row.updated_at>86400000)throw new GameError("탐험이 만료되었어요. 다시 시작해 주세요.",404);
 const s:State=JSON.parse(row.state),now=Date.now();let extra:Record<string,unknown>={};
 if(body.action==="register"){
   if(!s.done)throw new GameError("성을 모두 무너뜨린 뒤 등록할 수 있어요.");
   const points=score(s.shots,s.errors,s.speedTotal);
   await db().prepare(`INSERT INTO records (id,player_id,stage,season,score,shots,errors,milliseconds,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(player_id,stage,season) DO UPDATE SET score=excluded.score,shots=excluded.shots,errors=excluded.errors,milliseconds=excluded.milliseconds,created_at=excluded.created_at WHERE excluded.score>records.score OR (excluded.score=records.score AND (excluded.shots<records.shots OR (excluded.shots=records.shots AND (excluded.errors<records.errors OR (excluded.errors=records.errors AND excluded.milliseconds<records.milliseconds)))))`).bind(crypto.randomUUID(),user.id,row.stage,SEASON,points,s.shots,s.errors,s.milliseconds,now).run();
   return {run:view(row,s),registered:true};
 }
 if(s.done)throw new GameError("이미 완료한 탐험이에요.");
 if(now<s.cooldown)throw new GameError("블록이 멈출 때까지 기다려 주세요.",429);
 if(body.action==="challenge"){
   if(s.challenge)throw new GameError("열린 문제를 먼저 풀어 주세요.");
   const target=s.blocks.find(b=>b.id===body.target);if(!target)throw new GameError("공격할 블록을 골라 주세요.");
   const seed=crypto.getRandomValues(new Uint32Array(1))[0];
   s.challenge={q:makeQuestion(row.stage,difficulty(target),seed),target:target.id,opened:now,errors:0,hints:0,ready:false};
 } else if(body.action==="hint"){
   const c=s.challenge;if(!c||c.ready)throw new GameError("풀고 있는 문제가 없어요.");c.hints=Math.min(c.hints+1,c.q.hints.length);
 } else if(body.action==="answer"){
   const c=s.challenge;if(!c)throw new GameError("문제를 먼저 열어 주세요.");
   if(c.ready)return {run:view(row,s),correct:true};
   if(now-row.updated_at<300)throw new GameError("답을 천천히 확인해 주세요.",429);
   const correct=isCorrect(c.q,body.answer);extra.correct=correct;
   if(correct){const elapsed=Math.max(0,now-c.opened);c.ready=true;c.explanation=c.q.explanation;s.milliseconds+=elapsed;s.speedTotal+=c.errors===0&&c.hints===0?Math.max(0,1-elapsed/60000):0;}
   else{s.errors++;c.errors++;extra.feedback="다시 생각해 볼까요? 힌트를 눌러도 좋아요.";}
 } else if(body.action==="fire"){
   const c=s.challenge;if(!c?.ready)throw new GameError("문제를 맞히면 발사할 수 있어요.");
   const result=simulateShot(s.blocks,c.target);s.blocks=result.blocks;s.shots++;s.done=s.blocks.length===0;s.challenge=undefined;s.cooldown=now+4000;extra={frames:result.frames,cleared:result.cleared};
 } else throw new GameError("알 수 없는 요청이에요.");
 const update=db().prepare("UPDATE runs SET state=?,revision=revision+1,updated_at=? WHERE id=? AND player_id=? AND revision=?").bind(JSON.stringify(s),now,row.id,user.id,row.revision);
 const out=await update.run();if(out.meta.changes!==1)throw new GameError("다른 요청이 처리되었어요. 화면을 새로고침해 주세요.",409);
 if(s.done)await db().prepare("UPDATE players SET unlocked=MAX(unlocked,?) WHERE id=?").bind(Math.min(12,row.stage+1),user.id).run();
 return {run:view(row,s),...extra};
}
export async function ranking(user:Player,stage:number){
 if(!Number.isInteger(stage)||stage<1||stage>12)throw new GameError("스테이지를 확인해 주세요.");
 const rows=await db().prepare(`SELECT p.nickname,r.score,r.shots,r.errors,r.milliseconds,r.player_id FROM records r JOIN players p ON p.id=r.player_id WHERE r.stage=? AND r.season=? ORDER BY r.score DESC,r.shots ASC,r.errors ASC,r.milliseconds ASC,r.created_at ASC,r.id ASC LIMIT 100`).bind(stage,SEASON).all();
 const mine=await db().prepare(`SELECT * FROM (SELECT player_id,score,shots,errors,milliseconds,ROW_NUMBER() OVER (ORDER BY score DESC,shots ASC,errors ASC,milliseconds ASC,created_at ASC,id ASC) AS rank FROM records WHERE stage=? AND season=?) WHERE player_id=?`).bind(stage,SEASON,user.id).first();
 return {rows:rows.results.map((r,i)=>({nickname:r.nickname,score:r.score,shots:r.shots,errors:r.errors,milliseconds:r.milliseconds,rank:i+1,isMe:r.player_id===user.id})),mine:mine?{rank:mine.rank,score:mine.score,shots:mine.shots,errors:mine.errors,milliseconds:mine.milliseconds}:null,season:SEASON};
}
