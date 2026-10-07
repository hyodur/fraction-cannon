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
 await page.getByRole("button",{name:"9번 블록, 쉬움"}).click();await page.getByRole("button",{name:"문제 풀고 공격하기"}).click();
 const prompt=await page.locator(".question-text").innerText(),[total,size,part]=prompt.match(/\d+/g).map(Number);
 await page.getByLabel("분자",{exact:true}).fill("99");await page.getByLabel("분모",{exact:true}).fill("7");await page.getByRole("button",{name:"정답 확인"}).click();
 assert.equal(await page.getByRole("button",{name:"대포 발사!"}).count(),0);
 await page.getByLabel("분자",{exact:true}).fill(String(part/size));await page.getByLabel("분모",{exact:true}).fill(String(total/size));await page.getByRole("button",{name:"정답 확인"}).click();
 await page.getByRole("button",{name:"대포 발사!"}).click();
 await page.getByText("블록이 멈출 때까지 기다려 주세요.",{exact:true}).waitFor();
 assert.equal(await page.locator(".block-buttons button:enabled").count(),0);
 await page.waitForFunction(()=>document.querySelector('[data-testid="remaining"]').textContent!=="9",{},{timeout:90000});
 await page.getByText("블록의 맞히고 싶은 곳을 눌러 조준하세요.",{exact:true}).waitFor({timeout:90000});
 assert(Number(await page.getByTestId("remaining").innerText())>0);
 await page.screenshot({path:"test-results/3d-after-fall.png",fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:"test-results/3d-mobile.png",fullPage:true});
 console.log("PREVIEW_MOBILE_IMAGE:"+(await page.locator(".arena").screenshot({type:"jpeg",quality:65})).toString("base64"));
 await page.getByRole("button",{name:"처음부터 다시",exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="remaining"]').textContent==="9");
 assert.equal(await page.locator("canvas").count(),1);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:["real WebGL canvas","wrong/right answers","locked flight","3D fall","settling","mobile width","reset disposal"],errors}));
}catch(error){
 if(page){console.log("BROWSER_FAILURE:"+JSON.stringify(await page.locator("body").innerText()));console.log("PREVIEW_FAILURE_IMAGE:"+(await page.locator(".arena").screenshot({type:"jpeg",quality:65})).toString("base64"));}
 throw error;
}finally{if(browser)await browser.close();server.kill();}
