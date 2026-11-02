import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'
import { useViewerProfile } from '../context/viewer-profile-context'

export default function FavoriteButton({videoId}){const {activeProfile}=useViewerProfile();const [favorite,setFavorite]=useState(false);const [loading,setLoading]=useState(false)
  useEffect(()=>{let current=true;if(!activeProfile?.id)return;supabase.from('viewer_favorites').select('video_id').eq('viewer_profile_id',activeProfile.id).eq('video_id',videoId).maybeSingle().then(({data})=>{if(current)setFavorite(Boolean(data))});return()=>{current=false}},[activeProfile?.id,videoId])
  if(!activeProfile)return null
  const toggle=async()=>{setLoading(true);const query=favorite?supabase.from('viewer_favorites').delete().eq('viewer_profile_id',activeProfile.id).eq('video_id',videoId):supabase.from('viewer_favorites').insert({viewer_profile_id:activeProfile.id,video_id:videoId});const {error}=await query;if(!error)setFavorite(!favorite);setLoading(false)}
  return <button className={`favorite-button${favorite?' is-active':''}`} type="button" onClick={toggle} disabled={loading} aria-pressed={favorite}>{favorite?'✓ V mojom zozname':'+ Môj zoznam'}</button>}
