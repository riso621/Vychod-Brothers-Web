import { useEffect, useState } from 'react'
import { adminRequest } from '../lib/admin-control-center'
import { cachedAdminLoad } from '../lib/admin-cache'

const date=(value)=>value?new Intl.DateTimeFormat('sk-SK',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—'

export default function AdminEmails(){
  const [data,setData]=useState({deliveries:[],summary:{}}),[loading,setLoading]=useState(true),[email,setEmail]=useState(''),[sending,setSending]=useState(''),[message,setMessage]=useState('')
  const load=async(force=false)=>{setLoading(true);try{setData(await cachedAdminLoad('admin-emails',()=>adminRequest({action:'emails'}),{force}))}catch(error){setMessage(error.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  const send=async(type)=>{if(sending)return;setSending(type);setMessage('');try{await adminRequest({action:'send-test-email',type,email});setMessage('Testovací e-mail bol odoslaný.');await load(true)}catch(error){setMessage(error.message)}finally{setSending('')}}
  const summary=data.summary||{}
  return <section className="admin-emails"><div className="admin-page-heading"><div><span>ADMIN / EMAILS</span><h1>E-mailový systém</h1><p>Transakčné a členské notifikácie cez Resend s idempotentným delivery logom.</p></div></div>
    <div className="admin-metrics"><article className="admin-metric"><span>Odoslané</span><strong>{summary.sent??'—'}</strong><small>posledných 100 udalostí</small></article><article className="admin-metric"><span>Čakajúce</span><strong>{summary.pending??'—'}</strong><small>queue / processing</small></article><article className="admin-metric"><span>Zlyhané</span><strong>{summary.failed??'—'}</strong><small>pripravené na retry</small></article><article className="admin-metric"><span>Video emaily</span><strong>{summary.video??'—'}</strong><small>členský obsah</small></article></div>
    <article className="admin-panel admin-email-test"><header><div><span>BEZPEČNÝ NÁHĽAD</span><h2>Poslať testovací e-mail</h2></div></header><label>Testovacia adresa<input type="email" value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="admin@example.com"/></label><div><button disabled={Boolean(sending)||!email} onClick={()=>send('welcome')}>{sending==='welcome'?'ODOSIELAM…':'TEST WELCOME'}</button><button disabled={Boolean(sending)||!email} onClick={()=>send('new_video')}>{sending==='new_video'?'ODOSIELAM…':'TEST NEW VIDEO'}</button></div><p role="status" aria-live="polite">{message}</p></article>
    <article className="admin-panel"><header><div><span>DELIVERY LOG</span><h2>Posledné udalosti</h2></div></header>{loading?<div className="admin-loading"><i/>Načítavam…</div>:data.deliveries?.length?<div className="admin-table-wrap"><table><thead><tr><th>Čas</th><th>Typ</th><th>Stav</th><th>Pokusy</th><th>Provider ID</th></tr></thead><tbody>{data.deliveries.map((row)=><tr key={row.id}><td>{date(row.sent_at||row.created_at)}</td><td>{row.event_type}</td><td><b className={`admin-email-status is-${row.status}`}>{row.status}</b></td><td>{row.attempts}</td><td><small>{row.provider_message_id||'—'}</small></td></tr>)}</tbody></table></div>:<div className="admin-empty">Zatiaľ nebol odoslaný žiadny Club e-mail.</div>}</article>
  </section>
}
