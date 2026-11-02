import { safeInternalReturnPath } from './safe-return'

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const onboardingCheckoutPath = '/checkout/club?returnTo=%2Fprofil'

export function authErrorMessage(error, mode = 'login') {
  const code = error?.code || ''
  const message = String(error?.message || '').toLowerCase()
  if (message.includes('failed to fetch') || message.includes('network')) return 'Nepodarilo sa spojiť s prihlasovacou službou. Skontroluj pripojenie a skús to znova.'
  if (code === 'invalid_credentials') return 'E-mail alebo heslo nie sú správne.'
  if (code === 'email_not_confirmed') return 'Najprv potvrď svoj e-mail cez odkaz, ktorý sme ti poslali.'
  if (code === 'email_address_invalid') return 'Táto e-mailová adresa nie je platná.'
  if (['user_already_exists', 'email_exists', 'user_already_registered'].includes(code)) return 'Účet s týmto e-mailom už existuje. Prihlás sa.'
  if (code === 'weak_password') return 'Heslo je príliš slabé. Použi aspoň 8 znakov.'
  if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code)) return 'Prebehlo príliš veľa pokusov. Počkaj chvíľu a skús to znova.'
  if (code === 'captcha_failed') return 'Bezpečnostné overenie zlyhalo. Obnov stránku a skús to znova.'
  if (code === 'signup_disabled') return 'Registrácia je momentálne vypnutá.'
  if (['unexpected_failure', 'database_error'].includes(code)) return 'Prihlasovacia služba má dočasný problém. Skús to, prosím, neskôr.'
  return mode === 'register' ? 'Registráciu sa nepodarilo dokončiť. Skús to znova.' : 'Prihlásenie sa nepodarilo. Skús to znova.'
}

export function registrationEmailFromUrl() {
  const value = new URLSearchParams(window.location.search).get('email')?.trim() || ''
  return emailPattern.test(value) ? value : ''
}

export function safeOnboardingNext(fallback = onboardingCheckoutPath) {
  return safeInternalReturnPath(new URLSearchParams(window.location.search).get('next'), fallback)
}
