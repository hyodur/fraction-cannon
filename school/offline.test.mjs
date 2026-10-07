import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {spawn,execFileSync} from "node:child_process";
import {readFile,stat} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,join} from "node:path";
import {makeQuestion} from "../preview-3d/src/questions.ts";
import {blockLevel} from "../preview-3d/src/stages.ts";
const require=createRequire(new URL("../preview-3d/package.json",import.meta.url));
const {chromium}=require("playwright");
const root=resolve(process.argv[2]),node=join(root,"runtime","node.exe");
assert.equal(process.platform,"win32");
assert.equal(process.execPath.toLowerCase(),node.toLowerCase(),"The test itself runs on the bundled runtime");
for(const file of ["dist/index.html","runtime/node.exe","게임시작.cmd","학교용_사용방법.txt","licenses/Node.js-LICENSE.txt"])assert((await stat(join(root,file))).isFile());
const env={...process.env,FRACTION_CANNON_NO_PAUSE:"1"};
for(const key of Object.keys(env))if(["path","node_path","node_options"].includes(key.toLowerCase()))delete env[key];
env.Path=join(process.env.SystemRoot,"System32");
let installedNodeVisible=false;
try{execFileSync(join(process.env.SystemRoot,"System32","where.exe"),["node"],{env,stdio:"ignore"});installedNodeVisible=true;}catch{}
assert(!installedNodeVisible,"No installed Node.js may be visible on the test launcher's PATH");
const cmd=join(process.env.SystemRoot,"System32","cmd.exe");
const launcher=spawn(cmd,["/d","/s","/c",'call "'+join(root,"게임시작.cmd")+'" --no-open'],{cwd:process.env.TEMP,env,windowsHide:true,windowsVerbatimArguments:true});
let output="";launcher.stdout.on("data",b=>output+=b);launcher.stderr.on("data",b=>output+=b);
let browser;
try{
 let ready=false;
 for(let i=0;i<120;i++){
  try{const r=await fetch("http://127.0.0.1:5174/");if(r.ok){ready=true;break;}}catch{}
  if(launcher.exitCode!==null)throw new Error("Launcher exited: "+output);
  await new Promise(r=>setTimeout(r,100));
 }
 assert(ready,"Bundled launcher did not serve the game: "+output);
 const candidates=[
  join(process.env["ProgramFiles(x86)"]||"C:/Program Files (x86)","Microsoft/Edge/Application/msedge.exe"),
  join(process.env.ProgramFiles||"C:/Program Files","Google/Chrome/Application/chrome.exe"),
  join(process.env["ProgramFiles(x86)"]||"C:/Program Files (x86)","Google/Chrome/Application/chrome.exe")
 ];
 const executablePath=candidates.find(existsSync);assert(executablePath,"A browser is required on the Windows test runner");
 browser=await chromium.launch({executablePath,args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
 const context=await browser.newContext({viewport:{width:1280,height:960}});
 const external=[],errors=[];
 await context.route("**/*",route=>{
  const u=new URL(route.request().url());
  if(u.hostname==="127.0.0.1"&&u.port==="5174")return route.continue();
  external.push(u.href);return route.abort();
 });
 const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:5174/");
 const idle=()=>page.waitForFunction(()=>/블록의 맞히고 싶은 곳|작전 성공/.test(document.querySelector(".arena-status")?.textContent||""),{},{timeout:60000});
 await idle();
 assert.equal(await page.getByTestId("remaining").innerText(),"8");
 assert.equal(await page.locator("canvas").count(),1);
 let shots=0;
 while(Number(await page.getByTestId("remaining").innerText())>0&&shots<16){
  const ids=(await page.locator(".block-buttons button").allTextContents()).map(Number);
  const id=[3,7,1,2,5,6].find(n=>ids.includes(n))??ids[0];
  await page.locator(".block-buttons button").filter({hasText:new RegExp("^"+id+"$")}).click();
  await page.getByRole("button",{name:"문제 풀고 공격하기"}).click();
  const seed=Number(await page.locator(".question-text").getAttribute("data-question-id"));
  const q=makeQuestion(1,blockLevel(1,id),seed),[n,d]=q.answer.split("/");
  await page.getByLabel("분자",{exact:true}).fill(n);
  await page.getByLabel("분모",{exact:true}).fill(d);
  await page.getByRole("button",{name:"정답 확인"}).click();
  await page.getByRole("button",{name:"대포 발사!"}).click();
  await idle();shots++;
 }
 assert.equal(await page.getByTestId("remaining").innerText(),"0");
 await page.getByRole("button",{name:"다음 단계로",exact:true}).click();await idle();
 assert.equal(await page.getByLabel("단계 선택",{exact:true}).inputValue(),"2");
 assert.equal(await page.getByTestId("remaining").innerText(),"9");
 await page.reload();await idle();
 assert.equal(await page.getByLabel("단계 선택",{exact:true}).inputValue(),"2");
 assert.deepEqual(external,[],"The game must not request any external resources");
 assert.deepEqual(errors,[]);
 const manifest=JSON.parse(await readFile(join(root,"package-info.json"),"utf8"));
 console.log("SCHOOL_PORTABLE_CHECK:"+JSON.stringify({passed:true,platform:process.platform,node:manifest.nodeVersion,pathWithSpacesAndKorean:root.includes("학교 테스트"),installedNodeOnPath:installedNodeVisible,externalRequests:external.length,firstStageCompleted:true,nextStage:true,persisted:true,shots,errors}));
 await page.screenshot({path:resolve("school-offline-test.png"),fullPage:true});
}finally{
 if(browser)await browser.close();
 if(launcher.pid)try{execFileSync(join(process.env.SystemRoot,"System32","taskkill.exe"),["/pid",String(launcher.pid),"/t","/f"],{windowsHide:true,stdio:"ignore"});}catch{}
}
