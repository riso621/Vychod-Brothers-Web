export const brothers = [
  {
    name: 'David',
    role: 'Nápad. Réžia. Chaos.',
    number: '01',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=85',
    bio: 'Ten, čo povie „mám nápad“ a o tri hodiny stojíme v lese s kamerou a dymovnicou.',
  },
  {
    name: 'Ivan',
    role: 'Kamera. Strih. Detail.',
    number: '02',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=85',
    bio: 'Vidí záber ešte predtým, než sa stane. A vystrihne presne to, čo tam nemalo byť.',
  },
  {
    name: 'Rišo',
    role: 'Herectvo. Energia. Pointa.',
    number: '03',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=85',
    bio: 'Dokáže zahrať čokoľvek. Najmä človeka, ktorý má situáciu absolútne pod kontrolou.',
  },
]

export const videos = [
  {
    title: 'Keď ideš na východ len na víkend',
    category: 'Minifilm',
    duration: '14:08',
    views: '486 tis.',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1800&q=90',
    featured: true,
  },
  {
    title: 'Typy ľudí na svadbe',
    category: 'Skeč',
    duration: '08:24',
    views: '318 tis.',
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1100&q=85',
  },
  {
    title: 'Východniar v Bratislave',
    category: 'Paródia',
    duration: '10:17',
    views: '702 tis.',
    image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1100&q=85',
  },
  {
    title: 'Dedinská posilňovňa',
    category: 'Zo života',
    duration: '06:43',
    views: '229 tis.',
    image: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=1100&q=85',
  },
]

export const stats = [
  { value: '120K+', label: 'YouTube rodina' },
  { value: '15.2M', label: 'Pozretí videí' },
  { value: '75K+', label: 'TikTok followers' },
  { value: '38K+', label: 'Instagram crew' },
]

export const futureIntegrations = {
  youtube: { enabled: false, provider: 'YouTube Data API' },
  socialStats: { enabled: false, providers: ['Instagram', 'TikTok'] },
  membership: { enabled: false, providers: ['Supabase', 'Stripe'] },
  protectedContent: { enabled: false, provider: 'Supabase Storage' },
  merch: { enabled: false },
}
