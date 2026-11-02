import '../onboarding.css'

export default function OnboardingShell({ eyebrow, title, intro, children }) {
  return <main className="onboarding-page">
    <header className="onboarding-header"><a className="onboarding-brand" href="/" aria-label="Východ Brothers – domov"><i>V</i>B<span>VÝCHOD BROTHERS</span></a></header>
    <section className="onboarding-card">
      <span className="onboarding-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {intro && <p className="onboarding-intro">{intro}</p>}
      {children}
    </section>
  </main>
}
