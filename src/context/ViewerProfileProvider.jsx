import { useCallback,useEffect,useMemo,useState } from 'react'
import { supabase } from '../lib/supabase'
import { useProfile } from './profile-context'
import { ViewerProfileContext } from './viewer-profile-context'

const columns='id,owner_id,name,avatar_key,is_primary,created_at,updated_at'
const storageKey=(userId)=>`vb-active-viewer:${userId}`

export default function ViewerProfileProvider({children}){
  const {session}=useProfile();const [profiles,setProfiles]=useState([]);const [activeProfile,setActiveProfile]=useState(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('')
  const refresh=useCallback(async()=>{if(!supabase||!session?.user?.id)return[];setLoading(true);const {data,error:queryError}=await supabase.from('viewer_profiles').select(columns).order('is_primary',{ascending:false}).order('created_at');setLoading(false);if(queryError){setError('Profily sa nepodarilo načítať.');return[]}setError('');setProfiles(data||[]);const saved=localStorage.getItem(storageKey(session.user.id));setActiveProfile((current)=>(data||[]).find((item)=>item.id===(current?.id||saved))||null);return data||[]},[session?.user?.id])
  useEffect(()=>{if(!session?.user?.id){setProfiles([]);setActiveProfile(null);setError('');return}refresh()},[refresh,session?.user?.id])
  const selectProfile=useCallback((profile)=>{if(!session?.user?.id||profile.owner_id!==session.user.id)return false;localStorage.setItem(storageKey(session.user.id),profile.id);setActiveProfile(profile);return true},[session?.user?.id])
  const clearActiveProfile=useCallback(()=>{if(session?.user?.id)localStorage.removeItem(storageKey(session.user.id));setActiveProfile(null)},[session?.user?.id])
  const value=useMemo(()=>({profiles,activeProfile,loading,error,refresh,selectProfile,clearActiveProfile}),[profiles,activeProfile,loading,error,refresh,selectProfile,clearActiveProfile])
  return <ViewerProfileContext.Provider value={value}>{children}</ViewerProfileContext.Provider>
}
