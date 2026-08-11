import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useProfile } from '../context/profile-context'
import { supabase } from '../lib/supabase'
import { adminRequest } from '../lib/admin-control-center'
import { getMembershipUsers } from '../lib/admin-memberships'
import { cachedAdminLoad, readAdminCache } from '../lib/admin-cache'
import AdminUserDetail from './AdminUserDetail'
import './admin.css'

const AdminVideosDashboard = lazy(() => import('../components/AdminVideosDashboard'))
const AdminMembershipsDashboard = lazy(() => import('../components/AdminMembershipsDashboard'))
const AdminInvoices = lazy(() => import('./AdminInvoices'))

const navItems = [
  ['invoices', 'Faktúry', '▤'],
  ['dashboard', 'Prehľad', '▦'], ['videos', 'Videá', '▶'], ['users', 'Používatelia', '◉'],
  ['memberships', 'Členstvá', '◆'], ['payments', 'Platby', '€'], ['merch', 'Merch', '▣'],
  ['content', 'Obsah webu', '◫'], ['settings', 'Nastavenia', '⚙'], ['logs', 'Logy', '≡'],
]

const labels = Object.fromEntries(navItems.map(([key, label]) => [key, label]))

function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function AdminLogin({ denied = false }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(denied ? 'Tento účet nemá administrátorské oprávnenie.' : '')

  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError('')
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (authError) setError('Prihlásenie sa nepodarilo. Skontrolujte prihlasovacie údaje.')
    else if (data.user?.app_metadata?.role !== 'admin') {
      await supabase.auth.signOut({ scope: 'local' })
      setError('Tento účet nemá administrátorské oprávnenie.')
    } else {
      const next = new URLSearchParams(window.location.search).get('next')
      navigate(next?.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin')
    }
    setLoading(false)
  }

  return <main className="admin-login"><section><a className="admin-login-logo" href="/">VB</a><span>VÝCHOD BROTHERS</span><h1>Administrácia</h1><p>Prihláste sa účtom s administrátorským oprávnením.</p><form onSubmit={submit}><label>E-mail<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Heslo<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>{error && <p className="admin-alert is-error" role="alert">{error}</p>}<button disabled={loading}>{loading ? 'OVERUJEM…' : 'PRIHLÁSIŤ DO ADMINU'}</button></form><a href="/">← Späť na web</a></section></main>
}

function AdminShell({ route, children, session, signOut }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const go = (key) => { navigate(key === 'dashboard' ? '/admin' : `/admin/${key}`); setMenuOpen(false) }
  return <div className="admin-app"><aside className={menuOpen ? 'admin-sidebar is-open' : 'admin-sidebar'}><header><a href="/admin" aria-label="Admin domov">VB</a><div><strong>VÝCHOD</strong><small>ADMIN SYSTEM</small></div></header><nav aria-label="Admin navigácia">{navItems.map(([key, label, icon]) => <button className={route === key ? 'is-active' : ''} onClick={() => go(key)} key={key}><i>{icon}</i>{label}</button>)}</nav><footer><a href="/">↗ Otvoriť web</a><button onClick={async () => { await signOut(); navigate('/admin/login') }}>Odhlásiť</button></footer></aside><div className="admin-workspace"><header className="admin-topbar"><button className="admin-menu-toggle" onClick={() => setMenuOpen((v) => !v)} aria-label="Otvoriť admin menu">☰</button><div><span>ADMIN PANEL</span><strong>{labels[route] || 'Prehľad'}</strong></div><div className="admin-identity"><span>{session.user.email?.slice(0, 1).toUpperCase()}</span><div><strong>{session.user.email}</strong><small>Administrátor</small></div></div></header><main className="admin-main">{children}</main></div>{menuOpen && <button className="admin-sidebar-scrim" aria-label="Zavrieť menu" onClick={() => setMenuOpen(false)} />}</div>
}

