import { useEffect } from 'react'
import { sendAnalyticsEvent } from '../lib/analytics'

export default function AnalyticsTracker(){
  useEffect(()=>{
    let lastPath='',lastActivity=Date.now()
    const activity=()=>{lastActivity=Date.now()}
    const pageview=()=>{const path=location.pathname;if(path!==lastPath&&!path.startsWith('/admin')){lastPath=path;sendAnalyticsEvent('pageview')}}
    const heartbeat=()=>{if(document.visibilityState==='visible'&&Date.now()-lastActivity<120000)sendAnalyticsEvent('heartbeat')}
    const visibility=()=>{if(document.visibilityState==='visible'){activity();heartbeat()}}
    const originalPush=history.pushState,originalReplace=history.replaceState
    history.pushState=function(...args){originalPush.apply(this,args);queueMicrotask(pageview)}
    history.replaceState=function(...args){originalReplace.apply(this,args);queueMicrotask(pageview)}
    pageview()
    const timer=setInterval(heartbeat,45000)
    addEventListener('popstate',pageview);addEventListener('pointerdown',activity,{passive:true});addEventListener('keydown',activity,{passive:true});addEventListener('scroll',activity,{passive:true});document.addEventListener('visibilitychange',visibility)
    return()=>{clearInterval(timer);removeEventListener('popstate',pageview);removeEventListener('pointerdown',activity);removeEventListener('keydown',activity);removeEventListener('scroll',activity);document.removeEventListener('visibilitychange',visibility);history.pushState=originalPush;history.replaceState=originalReplace}
  },[])
  return null
}
