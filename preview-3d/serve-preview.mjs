import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import {resolve,sep,extname,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFile} from "node:child_process";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"dist");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml"};
try{await stat(resolve(root,"index.html"));}catch{console.error("실행 파일이 없어요. GitHub 검사 결과에서 받은 ZIP을 모두 압축 해제한 뒤 실행해 주세요.");process.exit(1);}
const server=createServer(async(req,res)=>{
 if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405);res.end();return;}
 try{
  const pathname=decodeURIComponent(new URL(req.url||"/","http://localhost").pathname);
  const target=resolve(root,"."+pathname+(pathname.endsWith("/")?"index.html":""));
  if(!target.startsWith(root+sep)||!(await stat(target)).isFile()){res.writeHead(404);res.end();return;}
  const body=await readFile(target);res.writeHead(200,{"Content-Type":types[extname(target)]||"application/octet-stream","Content-Length":body.length,"Cache-Control":"no-store"});
  res.end(req.method==="HEAD"?undefined:body);
 }catch{res.writeHead(404);res.end();}
});
server.on("error",error=>{console.error(error.code==="EADDRINUSE"?"5174번 주소가 이미 사용 중이에요. 기존 3D 실행 창을 확인해 주세요.":error.message);process.exitCode=1;});
server.listen(5174,"127.0.0.1",()=>{
 console.log("분수 팡! 3D 체험: http://127.0.0.1:5174/");
 console.log("게임을 하는 동안 이 창을 켜 두세요. 종료: Ctrl+C");
 if(process.platform==="win32"&&!process.argv.includes("--no-open"))execFile("cmd.exe",["/c","start","","http://127.0.0.1:5174/"],{windowsHide:true},()=>{});
});
