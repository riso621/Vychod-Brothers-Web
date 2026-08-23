export const media = {
  hero: '/images/team/vychod-brothers-team-cutout-original-v2.png',
  film: [
    '/images/team/vychod-brothers-team-evening.webp',
    '/images/team/vychod-brothers-team-day.webp',
    '/images/team/vychod-brothers-team-evening.webp',
  ],
  latest: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1200&q=82',
  backstage: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=82',
  vip: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1000&q=80',
  merch: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1000&q=80',
  giveaway: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1800&q=88',
}

export const socialProfiles = {
  youtube: { name: 'YouTube', url: 'https://www.youtube.com/@Vychodbrothers1', icon: '▶', label: 'Východ Brothers na YouTube' },
  tiktok: { name: 'TikTok', url: 'https://www.tiktok.com/@vychodbrothers', icon: '♪', label: 'Východ Brothers na TikToku' },
  instagram: { name: 'Instagram', url: 'https://www.instagram.com/vychodbrothers/', icon: '◎', label: 'Východ Brothers na Instagrame' },
  facebook: { name: 'Facebook', url: 'https://www.facebook.com/riso.vanci/', icon: 'f', label: 'Východ Brothers na Facebooku' },
}

export const activeSocialProfiles = Object.entries(socialProfiles)
  .filter(([, profile]) => Boolean(profile.url))
  .map(([id, profile]) => ({ id, ...profile }))

export const stats = [
  { id: 'youtube-subscribers', platform: 'youtube', metric: 'subscriberCount', placeholder: '--', lines: ['YOUTUBE', 'ODBERATEĽOV'], social: 'youtube' },
  { id: 'instagram-followers', platform: 'instagram', metric: 'followersCount', placeholder: '--', lines: ['INSTAGRAM', 'SLEDOVATEĽOV'], social: 'instagram' },
  { id: 'tiktok-followers', platform: 'tiktok', metric: 'followerCount', placeholder: '--', lines: ['TIKTOK', 'SLEDOVATEĽOV'], social: 'tiktok' },
]

export const contentCards = [
  {
    id: 'latest',
    eyebrow: 'NAJNOVŠIE VIDEO',
    title: 'Keď ideš na východ len na víkend',
    description: 'Nový minifilm · Humor z východu bez filtra',
    cta: 'Pozrieť teraz',
    href: socialProfiles.youtube.url,
    image: media.latest,
    play: true,
  },
  {
    id: 'backstage',
    eyebrow: 'ZA KAMEROU',
    title: 'Zákulisie',
    description: 'Pozri sa, čo sa deje medzi klapkou a finálnym strihom.',
    cta: 'Nahliadnuť do zákulisia',
    href: '#backstage',
    image: media.backstage,
  },
  {
    id: 'vip',
    eyebrow: 'EXKLUZÍVNE PRE ČLENOV',
    title: 'VIP klub',
    description: 'Bonusové videá, premiéry a obsah, ktorý na YouTube neuvidíš.',
    cta: 'Pozrieť členstvo',
    href: '#clenstvo',
    image: media.vip,
  },
  {
    id: 'merch',
    eyebrow: 'UŽ ČOSKORO',
    title: 'Merch pripravujeme',
    description: 'Prvý drop práve vzniká. Daj si vedieť medzi prvými.',
    cta: 'Odoberať novinky',
    href: '#newsletter',
    image: media.merch,
  },
  {
    id: 'giveaway',
    eyebrow: 'PRE NAŠU KOMUNITU',
    title: 'Súťaže & giveaway',
    description: 'Špeciálne výzvy a odmeny pre fanúšikov aj členov.',
    cta: 'Sledovať novinky',
    href: '#newsletter',
    image: media.giveaway,
  },
]

export const navItems = ['DOMOV', 'VIDEÁ', 'O NÁS', 'ČLENSTVO', 'MERCH', 'KONTAKT']
export const aboutPath = '/o-nas'

export const footerNavigation = [
  { label: 'Domov', href: '/' },
  { label: 'Videá', href: '/videos' },
  { label: 'O nás', href: aboutPath },
  { label: 'Členstvo', href: '/clenstvo' },
  { label: 'Merch', href: '/#merch' },
  { label: 'Kontakt', href: '/#kontakt' },
]

export const legalLinks = [
  { label: 'Ochrana osobných údajov', href: '/ochrana-osobnych-udajov' },
  { label: 'Cookies', href: '/cookies' },
  { label: 'Obchodné podmienky', href: '/obchodne-podmienky' },
  { label: 'Zrušenie členstva', href: '/zrusenie-clenstva' },
]

export const contactEmail = 'ahoj@vychodbrothers.sk'
export const footerSlogan = 'Humor, príbehy a život z východu. Bez filtra.'
