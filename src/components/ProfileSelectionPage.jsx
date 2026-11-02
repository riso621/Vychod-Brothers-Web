import { useEffect } from 'react'
import { useProfile } from '../context/profile-context'
import { onboardingCheckoutPath } from '../lib/auth-flow'
import { isActiveClubMember } from '../lib/membership'
import OnboardingShell from './OnboardingShell'

export default function ProfileSelectionPage() {
  const { session, profile, authLoading, profileLoading } = useProfile()
  const active = isActiveClubMember(profile, session?.user?.app_metadata?.role === 'admin')
  const metadataName = session?.user?.user_metadata?.first_name?.trim()
  const firstName = metadataName || profile?.username?.trim().split(/\s+/)[0] || 'Profil'

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!session) window.location.replace('/prihlasenie')
    else if (!active) window.location.replace(onboardingCheckoutPath)
  }, [active, authLoading, profileLoading, session])

  if (authLoading || profileLoading || !session || !active) return <OnboardingShell eyebrow="VÝCHOD BROTHERS CLUB" title="Pripravujeme tvoj profil…"><div className="onboarding-loader" /></OnboardingShell>
  return <main className="profile-select-page"><a className="onboarding-brand" href="/" aria-label="Východ Brothers – domov"><i>V</i>B<span>VÝCHOD BROTHERS</span></a><section><h1>KTO BUDE POZERAŤ?</h1><a className="viewer-profile" href="/videos"><span className="viewer-avatar"><i>V</i>B</span><strong>{firstName}</strong></a></section></main>
}
