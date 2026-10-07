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
  const prompt=await page.locator(".question-text").innerText(),[total,size,part]=prompt.match(/\d+/g).map(Number);
  if(wrong){
   await page.getByLabel("분자",{exact:true}).fill("99");await page.getByLabel("분모",{exact:true}).fill("7");await page.getByRole("button",{name:"정답 확인"}).click();
   assert.equal(await page.getByRole("button",{name:"대포 발사!"}).count(),0);
  }
  const denominator=total/size,numerator=prompt.includes("넣지 않은")?denominator-part:part/size;
  await page.getByLabel("분자",{exact:true}).fill(String(numerator));await page.getByLabel("분모",{exact:true}).fill(String(denominator));await page.getByRole("button",{name:"정답 확인"}).click();
  await page.getByRole("button",{name:"대포 발사!"}).click();
  await page.getByText("블록이 멈출 때까지 기다려 주세요.",{exact:true}).waitFor();
  assert.equal(await page.locator(".block-buttons button:enabled").count(),0);
  const started=Date.now();await idle();
  const remaining=Number(await page.getByTestId("remaining").innerText());
  console.log("BROWSER_SHOT:"+JSON.stringify({id,before,remaining,waitMs:Date.now()-started}));
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
 assert.equal(await page.locator("canvas").count(),1);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:["real WebGL canvas","wrong/right answers","middle hit","repeated shots","top-first settling","completion at zero","debris cannot be selected","mobile width","reset disposal"],errors}));
}catch(error){
 if(page){console.log("BROWSER_FAILURE:"+JSON.stringify(await page.locator("body").innerText()));console.log("PREVIEW_FAILURE_IMAGE:"+(await page.locator(".arena").screenshot({type:"jpeg",quality:65})).toString("base64"));}
 throw error;
}finally{if(browser)await browser.close();server.kill();}
