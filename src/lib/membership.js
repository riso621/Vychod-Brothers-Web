export const MEMBERSHIP_LEVELS = ['free', 'member', 'vip']
export const MEMBERSHIP_STATUSES = ['active', 'expired', 'cancelled']

export const membershipLabels = {
  free: 'FREE',
  member: 'MEMBER',
  vip: 'VIP',
}

export const membershipStatusLabels = {
  active: 'Aktívne',
  expired: 'Expirované',
  cancelled: 'Zrušené',
}

export const membershipPrices = {
  free: '0 €',
  member: '4,99 € / mesiac',
  vip: '9,99 € / mesiac',
}

export const clubPlan = {
  id: 'club',
  name: 'VÝCHOD BROTHERS CLUB',
  price: '5,99 € / mesiac',
  perks: ['Všetky exkluzívne videá', 'Komentáre a interakcie', 'História sledovania', 'Všetok budúci členský obsah'],
}

export const membershipPlans = [
  {
    id: 'free', name: 'FREE', icon: '▶', description: 'Verejné videá a svet Východ Brothers bez obmedzení.', popular: false,
    perks: ['Všetky verejné videá', 'Novinky z tvorby', 'Prístup ku komunitnému obsahu'],
  },
  {
    id: 'member', name: 'MEMBER', icon: '◆', description: 'Pre fanúšikov, ktorí chcú byť pri tom skôr a vidieť viac.', popular: true,
    perks: ['Všetko z FREE', 'Členské videá a bonusy', 'Vystrihnuté scény', 'Zákulisie a skoršie premiéry'],
  },
  {
    id: 'vip', name: 'VIP', icon: '★', description: 'Kompletný prístup k najexkluzívnejšiemu obsahu Východ Brothers.', popular: false,
    perks: ['Všetko z MEMBER', 'VIP minifilmy', 'Všetky bonusové videá', 'VIP odznak a meno v titulkoch'],
  },
]

export function getMembershipStatus(profile, now = new Date()) {
  if (!profile) return 'active'
  if (profile.membership_status === 'cancelled') return 'cancelled'
  if (profile.membership_status === 'expired') return 'expired'
  if (profile.membership_expires_at && new Date(profile.membership_expires_at) <= now) return 'expired'
  return 'active'
}

export function getEffectiveMembership(profile, now = new Date()) {
  if (!profile || getMembershipStatus(profile, now) !== 'active') return 'free'
  return MEMBERSHIP_LEVELS.includes(profile.membership) ? profile.membership : 'free'
}

export function canAccessMembership(requiredLevel, profile, isAdmin = false) {
  if (isAdmin) return true
  const required = requiredLevel === 'public' ? 'free' : requiredLevel
  if (required === 'free') return true
  return ['member', 'vip'].includes(getEffectiveMembership(profile))
}

export function isActiveClubMember(profile, isAdmin = false) {
  return isAdmin || ['member', 'vip'].includes(getEffectiveMembership(profile))
}

export function customerMembershipLabel(profile, isAdmin = false) {
  return isActiveClubMember(profile, isAdmin) ? 'VÝCHOD BROTHERS CLUB' : 'BEZ ČLENSTVA'
}

export function formatMembershipDate(value) {
  if (!value) return 'Bez expirácie'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}
