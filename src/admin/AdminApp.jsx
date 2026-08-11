import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useProfile } from '../context/profile-context'
import { supabase } from '../lib/supabase'
import { getMembershipUsers } from '../lib/admin-memberships'
import './admin.css'

const AdminVideosDashboard = lazy(() => import('../components/AdminVideosDashboard'))
const AdminMembershipsDashboard = lazy(() => import('../components/AdminMembershipsDashboard'))

const navItems = [
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

function Dashboard({ users, videos, loading }) {
  const stats = useMemo(() => ({ total: users.length, member: users.filter((u) => u.membership === 'member' && u.membership_status === 'active').length, vip: users.filter((u) => u.membership === 'vip' && u.membership_status === 'active').length, published: videos.filter((v) => v.published).length }), [users, videos])
  const latest = videos.slice(0, 5)
  return <section><div className="admin-page-heading"><div><span>DASHBOARD</span><h1>Prehľad systému</h1><p>Aktuálne údaje načítané z produkčných tabuliek.</p></div><time>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'long' }).format(new Date())}</time></div>{loading ? <AdminLoading /> : <><div className="admin-metrics"><Metric label="Používatelia" value={stats.total} detail="všetky profily"/><Metric label="Aktívni MEMBER" value={stats.member} detail="členské účty"/><Metric label="Aktívni VIP" value={stats.vip} detail="VIP účty"/><Metric label="Publikované videá" value={stats.published} detail={`${videos.length} záznamov celkom`}/></div><div className="admin-dashboard-grid"><article className="admin-panel"><header><div><span>POSLEDNÝ OBSAH</span><h2>Najnovšie videá</h2></div><a href="/admin/videos">Spravovať →</a></header>{latest.length ? <div className="admin-compact-list">{latest.map((v) => <div key={v.id}><strong>{v.title}</strong><span>{v.access_level.toUpperCase()} · {v.published ? 'Publikované' : 'Koncept'}</span></div>)}</div> : <Empty text="Žiadne videá" />}</article><article className="admin-panel"><header><div><span>SYSTÉM</span><h2>Stav integrácií</h2></div></header><div className="admin-status-list"><p><i className="ok"/>Supabase <strong>Pripojené</strong></p><p><i className={users.some((u) => u.stripe_subscription_id) ? 'ok' : ''}/>Stripe <strong>{users.some((u) => u.stripe_subscription_id) ? 'Aktívne dáta' : 'Bez subscription dát'}</strong></p><p><i className={videos.some((v) => v.provider === 'cloudflare_stream') ? 'ok' : ''}/>Cloudflare Stream <strong>{videos.some((v) => v.provider === 'cloudflare_stream') ? 'Aktívne dáta' : 'Bez Stream videí'}</strong></p></div></article></div></> }</section>
}

function Users({ users, loading }) {
  const [query, setQuery] = useState('')
  const filtered = users.filter((u) => `${u.email} ${u.username} ${u.id}`.toLowerCase().includes(query.toLowerCase()))
  return <section><PageHeading eyebrow="ADMIN / USERS" title="Používatelia" text="Bezpečný prehľad registrovaných účtov a ich stavu."/><div className="admin-toolbar"><input type="search" placeholder="Hľadať podľa e-mailu, mena alebo ID" value={query} onChange={(e) => setQuery(e.target.value)}/><span>{filtered.length} výsledkov</span></div>{loading ? <AdminLoading/> : <div className="admin-table-wrap"><table><thead><tr><th>Používateľ</th><th>Členstvo</th><th>Stav</th><th>Registrácia</th><th>Posledné prihlásenie</th></tr></thead><tbody>{filtered.map((u) => <tr key={u.id}><td><strong>{u.username || 'Bez mena'}</strong><small>{u.email || u.id}</small></td><td><b className={`admin-tier is-${u.membership}`}>{u.membership?.toUpperCase()}</b></td><td>{u.email_confirmed_at ? 'Overený' : 'Neoverený'}</td><td>{formatDate(u.created_at)}</td><td>{formatDate(u.last_sign_in_at)}</td></tr>)}</tbody></table></div>}</section>
}