function Metric({ label, value, detail }) { return <article className="admin-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article> }

function Dashboard({ users, videos, invoices, loading }) {
  const stats = useMemo(() => ({ total: users.length, member: users.filter((u) => u.membership === 'member' && u.membership_status === 'active').length, vip: users.filter((u) => u.membership === 'vip' && u.membership_status === 'active').length, published: videos.filter((v) => v.published).length }), [users, videos])
  const now = Date.now(), monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
  const paidMonth = invoices.filter((i) => i.status === 'paid' && i.created >= monthStart)
  const revenueMonth = paidMonth.reduce((sum, i) => sum + i.amount_paid, 0)
  const registrations7d = users.filter((u) => now - new Date(u.created_at).getTime() <= 7 * 86400000).length
  const alerts = [...users.filter((u) => ['past_due','unpaid','incomplete'].includes(u.stripe_subscription_status)).map((u) => `Platobný stav ${u.stripe_subscription_status}: ${u.email || u.id}`), ...videos.filter((v) => !v.published || !v.thumbnail_url).map((v) => `${!v.published ? 'Nepublikované video' : 'Chýba thumbnail'}: ${v.title}`)]
  const latest = videos.slice(0, 5)
  return <section><div className="admin-page-heading"><div><span>DASHBOARD</span><h1>Prehľad systému</h1><p>Aktuálne údaje z produkčných systémov.</p></div><time>{new Intl.DateTimeFormat('sk-SK',{dateStyle:'long'}).format(new Date())}</time></div>{loading?<AdminLoading/>:<><div className="admin-metrics"><Metric label="Používatelia" value={stats.total} detail={`${registrations7d} nových za 7 dní`}/><Metric label="Aktívni MEMBER" value={stats.member} detail="členské účty"/><Metric label="Aktívni VIP" value={stats.vip} detail="VIP účty"/><Metric label="Tržby tento mesiac" value={money(revenueMonth,'eur')} detail={`${paidMonth.length} úspešných platieb`}/></div><div className="admin-dashboard-grid"><article className="admin-panel"><header><div><span>POSLEDNÝ OBSAH</span><h2>Najnovšie videá</h2></div><a href="/admin/videos">Spravovať →</a></header><div className="admin-compact-list">{latest.map((v)=><div key={v.id}><strong>{v.title}</strong><span>{v.access_level.toUpperCase()} · {v.published?'Publikované':'Koncept'}</span></div>)}</div></article><article className="admin-panel"><header><div><span>UPOZORNENIA</span><h2>Vyžaduje pozornosť</h2></div></header>{alerts.length?<div className="admin-compact-list">{alerts.slice(0,6).map((a,i)=><div key={i}><strong>{a}</strong></div>)}</div>:<Empty text="Žiadne aktuálne upozornenia."/>}</article></div></>}</section>
}

function Users({ users, loading }) {
  const [query, setQuery] = useState('')
  const [tier,setTier]=useState('all'),[verified,setVerified]=useState('all'),[sort,setSort]=useState('newest')
  const filtered = users.filter((u)=>`${u.email} ${u.username} ${u.id}`.toLowerCase().includes(query.toLowerCase())&&(tier==='all'||u.membership===tier)&&(verified==='all'||Boolean(u.email_confirmed_at)===(verified==='verified'))).sort((a,b)=>sort==='oldest'?new Date(a.created_at)-new Date(b.created_at):sort==='login'?new Date(b.last_sign_in_at||0)-new Date(a.last_sign_in_at||0):new Date(b.created_at)-new Date(a.created_at))
  return <section><PageHeading eyebrow="ADMIN / USERS" title="Používatelia" text="Bezpečný prehľad registrovaných účtov a ich stavu."/><div className="admin-toolbar"><input type="search" placeholder="Hľadať podľa e-mailu, mena alebo ID" value={query} onChange={(e)=>setQuery(e.target.value)}/><select value={tier} onChange={(e)=>setTier(e.target.value)}><option value="all">Všetky plány</option><option value="free">FREE</option><option value="member">MEMBER</option><option value="vip">VIP</option></select><select value={verified} onChange={(e)=>setVerified(e.target.value)}><option value="all">Overenie e-mailu</option><option value="verified">Overení</option><option value="unverified">Neoverení</option></select><select value={sort} onChange={(e)=>setSort(e.target.value)}><option value="newest">Najnovší</option><option value="oldest">Najstarší</option><option value="login">Posledné prihlásenie</option></select><span>{filtered.length} výsledkov</span></div>{loading?<AdminLoading/>:<div className="admin-table-wrap"><table><thead><tr><th>Používateľ</th><th>Členstvo</th><th>Stav</th><th>Registrácia</th><th>Posledné prihlásenie</th></tr></thead><tbody>{filtered.map((u)=><tr className="is-clickable" key={u.id} onClick={()=>navigate(`/admin/users/${u.id}`)}><td><strong>{u.username||u.email||u.id}</strong><small>{u.username?u.email:u.id}</small></td><td><b className={`admin-tier is-${u.membership}`}>{u.membership?.toUpperCase()}</b></td><td>{u.email_confirmed_at?'Overený':'Neoverený'}</td><td>{formatDate(u.created_at)}</td><td>{formatDate(u.last_sign_in_at)}</td></tr>)}</tbody></table></div>}</section>
}

function Payments({ users, invoices, loading }) {
  const customerMap=new Map(users.map((u)=>[u.stripe_customer_id,u])); const paid=invoices.filter((i)=>i.status==='paid'),failed=invoices.filter((i)=>['open','uncollectible'].includes(i.status)); const monthStart=new Date(new Date().getFullYear(),new Date().getMonth(),1).getTime()/1000; const revenue=invoices.filter((i)=>i.status==='paid'&&i.created>=monthStart).reduce((s,i)=>s+i.amount_paid,0)
  return <section><PageHeading eyebrow="ADMIN / BILLING" title="Platby" text="Reálne faktúry načítané zo Stripe bez citlivých platobných údajov."/><div className="admin-metrics"><Metric label="Tržby tento mesiac" value={money(revenue,'eur')} detail="zaplatené faktúry"/><Metric label="Úspešné platby" value={paid.length} detail="v načítanom období"/><Metric label="Neúspešné platby" value={failed.length} detail="open / failed"/><Metric label="Naplánované zrušenia" value={users.filter((u)=>u.stripe_cancel_at_period_end).length} detail="prístup ostáva aktívny"/></div>{loading?<AdminLoading/>:invoices.length?<div className="admin-table-wrap"><table><thead><tr><th>Používateľ</th><th>Plán</th><th>Suma</th><th>Dátum</th><th>Stav</th><th>Typ</th><th>Invoice ID</th></tr></thead><tbody>{invoices.map((i)=>{const u=customerMap.get(i.customer);return <tr key={i.id}><td><strong>{u?.email||'Nepriradený zákazník'}</strong></td><td>{i.plan?.toUpperCase()||'—'}</td><td>{money(i.amount_paid||i.amount_due,i.currency)}</td><td>{formatDate(i.created*1000)}</td><td>{i.status}</td><td>{i.type}</td><td><small>{i.id}</small></td></tr>})}</tbody></table></div>:<Empty text="Stripe nevrátil žiadne faktúry."/>}</section>
}

function UserDetail({ userId }) { return <AdminUserDetail userId={userId}/> }

function Logs({ logs }) { const [q,setQ]=useState(''); const rows=logs.filter((l)=>`${l.action_type} ${l.entity_type} ${l.admin_email} ${l.description}`.toLowerCase().includes(q.toLowerCase())); return <section><PageHeading eyebrow="ADMIN / AUDIT" title="Audit log" text="Nemenná história administrátorských write operácií."/><div className="admin-toolbar"><input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Hľadať v audite"/><span>{rows.length} udalostí</span></div>{rows.length?<div className="admin-table-wrap"><table><thead><tr><th>Čas</th><th>Admin</th><th>Akcia</th><th>Entita</th><th>Popis</th></tr></thead><tbody>{rows.map((l)=><tr key={l.id}><td>{formatDate(l.created_at)}</td><td>{l.admin_email||l.admin_user_id}</td><td>{l.action_type}</td><td>{l.entity_type}</td><td>{l.description}</td></tr>)}</tbody></table></div>:<Empty text="Audit zatiaľ neobsahuje udalosti."/>}</section> }

function Content({ content, reload }) { const [values,setValues]=useState(Object.fromEntries(content.map((c)=>[c.key,typeof c.value==='string'?c.value:JSON.stringify(c.value)]))),[message,setMessage]=useState(''); const save=async(key)=>{try{await adminRequest({action:'save-content',key,value:values[key]});setMessage('Obsah bol uložený.');reload()}catch(e){setMessage(e.message)}}; return <section><PageHeading eyebrow="ADMIN / CMS" title="Obsah webu" text="Bezpečný základ pre verejné texty so serverovou validáciou a fallbackom."/><div className="admin-content-list">{content.map((c)=><article className="admin-panel" key={c.key}><label>{c.description||c.key}<small>{c.key}</small><textarea value={values[c.key]??''} onChange={(e)=>setValues({...values,[c.key]:e.target.value})}/></label><button onClick={()=>save(c.key)}>Uložiť</button></article>)}</div>{message&&<p className="admin-videos-success">{message}</p>}</section> }
function Settings({ content, integrations, reload }) { return <section><PageHeading eyebrow="ADMIN / SETTINGS" title="Nastavenia" text="Verejné nastavenia a bezpečný stav serverových integrácií."/><article className="admin-panel"><h2>Integrácie</h2><div className="admin-status-list">{Object.entries(integrations||{}).map(([key,active])=><p key={key}><i className={active?'ok':''}/>{key[0].toUpperCase()+key.slice(1)}<strong>{active?'Aktívne':'Nenastavené'}</strong></p>)}</div></article><div className="admin-detail-section"><Content content={content.filter((c)=>['brand.name','contact.email','support.email'].includes(c.key))} reload={reload}/></div></section> }

function Placeholder({ route }) { const copy = { merch:'Merch modul zatiaľ nie je nakonfigurovaný.', content:'CMS pre obsah webu zatiaľ nie je pripojený.', settings:'Konfiguračné tajomstvá zostávajú bezpečne iba na serveri.', logs:'Audit log tabuľka zatiaľ nebola vytvorená.' }; return <section><PageHeading eyebrow="ADMIN MODULE" title={labels[route]} text={copy[route]}/><div className="admin-placeholder"><span>PRIPRAVENÉ NA ĎALŠIU ETAPU</span><h2>Modul nie je aktívny</h2><p>Neboli vytvorené falošné dáta ani klientsky prístup k citlivým systémom.</p></div></section> }
function PageHeading({ eyebrow, title, text }) { return <div className="admin-page-heading"><div><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div></div> }
function Empty({ text }) { return <div className="admin-empty">{text}</div> }
function AdminLoading() { return <div className="admin-loading" aria-live="polite"><i/>Načítavam aktuálne dáta…</div> }
function formatDate(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('sk-SK', { dateStyle:'medium' }).format(d) }
function money(value,currency='eur'){return new Intl.NumberFormat('sk-SK',{style:'currency',currency:(currency||'eur').toUpperCase()}).format((value||0)/100)}

export default function AdminApp() {
  const { session, authLoading, signOut } = useProfile()
  const [path, setPath] = useState(window.location.pathname)
  const cachedCore = readAdminCache('admin-core')
  const [snapshot, setSnapshot] = useState(cachedCore?.snapshot || { users:[], videos:[], invoices:[], logs:[], content:[], integrations:{} }), [loading, setLoading] = useState(!cachedCore), [loadErrors,setLoadErrors]=useState(cachedCore?.errors || [])
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  useEffect(() => { const handler = () => setPath(window.location.pathname); window.addEventListener('popstate', handler); return () => window.removeEventListener('popstate', handler) }, [])
  useEffect(() => { const handler = (event) => { const link=event.target.closest?.('a[href^="/admin"]'); if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey)return; event.preventDefault();navigate(link.getAttribute('href')) }; document.addEventListener('click',handler); return()=>document.removeEventListener('click',handler) },[])
  useEffect(() => {
    if (authLoading) return
    if (!session && path !== '/admin/login') {
      window.history.replaceState({}, '', `/admin/login?next=${encodeURIComponent(path)}`)
      setPath('/admin/login')
    } else if (isAdmin && path === '/admin/login') {
      window.history.replaceState({}, '', '/admin')
      setPath('/admin')
    }
  }, [authLoading, isAdmin, path, session])
  const load = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true); setLoadErrors([])
    const results = await Promise.allSettled([
      cachedAdminLoad('admin-users',()=>getMembershipUsers()),
      cachedAdminLoad('admin-videos',()=>supabase.from('videos').select('id,title,slug,provider,access_level,published,featured,thumbnail_url,created_at').order('created_at',{ascending:false}).limit(200)),
      cachedAdminLoad('admin-content',()=>supabase.from('site_content').select('key,value,description,updated_at').order('key')),
      cachedAdminLoad('admin-billing',()=>adminRequest({action:'billing'})), cachedAdminLoad('admin-logs',()=>adminRequest({action:'logs'})), cachedAdminLoad('admin-integrations',()=>adminRequest({action:'integrations'})),
    ])
    const errors=[]
    const value=(index,fallback)=>results[index].status==='fulfilled'?results[index].value:fallback
    results.forEach((result,index)=>{if(result.status==='rejected')errors.push(['Používatelia','Videá','CMS','Platby','Audit','Integrácie'][index])})
    const videoResult=value(1,{data:[],error:true}), contentResult=value(2,{data:[],error:true})
    if(videoResult.error)errors.push('Videá'); if(contentResult.error)errors.push('CMS')
    setSnapshot({ users:value(0,[]), videos:videoResult.data||[], content:contentResult.data||[], invoices:value(3,{invoices:[]}).invoices||[], logs:value(4,{logs:[]}).logs||[], integrations:value(5,{integrations:{}}).integrations||{} })
    const nextSnapshot={ users:value(0,[]), videos:videoResult.data||[], content:contentResult.data||[], invoices:value(3,{invoices:[]}).invoices||[], logs:value(4,{logs:[]}).logs||[], integrations:value(5,{integrations:{}}).integrations||{} }
    setSnapshot(nextSnapshot)
    cachedAdminLoad('admin-core',()=>Promise.resolve({snapshot:nextSnapshot,errors:[...new Set(errors)]}),{force:true})
    setLoadErrors([...new Set(errors)]); setLoading(false)
  }, [isAdmin])
  useEffect(() => { load() }, [load])
  if (authLoading) return <div className="admin-boot">Overujem administrátorské oprávnenie…</div>
  if (!session) return <AdminLogin />
  if (!isAdmin) return <AdminLogin denied />
  const pathParts = path.replace(/^\/admin\/?/, '').split('/').filter(Boolean)
  let route = pathParts[0] || 'dashboard'; if (!labels[route]) route = 'dashboard'
  const { users, videos, invoices, logs, content:siteContent, integrations } = snapshot
  let content
  if (route === 'dashboard') content = <Dashboard users={users} videos={videos} invoices={invoices} loading={loading}/>
  else if (route === 'videos') content = <Suspense fallback={<AdminLoading/>}><AdminVideosDashboard /></Suspense>
  else if (route === 'memberships') content = <Suspense fallback={<AdminLoading/>}><AdminMembershipsDashboard /></Suspense>
  else if (route === 'users' && pathParts[1]) content = <UserDetail key={pathParts[1]} userId={pathParts[1]}/>
  else if (route === 'users') content = <Users users={users} loading={loading}/>
  else if (route === 'payments') content = <Payments users={users} invoices={invoices} loading={loading}/>
  else if (route === 'invoices') content = <Suspense fallback={<AdminLoading/>}><AdminInvoices /></Suspense>
  else if (route === 'logs') content = <Logs logs={logs}/>
  else if (route === 'content') content = <Content content={siteContent} reload={load}/>
  else if (route === 'settings') content = <Settings content={siteContent} integrations={integrations} reload={load}/>
  else content = <Placeholder route={route}/>
  return <AdminShell route={route} session={session} signOut={signOut}>{loadErrors.length>0&&<p className="admin-alert is-error" role="alert">Nepodarilo sa načítať: {loadErrors.join(', ')}. Ostatné dáta zostali dostupné.</p>}{content}</AdminShell>
}
