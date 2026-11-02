import { useEffect } from 'react'
import { useProfile } from '../context/profile-context'
import { useViewerProfile } from '../context/viewer-profile-context'
import { onboardingCheckoutPath } from '../lib/auth-flow'
import { isActiveClubMember } from '../lib/membership'
import '../profiles.css'

function Avatar({kind}){return <span className={`viewer-avatar is-${kind}`}><i>V</i>B</span>}
export default function ProfileSelectionPage(){
  const {session,profile,authLoading,profileLoading}=useProfile();const {profiles,loading,error,selectProfile}=useViewerProfile();const active=isActiveClubMember(profile,session?.user?.app_metadata?.role==='admin')
  useEffect(()=>{if(authLoading||profileLoading)return;if(!session)window.location.replace('/prihlasenie');else if(!active)window.location.replace(onboardingCheckoutPath)},[active,authLoading,profileLoading,session])
  const choose=(item)=>{if(selectProfile(item))window.location.assign('/')}
  if(authLoading||profileLoading||loading||!session||!active)return <main className="profile-screen"><div className="profile-spinner" aria-label="Načítavam profily"/></main>
  return <main className="profile-screen"><a className="profile-brand" href="/"><i>V</i>B<span>VÝCHOD BROTHERS</span></a><section><h1>Kto sa pozerá?</h1>{error&&<p className="profile-error">{error}</p>}<div className="profile-grid">{profiles.map((item)=><button className="profile-tile" type="button" onClick={()=>choose(item)} key={item.id}><Avatar kind={item.avatar_key}/><strong>{item.name}</strong></button>)}{profiles.length<4&&<a className="profile-tile add-profile" href="/profily/novy"><span>+</span><strong>Pridať profil</strong></a>}</div><a className="manage-profiles" href="/profily/sprava">Spravovať profily</a></section></main>
}
