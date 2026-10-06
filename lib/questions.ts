export type Level = 1 | 2 | 3;
export type Question = {id:string;topic:string;level:Level;prompt:string;kind:"fraction"|"number"|"choice"|"mixed";answer:string;explanation:string;hints:string[];choices?:string[];diagram?:{groups:number;size:number;selected:number};visual?:boolean};
export const TOPICS=["전체와 부분","분수만큼의 양","여러 가지 분수","분수의 크기 비교"];
export function makeQuestion(stage:number,level:Level,seed:number):Question {
 let n=seed>>>0; const rand=(a:number,b:number)=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return a+n%(b-a+1)};
 const d=rand(3,7),k=rand(1,d-1),size=rand(2,5),total=d*size;
 const chapter=Math.floor((stage-1)/3);
 const q:Question={id:String(seed),topic:TOPICS[chapter],level,prompt:"",kind:"fraction",answer:"",explanation:"",hints:[]};
 if(chapter===0){
   const selected=level===3?d-k:k;
   q.prompt=level===3?`구슬 ${total}개를 ${size}개씩 똑같이 묶었습니다.\n그중 ${k}묶음을 상자에 넣었습니다.\n상자에 넣지 않은 구슬은 처음 구슬 전체의 몇 분의 몇인가요?`:`구슬 ${total}개를 ${size}개씩 똑같이 묶었습니다.\n${k*size}개는 전체의 몇 분의 몇인가요?`;
   q.answer=`${selected}/${d}`; q.diagram={groups:d,size,selected}; q.visual=level===1;
   q.explanation=`전체 ${d}묶음 중 ${selected}묶음이므로 ${d}분의 ${selected}이에요.`;
   q.hints=[`${total}개를 ${size}개씩 묶으면 전체는 몇 묶음일까요?`,level===3?`전체 ${d}묶음에서 상자에 넣은 ${k}묶음을 빼 보세요.`:`${k*size}개를 ${size}개씩 묶으면 ${k}묶음이에요. 전체 묶음 수와 비교해 보세요.`];
 } else if(chapter===1) {
   q.kind="number";q.prompt=level===3?`색종이 ${total}장의 ${d}분의 ${k}을 사용했습니다.\n사용하지 않은 색종이는 몇 장인가요?`:`색종이 ${total}장을 ${d}묶음으로 똑같이 나누었습니다.\n전체의 ${d}분의 ${k}은 몇 장인가요?`;
   q.answer=String(level===3?total-k*size:k*size);q.diagram={groups:d,size,selected:k};q.visual=level===1;
   q.explanation=`한 묶음은 ${size}장, ${k}묶음은 ${k*size}장이에요.${level===3?` 남은 색종이는 ${total}장에서 ${k*size}장을 뺀 ${total-k*size}장이에요.`:""}`;
   q.hints=[`${total}장을 ${d}묶음으로 똑같이 나누면 한 묶음은 몇 장일까요?`,`한 묶음은 ${size}장이에요. ${k}묶음의 장수를 구해 보세요.`];
 } else if(chapter===2) {
   if(level===1){const a=rand(1,d*2);q.kind="choice";q.prompt=`${d}분의 ${a}은 어떤 분수인가요?`;q.choices=["진분수","가분수"];q.answer=a<d?"진분수":"가분수";q.explanation=a<d?"분자가 분모보다 작으므로 진분수예요.":"분자가 분모와 같거나 크므로 가분수예요.";q.hints=["분자와 분모를 비교해 보세요.","분자가 분모와 같아도 가분수예요."];}
   else {const whole=rand(1,3),a=whole*d+k;q.kind=level===2?"mixed":"fraction";q.prompt=level===2?`${d}분의 ${a}을 대분수로 나타내세요.`:`${whole}과 ${d}분의 ${k}을 가분수로 나타내세요.`;q.answer=level===2?`${whole} ${k}/${d}`:`${a}/${d}`;q.explanation=`${d}분의 1이 ${d}개 모이면 1이에요. ${d}분의 ${a}과 ${whole}과 ${d}분의 ${k}은 같은 양이에요.`;q.hints=[`${d}분의 1이 몇 개 모이면 1이 될까요?`,level===2?`${a}개를 ${d}개씩 묶어 보세요. 완성된 묶음은 ${whole}개예요.`:`1에는 ${d}분의 1이 ${d}개 있어요. ${whole}에는 몇 개 있을까요?`];}
 } else {
   q.kind="choice";
   if(level===1){const a=rand(1,d-1),b=a+1;q.choices=rand(0,1)?[`${a}/${d}`,`${b}/${d}`]:[`${b}/${d}`,`${a}/${d}`];q.prompt="두 분수 중 더 큰 분수를 고르세요.";q.answer=`${b}/${d}`;q.explanation="분모가 같으므로 분자가 큰 분수가 더 커요.";q.hints=["분모가 같은지 살펴보세요.","같은 크기의 조각이 더 많이 모인 쪽을 골라 보세요."];}
   else {const whole=rand(1,3),a=whole*d+k,b=a+1;const left=`${whole} ${k}/${d}`,right=`${b}/${d}`;q.choices=["민수","지우"];q.prompt=`민수는 길이가 ${whole}과 ${d}분의 ${k} m인 끈을,\n지우는 길이가 ${d}분의 ${b} m인 끈을 가지고 있습니다.\n누구의 끈이 더 긴가요?`;q.answer="지우";q.explanation=`민수의 ${left}은 ${a}/${d}과 같아요. ${b}/${d}이 더 크므로 지우의 끈이 더 길어요.`;q.hints=[level===2?`민수의 대분수를 가분수로 바꾸어 보세요.`:"두 끈의 길이를 같은 분수 표현으로 나타내어 보세요.",`민수의 끈은 ${d}분의 ${a} m예요. 분자를 비교해 보세요.`];if(rand(0,1)){q.prompt=q.prompt.replaceAll("민수","임시").replaceAll("지우","민수").replaceAll("임시","지우");q.answer="민수";q.explanation=q.explanation.replaceAll("민수","임시").replaceAll("지우","민수").replaceAll("임시","지우");q.hints=q.hints.map(h=>h.replaceAll("민수","지우"));}void right;}
 }
 return q;
}
function fraction(s:string){const m=/^(\d{1,3})\/(\d{1,3})$/.exec(s);return m&&+m[2]>0?[+m[1],+m[2]]:null}
export function isCorrect(q:Question,input:unknown):boolean{
 if(typeof input!=="string"||input.length>20)return false;
 const s=input.trim();
 if(q.kind==="fraction"){const a=fraction(s),b=fraction(q.answer);return !!a&&!!b&&a[0]*b[1]===b[0]*a[1]}
 if(q.kind==="mixed"){const a=/^(\d{1,2}) (\d{1,3}\/\d{1,3})$/.exec(s),b=q.answer.split(" ");if(!a)return false;const f=fraction(a[2]),g=fraction(b[1]);return !!f&&!!g&&f[0]>0&&f[0]<f[1]&&+a[1]===+b[0]&&f[0]*g[1]===g[0]*f[1]}
 if(q.kind==="number")return /^\d{1,3}$/.test(s)&&Number(s)===Number(q.answer);
 return s===q.answer;
}
export function publicQuestion(q:Question,hints=0){const {answer,explanation,hints:all,...rest}=q;void answer;void explanation;return {...rest,hints:all.slice(0,hints),hintCount:all.length,diagram:q.visual||hints>0?q.diagram:undefined}}
