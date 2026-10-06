import type { Question } from "@/lib/questions";

export function Fraction({value}:{value:string}){
 const match=/^(?:(\d+) )?(\d+)\/(\d+)$/.exec(value);
 if(!match)return <>{value}</>;
 const [,whole,n,d]=match;
 const join=whole&&/[013678]$/.test(whole)?"과":"와";
 return <span className="fraction-wrap" role="math" aria-label={`${whole?`${whole}${join} `:""}${d}분의 ${n}`}>
  {whole?<span aria-hidden="true">{whole}</span>:null}
  <span className="fraction" aria-hidden="true"><span>{n}</span><span>{d}</span></span>
 </span>;
}

export function FractionText({text}:{text:string}){
 const saved=/^(\d+)분의 1이 \d+개 모이면 1이에요\. (\d+)분의 (\d+)과 (\d+)과 (\d+)분의 (\d+)은 같은 양이에요\.$/.exec(text);
 if(saved)text=`1/${saved[1]}이 ${saved[1]}개 모이면 1이에요.\n${saved[3]}/${saved[2]} = ${saved[4]} ${saved[6]}/${saved[5]}\n두 분수는 같은 양이에요.`;
 return <>{text.split(/((?:\d+ )?\d+\/\d+)/g).map((part,i)=>/^(?:\d+ )?\d+\/\d+$/.test(part)?<Fraction key={i} value={part}/>:part)}</>;
}

// Saved, already-open questions keep their original text in the database.
// Recognize those prompts without replacing the question or resetting its timer.
function questionDisplay(q:Pick<Question,"prompt"|"expression">){
 if(q.expression)return {expression:q.expression,instruction:q.prompt};
 const mixed=/^(\d+)(?:과|와) (\d+)분의 (\d+)(?:을|를) 가분수로 나타내세요\.$/.exec(q.prompt);
 if(mixed)return {expression:`${mixed[1]} ${mixed[3]}/${mixed[2]}`,instruction:"가분수로 나타내세요."};
 const improper=/^(\d+)분의 (\d+)(?:을|를) 대분수로 나타내세요\.$/.exec(q.prompt);
 if(improper)return {expression:`${improper[2]}/${improper[1]}`,instruction:"대분수로 나타내세요."};
 const classify=/^(\d+)분의 (\d+)(?:은|는) 어떤 분수인가요\?$/.exec(q.prompt);
 if(classify)return {expression:`${classify[2]}/${classify[1]}`,instruction:"어떤 분수인가요?"};
 return {expression:undefined,instruction:q.prompt};
}

export function QuestionPrompt({question}:{question:Pick<Question,"prompt"|"expression">}){
 const {expression,instruction}=questionDisplay(question);
 return <>{expression?<div className="question-expression"><Fraction value={expression}/></div>:null}<p className="question-text">{instruction}</p></>;
}
