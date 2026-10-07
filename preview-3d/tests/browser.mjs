import {makeQuestion} from "../src/questions.ts";
import {STAGES,blockLevel,PROGRESS_KEY} from "../src/stages.ts";
import {chromium} from "playwright";
import {spawn} from "node:child_process";
import {mkdir} from "node:fs/promises";
import assert from "node:assert/strict";
const server=spawn(process.execPath,["serve-preview.mjs","--no-open"],{stdio:"inherit"});
let browser,page;
try{
 for(let i=0;i<60;i++){try{const r=await fetch("http://127.0.0.1:5174");if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
 page=await browser.newPage({viewport:{width:1200,height:950}});const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:5174");await page.getByRole("button",{name:"9번 블록, 쉬움"}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('[aria-label="9번 블록, 쉬움"]').disabled);
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
   await page.getByLabel("분자",{exact:true}).fill("99");await page.getByLabel("분모",{exact:true}).fill("7");await page.getByRole("button",{name:"정답 확인"}).click();
   assert.equal(await page.getByRole("button",{name:"대포 발사!"}).count(),0);
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
 await fireAt(5,true);
 const afterNormal=Number(await page.getByTestId("remaining").innerText());
 assert(afterNormal>=6&&afterNormal<=8,"A normal hit must remove some blocks and leave the base");
 await page.screenshot({path:"test-results/3d-normal-hit.png",fullPage:true});
 console.log("PREVIEW_NORMAL_IMAGE:"+(await page.locator(".arena").screenshot({type:"jpeg",quality:65})).toString("base64"));
 for(const id of [9,8,7,6,4,3,2,1]){
  if(await page.locator(".block-buttons button").filter({hasText:new RegExp("^"+id+"$")}).count())await fireAt(id);
 }
 // Check the load-bearing beam is a challenge and reaches more blocks.
 await page.getByRole("button",{name:"처음부터 다시",exact:true}).click();await idle();
 await page.getByRole("button",{name:"3번 블록, 도전"}).waitFor();
 const afterChallenge=await fireAt(3);
 assert(afterChallenge<afterNormal,"Challenge beam should have a larger effect than a normal block");
 // If a support survives on the shelf, finish it. Floor piles must never
 // require an extra question to make them short enough for a floor-height rule.
 for(let i=0;i<6&&Number(await page.getByTestId("remaining").innerText())>0;i++){
  const id=Number(await page.locator(".block-buttons button").first().innerText());await fireAt(id);
 }
 assert.equal(await page.getByTestId("remaining").innerText(),"0");
 await page.getByRole("heading",{name:"멋진 작전이었어요!"}).waitFor();
 assert.equal(await page.locator(".block-buttons button").count(),0);
 assert.equal(await page.getByRole("button",{name:"문제 풀고 공격하기"}).count(),0);
 assert.equal(await page.getByRole("button",{name:"대포 발사!"}).count(),0);
 // Click across the visible debris region; completion must not reopen aiming.
 const canvas=page.locator("canvas"),rect=await canvas.boundingBox();
 for(const x of [.4,.5,.6])for(const y of [.55,.65,.75]){
  await canvas.click({position:{x:rect.width*x,y:rect.height*y}});
 }
 await page.getByRole("heading",{name:"멋진 작전이었어요!"}).waitFor();
 assert.equal(await page.getByTestId("remaining").innerText(),"0");
 assert.equal(await page.getByRole("button",{name:"문제 풀고 공격하기"}).count(),0);
 await page.screenshot({path:"test-results/3d-completed.png",fullPage:true});
 console.log("PREVIEW_COMPLETED_IMAGE:"+(await page.screenshot({type:"jpeg",quality:65,fullPage:true})).toString("base64"));
 console.log("COMPLETION_CHECK:"+JSON.stringify({remaining:0,targetButtons:0,attackButtons:0,debrisClicks:9}));
 // A clean top-first shot must also unlock the next selection.
 await page.getByRole("button",{name:"처음부터 다시",exact:true}).click();await idle();
 await fireAt(9);
 assert(Number(await page.getByTestId("remaining").innerText())>0);
 assert(await page.locator(".block-buttons button:enabled").count()>0);
 await page.screenshot({path:"test-results/3d-after-fall.png",fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:"test-results/3d-mobile.png",fullPage:true});
 console.log("PREVIEW_MOBILE_IMAGE:"+(await page.locator(".arena").screenshot({type:"jpeg",quality:65})).toString("base64"));
 await page.getByRole("button",{name:"처음부터 다시",exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="remaining"]').textContent==="9");

 // Complete and advance all stages through the same question/fire UI.
 async function finishCurrent(){
  let attempts=0;
  while(Number(await page.getByTestId("remaining").innerText())>0&&attempts<35){
   const ids=(await page.locator(".block-buttons button").allTextContents()).map(Number);
   const id=ids.includes(3)?3:ids.find(id=>id>3)??ids[0];
   await fireAt(id);attempts++;
  }
  assert.equal(await page.getByTestId("remaining").innerText(),"0","Every stage must reach the success screen");
 }
 await finishCurrent();
 for(let stageId=2;stageId<=12;stageId++){
  await page.getByRole("button",{name:"다음 단계로",exact:true}).click();await idle();
  assert.equal(await page.getByLabel("단계 선택",{exact:true}).inputValue(),String(stageId));
  assert.equal(Number(await page.getByTestId("remaining").innerText()),STAGES[stageId-1].count);
  assert.equal(await page.locator("canvas").count(),1,"Stage transition must dispose the old renderer");
  // Stage 7 checks easy classification, mixed-answer input, then challenge conversion.
  if(stageId===7){await fireAt(9);await fireAt(4);}
  else await fireAt(5);
  await finishCurrent();
  if([4,7,10,12].includes(stageId))await page.screenshot({path:"test-results/stage-"+stageId+".png",fullPage:true});
 }
 await page.getByRole("heading",{name:"12단계 모두 성공!"}).waitFor();
 assert.equal(await page.getByRole("button",{name:"다음 단계로",exact:true}).count(),0);
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROGRESS_KEY);
 assert.equal(saved.completed.length,12);assert.equal(saved.unlocked,12);
 await page.reload();await idle();
 assert.equal(await page.getByLabel("단계 선택",{exact:true}).inputValue(),"12");
 await page.getByLabel("단계 선택",{exact:true}).selectOption("7");await idle();
 assert.equal(Number(await page.getByTestId("remaining").innerText()),11);
 console.log("CAMPAIGN_CHECK:"+JSON.stringify({completed:12,persisted:true,replay:true,formats:4}));
 assert.equal(await page.locator("canvas").count(),1);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:["real WebGL canvas","wrong/right answers","middle hit","repeated shots","top-first settling","completion at zero","debris cannot be selected","12-stage campaign","all question formats","saved progress","mobile width","reset disposal"],errors}));
}catch(error){
 if(page){console.log("BROWSER_FAILURE:"+JSON.stringify(await page.locator("body").innerText()));console.log("PREVIEW_FAILURE_IMAGE:"+(await page.locator(".arena").screenshot({type:"jpeg",quality:65})).toString("base64"));}
 throw error;
}finally{if(browser)await browser.close();server.kill();}
