import {player,start,resume,act,ranking,GameError} from "@/lib/server";
export const dynamic="force-dynamic";
function response(data:unknown,cookie?:string,status=200){const headers:Record<string,string>={"Cache-Control":"no-store"};if(cookie)headers["Set-Cookie"]=cookie;return Response.json(data,{status,headers})}
export async function GET(req:Request){try{const {user,cookie}=await player(req),url=new URL(req.url);if(url.searchParams.has("ranking"))return response(await ranking(user,Number(url.searchParams.get("ranking"))),cookie);return response({player:{nickname:user.nickname,unlocked:user.unlocked},run:await resume(user)},cookie)}catch(e){console.error("game GET",e);return response({error:"기록을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요."},undefined,503)}}
export async function POST(req:Request){
 let cookie:string|undefined;
 try{
   const origin=req.headers.get("origin");if(origin&&origin!==new URL(req.url).origin)throw new GameError("허용되지 않은 요청이에요.",403);
   if(!req.headers.get("content-type")?.includes("application/json"))throw new GameError("요청 형식을 확인해 주세요.",415);
   const raw=await req.text();if(raw.length>3000)throw new GameError("요청이 너무 커요.",413);
   const body=JSON.parse(raw);if(!body||typeof body!=="object")throw new GameError("요청을 확인해 주세요.");
   const identity=await player(req);cookie=identity.cookie;
   if(body.action==="start")return response({run:await start(identity.user,body.stage)},cookie);
   return response(await act(identity.user,body),cookie);
 }catch(e){if(e instanceof GameError)return response({error:e.message},cookie,e.status);console.error("game POST",e);return response({error:"연결이 잠시 끊겼어요. 입력한 답을 유지했으니 다시 시도해 주세요."},cookie,503)}
}
