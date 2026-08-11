import { supabase } from './supabase'

const VISITOR_KEY='vb_analytics_visitor_v1',SESSION_KEY='vb_analytics_session_v1'
const createId=()=>crypto.randomUUID()
let visitorId=''
try{visitorId=sessionStorage.getItem(VISITOR_KEY)||''}catch{/* Storage can be unavailable in strict privacy mode. */}
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('vb_analytics_presence'):null
if(channel)channel.onmessage=(event)=>{if(event.data?.type==='request'&&visitorId)channel.postMessage({type:'provide',id:visitorId});if(event.data?.type==='provide'&&!visitorId){visitorId=event.data.id;try{sessionStorage.setItem(VISITOR_KEY,visitorId)}catch{/* Ephemeral fallback stays in memory. */}}}
let visitorPromise
const readVisitor=()=>{if(visitorId)return Promise.resolve(visitorId);if(!visitorPromise)visitorPromise=new Promise((resolve)=>{channel?.postMessage({type:'request'});setTimeout(()=>{if(!visitorId){visitorId=createId();try{sessionStorage.setItem(VISITOR_KEY,visitorId)}catch{/* Ephemeral fallback stays in memory. */}}resolve(visitorId)},120)});return visitorPromise}
const readSession=()=>{try{let id=sessionStorage.getItem(SESSION_KEY);if(!id){id=createId();sessionStorage.setItem(SESSION_KEY,id)}return id}catch{return createId()}}
const normalizePath=()=>window.location.pathname||'/'
export async function sendAnalyticsEvent(type){if(normalizePath().startsWith('/admin')||document.visibilityState==='hidden')return;try{await supabase.functions.invoke('analytics-track',{body:{type,visitorId:await readVisitor(),sessionId:readSession(),path:normalizePath(),referrer:type==='pageview'?document.referrer:''}})}catch{/* Analytics must never interrupt the public site. */}}
export async function getAdminAnalytics(range='7d'){const {data,error}=await supabase.functions.invoke('analytics-admin',{body:{range}});if(error||data?.error)throw new Error(data?.error||'Analytiku sa nepodarilo načítať.');return data}
