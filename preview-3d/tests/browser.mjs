import {makeQuestion} from "../src/questions.ts";
import {STAGES,stageBlocks,blockLevel,PROGRESS_KEY} from "../src/stages.ts";
import {chromium} from "playwright";
import {spawn} from "node:child_process";
import {mkdir} from "node:fs/promises";
import assert from "node:assert/strict";
const server=spawn(process.execPath,["serve-preview.mjs","--no-open"],{stdio:"inherit"});
let browser,page;
try{
 for(let i=0;i<60;i++){try{const r=await fetch("http://127.0.0.1:5174");if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
 page=await browser.newPage({viewport:{width:1200,height:950}});const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:5174");await page.getByRole("button",{name:"4번 블록, 쉬움"}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('[aria-label="4번 블록, 쉬움"]').disabled);
 assert.equal(await page.locator("canvas").count(),1,"StrictMode must not leave duplicate canvases");
 await mkdir("test-results",{recursive:true});await page.screenshot({path:"test-results/3d-desktop.png",fullPage:true});
 console.log("PREVIEW_DESKTOP_IMAGE:"+(await page.locator(".arena").screenshot({type:"jpeg",quality:65})).toString("base64"));

 async function idle(){
  await page.waitForFunction(()=>/블록의 맞히고 싶은 곳|작전 성공/.test(document.querySelector(".arena-status").textContent),{},{timeout:60000});
 }
 async function fireAt(id,wrong=false){
  const before=Number(await page.getByTestId("remaining").innerText());
  await page.locator('.block-buttons button').filter({hasText:new RegExp("^"+id+"$")}).click();
  await page.getByRole("button",{name:"문제 풀고 공격하기"}).click();
  const stageId=Number(await page.getByLabel("단계 선택",{exact:true}).inputValue());
  const seed=Number(await page.locator(".question-text").getAttribute("data-question-id"));
  const q=makeQuestion(stageId,blockLevel(stageId,id),seed);
  assert.equal(await page.locator(".question-text").innerText(),q.prompt);
  if(q.expression)assert.equal(await page.getByTestId("expression").locator("[data-math]").getAttribute("data-math"),q.expression);
  if(wrong){
   const previousMistakes=Number(await page.getByTestId("mistake-count").innerText());
   await page.getByLabel("분자",{exact:true}).fill("99");await page.getByLabel("분모",{exact:true}).fill("7");await page.getByRole("button",{name:"정답 확인"}).click();
   assert.equal(await page.getByRole("button",{name:"대포 발사!"}).count(),0);
   assert.equal(Number(await page.getByTestId("mistake-count").innerText()),previousMistakes+1);
   const [a,d]=q.answer.split("/").map(Number);
   await page.getByLabel("분자",{exact:true}).fill(String(a*2));
   await page.getByLabel("분모",{exact:true}).fill(String(d*2));
   await page.getByRole("button",{name:"정답 확인"}).click();
   assert.equal(await page.getByRole("button",{name:"대포 발사!"}).count(),0,"Equivalent but differently written fractions must not unlock firing");
   assert.equal(Number(await page.getByTestId("mistake-count").innerText()),previousMistakes+2);
  }
  if(q.kind==="fraction"||q.kind==="mixed"){
   const [wholePart,fractionPart]=q.kind==="mixed"?q.answer.split(" "):["",q.answer];
   const [n,d]=fractionPart.split("/");
   if(q.kind==="mixed")await page.getByLabel("자연수 부분",{exact:true}).fill(wholePart);
   await page.getByLabel("분자",{exact:true}).fill(n);await page.getByLabel("분모",{exact:true}).fill(d);
  }else if(q.kind==="number")await page.getByLabel("장수",{exact:true}).fill(q.answer);
  else await page.getByRole("radio").nth(q.choices.indexOf(q.answer)).check();
  await page.getByRole("button",{name:"정답 확인"}).click();
  await page.getByRole("button",{name:"대포 발사!"}).click();
  await page.getByText("블록이 멈출 때까지 기다려 주세요.",{exact:true}).waitFor();
  assert.equal(await page.locator(".block-buttons button:enabled").count(),0);
  const started=Date.now();await idle();
  const remaining=Number(await page.getByTestId("remaining").innerText());
  console.log("BROWSER_SHOT:"+JSON.stringify({stage:stageId,id,kind:q.kind,before,remaining,waitMs:Date.now()-started}));
  return remaining;
 }

 async function ids(){return (await page.locator(".block-buttons button").allTextContents()).map(Number);}
 async function finishCurrent(){
  let attempts=0;
  while(Number(await page.getByTestId("remaining").innerText())>0&&attempts<45){
   const remaining=await ids(),id=[3,7,1,2,5,6,14,15,13].find(id=>remaining.includes(id))??remaining[0];
   await fireAt(id);attempts++;
  }
  assert.equal(await page.getByTestId("remaining").innerText(),"0","Every structure must be clearable");
  return attempts;
 }
 await fireAt(4,true);
 assert((await ids()).includes(8),"An upper-left shot leaves the right tower");
 await finishCurrent();
 assert.equal(await page.getByTestId("mistake-count").innerText(),"2");
 assert.equal(await page.getByTestId("mistake-penalty").innerText(),"−300");
 assert.equal(await page.getByTestId("clean-bonus").innerText(),"+0");
 console.log("BROWSER_SCORE:"+JSON.stringify({mistakes:2,penalty:300,score:Number(await page.getByTestId("score-total").innerText())}));
 await page.getByRole("button",{name:"처음부터 다시",exact:true}).click();await idle();
 assert.equal(await page.getByTestId("mistake-count").innerText(),"0");
 await fireAt(3);
 for(const id of [5,6,7,8])assert((await ids()).includes(id),"One beam cannot clear the opposite tower");
 for(let i=0;i<4&&(await ids()).includes(3);i++)await fireAt(3);
 for(const id of [5,6,7,8])assert((await ids()).includes(id),"A local collapse must leave the other bridge to solve");
 await page.screenshot({path:"test-results/independent-towers.png",fullPage:true});
 console.log("PREVIEW_ISOLATED_IMAGE:"+(await page.locator(".arena").screenshot({type:"jpeg",quality:70})).toString("base64"));
 await finishCurrent();
 await page.getByRole("heading",{name:"멋진 작전이었어요!"}).waitFor();
 assert.equal(await page.getByTestId("clean-bonus").innerText(),"+200");
 assert.equal(await page.getByTestId("mistake-penalty").innerText(),"−0");
 assert.equal(await page.locator(".block-buttons button").count(),0);
 assert.equal(await page.getByRole("button",{name:"문제 풀고 공격하기"}).count(),0);
 const canvas=page.locator("canvas"),rect=await canvas.boundingBox();
 for(const x of [.3,.5,.7])for(const y of [.55,.65,.75])await canvas.click({position:{x:rect.width*x,y:rect.height*y}});
 assert.equal(await page.getByTestId("remaining").innerText(),"0");
 assert.equal(await page.getByRole("button",{name:"문제 풀고 공격하기"}).count(),0);
 await page.screenshot({path:"test-results/3d-completed.png",fullPage:true});
 console.log("COMPLETION_CHECK:"+JSON.stringify({remaining:0,debrisClicks:9}));
 await page.getByRole("button",{name:"처음부터 다시",exact:true}).click();await idle();
 await fireAt(4);
 assert(await page.locator(".block-buttons button:enabled").count()>0);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log("PREVIEW_MOBILE_IMAGE:"+(await page.locator(".arena").screenshot({type:"jpeg",quality:65})).toString("base64"));
 await page.screenshot({path:"test-results/3d-mobile.png",fullPage:true});
 await page.getByRole("button",{name:"처음부터 다시",exact:true}).click();await idle();
 assert.equal(Number(await page.getByTestId("remaining").innerText()),STAGES[0].count);
 const campaign=[await finishCurrent()];
 for(let stageId=2;stageId<=12;stageId++){
  await page.getByRole("button",{name:"다음 단계로",exact:true}).click();await idle();
  assert.equal(await page.getByLabel("단계 선택",{exact:true}).inputValue(),String(stageId));
  assert.equal(Number(await page.getByTestId("remaining").innerText()),STAGES[stageId-1].count);
  assert.equal(await page.locator("canvas").count(),1);
  if([4,7,10,12].includes(stageId)){
   await page.screenshot({path:"test-results/structure-stage-"+stageId+".png",fullPage:true});
   if(stageId===12)console.log("PREVIEW_STAGE12_IMAGE:"+(await page.locator(".arena").screenshot({type:"jpeg",quality:75})).toString("base64"));
  }
  let extras=0;
  // Preserve all four answer formats: stage 7's cap is easy classification,
  // its middle block is improper -> mixed, and its bridge is mixed -> improper.
  if(stageId===7){await fireAt(11);await fireAt(4);extras=2;}
  campaign.push(extras+await finishCurrent());
 }
 await page.getByRole("heading",{name:"12단계 모두 성공!"}).waitFor();
 assert.equal(await page.getByRole("button",{name:"다음 단계로",exact:true}).count(),0);
 assert(campaign[11]>campaign[0],"Later structures require more solved shots");
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROGRESS_KEY);
 assert.equal(saved.completed.length,12);assert.equal(saved.unlocked,12);
 await page.reload();await idle();
 assert.equal(await page.getByLabel("단계 선택",{exact:true}).inputValue(),"12");
 await page.getByLabel("단계 선택",{exact:true}).selectOption("7");await idle();
 assert.equal(Number(await page.getByTestId("remaining").innerText()),STAGES[6].count);
 console.log("CAMPAIGN_CHECK:"+JSON.stringify({completed:12,persisted:true,replay:true,formats:4,shots:campaign}));
 assert.equal(await page.locator("canvas").count(),1);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:["independent bridges","progressively larger structures","all question formats","exact fraction grading","score and retries","12-stage campaign","debris excluded","saved progress","mobile width","reset disposal"],errors}));
}catch(error){
 if(page){console.log("BROWSER_FAILURE:"+JSON.stringify(await page.locator("body").innerText()));console.log("PREVIEW_FAILURE_IMAGE:"+(await page.locator(".arena").screenshot({type:"jpeg",quality:65})).toString("base64"));}
 throw error;
}finally{if(browser)await browser.close();server.kill();}
