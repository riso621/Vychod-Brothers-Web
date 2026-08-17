import { json } from '../_shared/http.ts'
import { createAdminClient } from '../_shared/supabase.ts'

Deno.serve(async(request)=>{
  if(request.method!=='GET')return json({error:'Method not allowed.'},405)
  const id=new URL(request.url).searchParams.get('video')||''
  if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:'Not found.'},404)
  const admin=createAdminClient();const {data:video}=await admin.from('videos').select('thumbnail_url,published').eq('id',id).eq('published',true).maybeSingle()
  if(!video?.thumbnail_url)return json({error:'Not found.'},404)
  if(/^https:\/\//i.test(video.thumbnail_url))return Response.redirect(video.thumbnail_url,302)
  const path=video.thumbnail_url.startsWith('thumbnails/')?video.thumbnail_url.slice('thumbnails/'.length):video.thumbnail_url
  const {data,error}=await admin.storage.from('thumbnails').createSignedUrl(path,300)
  if(error||!data?.signedUrl)return json({error:'Not found.'},404)
  return Response.redirect(data.signedUrl,302)
})
