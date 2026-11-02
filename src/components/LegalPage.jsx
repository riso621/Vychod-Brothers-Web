const pages = {
  privacy: {
    eyebrow: 'PRÁVNE INFORMÁCIE',
    title: 'Ochrana osobných údajov',
    intro: 'Vaše údaje používame iba na prevádzku účtu, členstva, platieb a bezpečné poskytovanie obsahu.',
    sections: [
      ['Aké údaje spracúvame', 'Údaje účtu, najmä e-mail a profilové údaje, stav členstva, technické údaje potrebné na bezpečnosť a históriu sledovania, ak je pre váš účet dostupná.'],
      ['Platby', 'Platby spracúva Stripe. VÝCHOD BROTHERS neukladá celé údaje platobnej karty. Uchovávame iba informácie potrebné na správu stavu predplatného.'],
      ['Prevádzka platformy', 'Autentifikáciu a databázové služby zabezpečuje Supabase. Video obsah doručuje Cloudflare Stream. Údaje používame v rozsahu potrebnom na poskytovanie týchto služieb.'],
      ['Vaše práva', 'S otázkami o svojich údajoch, oprave alebo vymazaní účtu nás kontaktujte na ahoj@vychodbrothers.sk.'],
    ],
  },
  terms: {
    eyebrow: 'PRÁVNE INFORMÁCIE',
    title: 'Podmienky používania',
    intro: 'Používaním platformy súhlasíte s týmito základnými podmienkami poskytovania digitálneho obsahu.',
    sections: [
      ['Členstvo', 'VÝCHOD BROTHERS Club je mesačné predplatné za 5,99 €. Predplatné sa obnovuje automaticky, kým ho nezrušíte.'],
      ['Prístup k obsahu', 'Členský obsah je určený iba pre prihláseného používateľa s aktívnym členstvom. Zdieľanie účtu alebo neoprávnené šírenie obsahu nie je dovolené.'],
      ['Zrušenie', 'Predplatné môžete kedykoľvek zrušiť cez správu predplatného v časti Môj účet. Prístup ostáva aktívny do konca zaplateného obdobia.'],
      ['Kontakt', 'Otázky k členstvu alebo platforme posielajte na ahoj@vychodbrothers.sk.'],
    ],
  },
}

export default function LegalPage({ type }) {
  const page = pages[type] || pages.terms
  return <article className="legal-page"><span>{page.eyebrow}</span><h1>{page.title}</h1><p className="legal-intro">{page.intro}</p>{page.sections.map(([title, text]) => <section key={title}><h2>{title}</h2><p>{text}</p></section>)}<a href="mailto:ahoj@vychodbrothers.sk">ahoj@vychodbrothers.sk</a></article>
}
