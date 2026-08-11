import { useEffect, useState } from 'react'
let cache = null
export function useSiteContent() {
  const [content,setContent]=useState(cache || {})
  useEffect(()=>{if(cache)return;let active=true;import('../lib/supabase').then(({supabase})=>supabase?.from('site_content').select('key,value')).then((result)=>{if(!active||!result)return;cache=Object.fromEntries((result.data||[]).map((row)=>[row.key,row.value]));setContent(cache)});return()=>{active=false}},[])
  return content
}
