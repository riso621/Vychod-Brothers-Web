import { useEffect, useMemo, useState } from 'react'
import { adminRequest } from '../lib/admin-control-center'
import { cachedAdminLoad, readAdminCache } from '../lib/admin-cache'

const months = ['Január','Február','Marec','Apríl','Máj','Jún','Júl','August','September','Október','November','December']
const current = new Date()

function money(value, currency = 'eur') {
  if (value == null || !currency) return 'Nedostupné'
  return new Intl.NumberFormat('sk-SK', { style:'currency', currency:currency.toUpperCase() }).format(value / 100)
}
function date(value) { return value ? new Intl.DateTimeFormat('sk-SK',{dateStyle:'medium'}).format(new Date(value * 1000)) : 'Nedostupné' }
function planLabel(value) { return value ? value.toUpperCase() : 'Nedostupné' }

export default function AdminInvoices() {
  const [filters,setFilters] = useState({ year:String(current.getFullYear()), month:String(current.getMonth()+1), plan:'all', status:'all' })
  const [search,setSearch] = useState(''), [debouncedSearch,setDebouncedSearch] = useState('')
  const [cursor,setCursor] = useState('0'), [cursorHistory,setCursorHistory] = useState([])
  const key = useMemo(() => `invoices:${filters.year}:${filters.month}:${filters.plan}:${filters.status}:${debouncedSearch}:${cursor}`, [filters,debouncedSearch,cursor])
  const [result,setResult] = useState(() => readAdminCache(key))
  const [loading,setLoading] = useState(!result), [error,setError] = useState('')

  useEffect(() => { const timer=setTimeout(()=>{setDebouncedSearch(search.trim());setCursor('0');setCursorHistory([])},350); return ()=>clearTimeout(timer) },[search])
  useEffect(() => {
    let active=true
    const cached=readAdminCache(key); if(cached){setResult(cached);setLoading(false)} else setLoading(true)
    cachedAdminLoad(key,()=>adminRequest({action:'invoices',...filters,search:debouncedSearch,cursor,limit:25}),{force:Boolean(cached)}).then((data)=>{if(active){setResult(data);setError('')}}).catch((e)=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[key,filters,debouncedSearch,cursor])
  const updateFilter=(name,value)=>{setFilters((old)=>({...old,[name]:value}));setCursor('0');setCursorHistory([])}
  const summary=result?.summary, invoices=result?.invoices||[]
  return <section><div className="admin-page-heading"><div><span>ADMIN / STRIPE</span><h1>Faktúry</h1><p>Oficiálne Stripe faktúry a mesačný finančný prehľad.</p></div></div>
    <div className="admin-toolbar admin-invoice-filters"><select value={filters.year} onChange={(e)=>updateFilter('year',e.target.value)} aria-label="Rok">{Array.from({length:6},(_,i)=>current.getFullYear()-i).map((year)=><option key={year}>{year}</option>)}</select><select value={filters.month} onChange={(e)=>updateFilter('month',e.target.value)} aria-label="Mesiac">{months.map((month,i)=><option value={i+1} key={month}>{month}</option>)}</select><select value={filters.plan} onChange={(e)=>updateFilter('plan',e.target.value)}><option value="all">Všetky plány</option><option value="member">MEMBER</option><option value="vip">VIP</option></select><select value={filters.status} onChange={(e)=>updateFilter('status',e.target.value)}><option value="all">Všetky stavy</option><option value="paid">Paid</option><option value="open">Open</option><option value="void">Void</option><option value="uncollectible">Uncollectible</option></select><input type="search" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="E-mail alebo číslo faktúry" /></div>
    {summary&&<div className="admin-metrics admin-invoice-metrics"><article className="admin-metric"><span>Počet faktúr</span><strong>{summary.count}</strong><small>zvolený mesiac</small></article><article className="admin-metric"><span>Zaplatené spolu</span><strong>{money(summary.paidTotal,summary.currency)}</strong><small>paid</small></article><article className="admin-metric"><span>Nezaplatené spolu</span><strong>{money(summary.unpaidTotal,summary.currency)}</strong><small>open / uncollectible</small></article><article className="admin-metric"><span>MEMBER / VIP</span><strong>{money(summary.memberRevenue,summary.currency)} / {money(summary.vipRevenue,summary.currency)}</strong><small>zaplatené podľa plánu</small></article></div>}
    {error&&<p className="admin-alert is-error" role="alert">{error}</p>}
    {loading&&!result?<div className="admin-loading"><i/>Načítavam faktúry…</div>:invoices.length?<div className="admin-table-wrap"><table><thead><tr><th>Faktúra</th><th>Používateľ</th><th>Plán</th><th>Suma</th><th>Stav</th><th>Typ</th><th>Obdobie</th><th>Doklady</th></tr></thead><tbody>{invoices.map((invoice)=><tr key={invoice.id}><td><strong>{invoice.number||'Bez čísla'}</strong><small>{date(invoice.created)} · {invoice.id}</small></td><td>{invoice.customerEmail||'Nedostupné'}</td><td>{planLabel(invoice.plan)}</td><td>{money(invoice.amountPaid||invoice.amountDue,invoice.currency)}</td><td>{invoice.status||'Nedostupné'}</td><td>{invoice.type||'Nedostupné'}</td><td>{date(invoice.periodStart)} – {date(invoice.periodEnd)}</td><td><div className="admin-invoice-links">{invoice.invoicePdf&&<a href={invoice.invoicePdf} target="_blank" rel="noreferrer">Stiahnuť PDF</a>}{invoice.hostedInvoiceUrl&&<a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">Otvoriť v Stripe</a>}</div></td></tr>)}</tbody></table></div>:!loading&&<div className="admin-empty">Pre zvolené obdobie neexistujú žiadne Stripe faktúry.</div>}
    <div className="admin-pagination"><button disabled={!cursorHistory.length||loading} onClick={()=>{const copy=[...cursorHistory];setCursor(copy.pop()||'0');setCursorHistory(copy)}}>← Predchádzajúce</button><button disabled={!result?.nextCursor||loading} onClick={()=>{setCursorHistory((old)=>[...old,cursor]);setCursor(result.nextCursor)}}>Ďalšie →</button></div>
  </section>
}
