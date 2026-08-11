import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export type AdminNotification={type:string;title:string;message:string;entityType?:string|null;entityId?:string|null;targetUrl:string;metadata?:Record<string,unknown>;dedupeKey:string}
export async function notifyAdmin(admin:SupabaseClient,input:AdminNotification){
  const {error}=await admin.from('admin_notifications').insert({type:input.type,title:input.title,message:input.message,entity_type:input.entityType||null,entity_id:input.entityId||null,target_url:input.targetUrl,metadata:input.metadata||{},dedupe_key:input.dedupeKey})
  if(error&&error.code!=='23505')throw error
}
