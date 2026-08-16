const iconPaths = {
  play: <><path d="M9 7.2v9.6L17 12 9 7.2Z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9"/></>,
  youtube: <><rect x="3" y="6.5" width="18" height="11" rx="3"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none"/></>,
  crown: <><path d="m3.5 8 4 4 4.5-7 4.5 7 4-4-2 10h-13l-2-10Z"/><path d="M6 21h12"/></>,
  lock: <><rect x="5.5" y="10" width="13" height="11" rx="2.5"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v3"/></>,
  handshake: <><path d="m3 9 4-3 4 2 2-1 8 4-4 6-4 2-6-2-4-5V9Z"/><path d="m8 12 3 3a2 2 0 0 0 3 0l3-3"/></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m4 7 8 6 8-6"/></>,
}

export function CtaIcon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name] || iconPaths.play}</svg>
}

export default function CtaButton({ href, external = false, variant = 'secondary', compact = false, fullWidth = false, icon = 'play', label, sublabel = '', arrow = true, loading = false, disabled = false, type = 'button', className = '', onClick }) {
  const classes = ['vb-cta', `is-${variant}`, compact && 'is-compact', fullWidth && 'is-full', className].filter(Boolean).join(' ')
  const content = <><span className="vb-cta-icon"><CtaIcon name={icon} /></span><span className="vb-cta-copy"><strong>{loading ? 'NAČÍTAVAM…' : label}</strong>{sublabel && <small>{sublabel}</small>}</span>{arrow && <svg className="vb-cta-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M14 7l5 5-5 5"/></svg>}</>
  if (href) return <a className={classes} href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} onClick={onClick}>{content}</a>
  return <button className={classes} type={type} disabled={disabled || loading} onClick={onClick}>{content}</button>
}