function Payments({ users, loading }) {
  const subscribed = users.filter((u) => u.stripe_subscription_id)
  return <section><PageHeading eyebrow="ADMIN / BILLING" title="Platby" text="Prehľad subscription stavov synchronizovaných zo Stripe webhooku."/>{loading ? <AdminLoading/> : subscribed.length ? <div className="admin-table-wrap"><table><thead><tr><th>Používateľ</th><th>Plán</th><th>Stripe stav</th><th>Obnova</th><th>Platnosť</th></tr></thead><tbody>{subscribed.map((u) => <tr key={u.id}><td><strong>{u.email || u.username || u.id}</strong></td><td><b className={`admin-tier is-${u.membership}`}>{u.membership.toUpperCase()}</b></td><td>{u.stripe_subscription_status || '—'}</td><td>{u.stripe_cancel_at_period_end ? 'Zrušené' : 'Aktívne'}</td><td>{formatDate(u.membership_expires_at)}</td></tr>)}</tbody></table></div> : <Empty text="Zatiaľ nie sú dostupné žiadne Stripe subscription záznamy."/>}</section>
}

function Placeholder({ route }) { const copy = { merch:'Merch katalóg zatiaľ nemá vlastný dátový model.', content:'CMS pre obsah webu zatiaľ nie je pripojený.', settings:'Konfiguračné tajomstvá zostávajú bezpečne iba na serveri.', logs:'Audit log tabuľka zatiaľ nebola vytvorená.' }; return <section><PageHeading eyebrow="ADMIN MODULE" title={labels[route]} text={copy[route]}/><div className="admin-placeholder"><span>PRIPRAVENÉ NA ĎALŠIU ETAPU</span><h2>Modul nie je aktívny</h2><p>Neboli vytvorené falošné dáta ani klientsky prístup k citlivým systémom.</p></div></section> }
function PageHeading({ eyebrow, title, text }) { return <div className="admin-page-heading"><div><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div></div> }
function Empty({ text }) { return <div className="admin-empty">{text}</div> }
function AdminLoading() { return <div className="admin-loading" aria-live="polite"><i/>Načítavam aktuálne dáta…</div> }
function formatDate(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('sk-SK', { dateStyle:'medium' }).format(d) }

export default function AdminApp() {
  const { session, authLoading, signOut } = useProfile()
  const [path, setPath] = useState(window.location.pathname)
  const [users, setUsers] = useState([]), [videos, setVideos] = useState([]), [loading, setLoading] = useState(true)
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  useEffect(() => { const handler = () => setPath(window.location.pathname); window.addEventListener('popstate', handler); return () => window.removeEventListener('popstate', handler) }, [])
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
  const load = useCallback(async () => { if (!isAdmin) return; setLoading(true); const [userResult, videoResult] = await Promise.allSettled([getMembershipUsers(), supabase.from('videos').select('id,title,slug,provider,access_level,published,featured,created_at').order('created_at',{ascending:false})]); if (userResult.status === 'fulfilled') setUsers(userResult.value); if (videoResult.status === 'fulfilled' && !videoResult.value.error) setVideos(videoResult.value.data || []); setLoading(false) }, [isAdmin])
  useEffect(() => { load() }, [load])
  if (authLoading) return <div className="admin-boot">Overujem administrátorské oprávnenie…</div>
  if (!session) return <AdminLogin />
  if (!isAdmin) return <AdminLogin denied />
  let route = path.replace(/^\/admin\/?/, '').split('/')[0] || 'dashboard'; if (!labels[route]) route = 'dashboard'
  let content
  if (route === 'dashboard') content = <Dashboard users={users} videos={videos} loading={loading}/>
  else if (route === 'videos') content = <Suspense fallback={<AdminLoading/>}><AdminVideosDashboard /></Suspense>
  else if (route === 'memberships') content = <Suspense fallback={<AdminLoading/>}><AdminMembershipsDashboard /></Suspense>
  else if (route === 'users') content = <Users users={users} loading={loading}/>
  else if (route === 'payments') content = <Payments users={users} loading={loading}/>
  else content = <Placeholder route={route}/>
  return <AdminShell route={route} session={session} signOut={signOut}>{content}</AdminShell>
}
