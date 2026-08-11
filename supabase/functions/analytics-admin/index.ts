import { bearerToken, corsHeaders, json } from '../_shared/http.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase.ts'

async function requireAdmin(request:Request){const token=bearerToken(request);if(!token)return null;const client=createUserClient(token);const {data:{user}}=await client.auth.getUser(token);return user?.app_metadata?.role==='admin'?user:null}
Deno.serve(async(request)=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(request.method!=='POST')return json({error:'Method not allowed.'},405)
  if(!await requireAdmin(request))return json({error:'Nemáte oprávnenie.'},403)
  let body:any;try{body=await request.json()}catch{body={}}
  const range=['24h','7d','30d','90d','12m'].includes(body.range)?body.range:'7d'
  const {data,error}=await createAdminClient().rpc('analytics_admin_snapshot',{p_range:range})
  return error?json({error:'Analytiku sa nepodarilo načítať.'},500):json(data)
})
