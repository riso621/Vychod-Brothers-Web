import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import CtaButton from './CtaButton'

const reveal = { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: .78, ease: [.2, .7, .2, 1] } } }

function Reveal({ as: Tag = 'div', className = '', children }) {
  const reduceMotion = useReducedMotion()
  const Component = motion.create(Tag)
  return <Component className={className} initial={reduceMotion ? false : 'hidden'} whileInView="visible" viewport={{ once: true, amount: .16 }} variants={reveal}>{children}</Component>
}

function Chapter({ number, eyebrow, title, children, className = '' }) {
  return <section className={`story-chapter ${className}`} aria-labelledby={`story-chapter-${number}`}>
    <Reveal className="story-chapter-heading"><span>{String(number).padStart(2, '0')} / {eyebrow}</span><h2 id={`story-chapter-${number}`}>{title}</h2></Reveal>
    <Reveal className="story-prose">{children}</Reveal>
  </section>
}

export default function AboutPage() {
  useEffect(() => {
    const previousTitle = document.title
    const description = document.querySelector('meta[name="description"]')
    const previousDescription = description?.getAttribute('content')
    document.title = 'O nás – Príbeh Východ Brothers'
    if (description) description.setAttribute('content', 'Príbeh Východ Brothers: od jedného improvizovaného videa až po spoločnú tvorbu, YouTube a komunitu.')
    return () => { document.title = previousTitle; if (description && previousDescription) description.setAttribute('content', previousDescription) }
  }, [])

  return <article className="story-page">
    <header className="story-hero">
      <div className="story-hero-image" aria-hidden="true" />
      <div className="story-hero-shade" aria-hidden="true" />
      <Reveal className="story-hero-copy"><span>NÁŠ PRÍBEH</span><h1>Nezačali sme<br />ako Východ Brothers.</h1><strong>Všetko začalo<br /><em>jedným videom.</em></strong><p>Bez štúdia. Bez scenára. Bez veľkého plánu. Len telefón, humor a traja chalani z východu.</p></Reveal>
      <a className="story-scroll" href="#pred-vychod-brothers">OBJAVIŤ PRÍBEH <span aria-hidden="true">↓</span></a>
    </header>

    <div className="story-body">
      <Chapter number={1} eyebrow="PRED VÝCHOD BROTHERS" title="Boli sme hlavne kamaráti." className="is-opening">
        <p id="pred-vychod-brothers">Všetko sa začalo úplne obyčajne. Bez veľkých plánov, bez štúdia, bez scenárov a bez predstavy, kam nás to raz dostane.</p>
        <p>Ešte pred Východ Brothers sme si každý išli svoje. Rišo natáčal krátke humorné videá na sociálne siete – rôzne scénky, tance a bláznivé nápady, za ktoré sa dnes už radšej smeje, než by sa nimi chválil.</p>
        <p>David mal k tvorbe blízko odmalička. Už ako chlapec skúšal YouTube a sníval o tom, že raz bude youtuberom. Dokonca mal obdobie, keď chcel byť Harry Potter. Na to mu, samozrejme, dodnes nezabúdame.</p>
        <p>Neboli sme však žiadna internetová skupina. Boli sme hlavne kamaráti. David a Ivan sú bratranci Rišovej manželky, no časom sme sa začali brať skôr ako bratia.</p>
        <p>Trávili sme spolu množstvo času, chodili von a pravidelne sa stretávali u Davidovej babky na obede. Veď kde sa človek naje lepšie ako u babky?</p>
        <p>Humor bol medzi nami odjakživa. Rozprávali sme si príhody z domu, napodobňovali rodičov a starých rodičov a smiali sa na situáciách, ktoré podľa nás pozná skoro každá rodina na východe Slovenska.</p>
      </Chapter>

      <section className="story-visual-break"><img src="/images/team/vychod-brothers-team-day.webp" alt="Východ Brothers počas spoločného dňa" loading="lazy" decoding="async" /><Reveal><span>DAVID • IVAN • RIŠO</span><strong>Najprv kamaráti.<br />Časom ako bratia.</strong></Reveal></section>

      <Chapter number={2} eyebrow="JEDEN OBYČAJNÝ DEŇ" title={<>Poďme natočiť<br /><em>niečo spolu.</em></>}>
        <p>Počas jedného z úplne obyčajných dní vznikol nápad skúsiť spoločné video.</p><p>Zavreli sme sa s telefónom do izby a začali improvizovať.</p><p>Rišo sa zahral na deda. David na vnuka.</p><p>Nápad bol jednoduchý a veľmi náš – vnuk má frajerku a dedo samozrejme potrebuje vedieť to najdôležitejšie:</p>
        <blockquote>„A z akej je rodiny?“</blockquote>
        <p>Pretože na východe predsa každý každého pozná.</p><p>Nemali sme pripravený scenár. Jednoducho sme zapli telefón a išli. Presne tak, ako veľakrát tvoríme dodnes – nápad, postavy a improvizácia.</p>
      </Chapter>

      <Chapter number={3} eyebrow="VIDEO, KTORÉ VŠETKO ZMENILO" title="Potom sme začali pozerať na čísla." className="is-milestone">
        <p>Video sme natočili, nasmiali sa na ňom a zverejnili ho na TikToku. Neočakávali sme od neho prakticky nič.</p>
        <div className="story-numbers" aria-label="Približná spomienka na výsledky prvého videa"><div><span>ZA NECELÚ HODINU</span><strong>≈ 3 500 – 4 000</strong><b>LAJKOV</b></div><div><span>&nbsp;</span><strong>100+</strong><b>KOMENTÁROV</b></div></div>
        <small>Približná spomienka na naše začiatky, nie auditované analytické údaje.</small>
        <p>Pre niekoho možno obyčajné čísla. Pre nás v tom čase niečo neuveriteľné.</p><p>Sedeli sme, pozerali na telefón a nechápali, čo sa deje.</p>
        <blockquote>„Prvýkrát sme pocítili, že sme možno našli niečo, čo je skutočne naše.“</blockquote>
      </Chapter>

      <Chapter number={4} eyebrow="Z JEDNÉHO VIDEA BOLA SÉRIA" title="Ešte jedno. A potom ďalšie." className="is-series">
        <p>Povedali sme si, že skúsime ešte jedno.</p><p>Fungovalo.</p><p>Tak sme natočili ďalšie. A ďalšie.</p><p>Postupne vznikali nové postavy, situácie zo života, susedia, rodinné scénky a najmä náš vlastný východniarsky humor.</p><p>Nechceli sme kopírovať niekoho iného. Chceli sme robiť situácie, pri ktorých si človek povie:</p><blockquote>„Presne toto poznám!“</blockquote><p>Niekoľko mesiacov sme tvorili prakticky iba krátke videá. Postupne nám však začalo dochádzať, že ak to chceme robiť spolu, potrebujeme spoločné meno.</p>
      </Chapter>

      <Chapter number={5} eyebrow="IVAN PRICHÁDZA PRED KAMERU" title={<>Najprv kameroval.<br /><em>Potom prišiel Pišta.</em></>} className="is-ivan">
        <p>Lenže Východ Brothers ešte neboli kompletní.</p>
        <p>Keď sme s Davidom začínali natáčať prvé spoločné videá, Ivan bol väčšinou na druhej strane telefónu. Kameroval nás.</p>
        <p>Pred kameru sa totiž veľmi nehrnul. Práve naopak.</p>
        <p>Dodnes sa na tom smejeme, pretože nám hovoril, že on sa na internete nebude strápňovať, nebude sa ukazovať vo videách a že toto jednoducho nie je pre neho.</p>
        <div className="story-ivan-turn" aria-label="Ivanov prechod spoza kamery pred kameru">
          <div><span>KEDYSI</span><strong>„JA SA NA VIDEÁCH<br />STRÁPŇOVAŤ NEBUDEM.“</strong></div>
          <i aria-hidden="true">↓</i>
          <div><span>DNES</span><strong>PIŠTA.</strong><small>JEDNA Z NAJVÝRAZNEJŠÍCH<br />POSTÁV VÝCHOD BROTHERS.</small></div>
        </div>
        <p>My sme však vedeli svoje.</p>
        <p>Postupne sme ho začali prehovárať, až sa jedného dňa ocitol pred kamerou aj on. A ukázalo sa, že to bol celkom dobrý nápad.</p>
        <p>Z človeka, ktorý pôvodne nechcel byť vo videách vôbec, sa postupne stala jedna z najvýraznejších tvárí Východ Brothers.</p>
        <p>A potom prišiel <strong>PIŠTA</strong>. Postava, pod ktorou dnes Ivana pozná množstvo našich divákov.</p>
        <p>Jeho prejav, improvizácia a spôsob, akým dokáže Pištu zahrať, sa stali neoddeliteľnou súčasťou našich videí.</p>
        <p>A keď si dnes spomenieme na to, že kedysi nechcel ani stáť pred kamerou, o to viac sa na tom smejeme.</p>
      </Chapter>

      <Reveal className="story-name-reveal"><span>A TAK VZNIKLI</span><strong>VÝCHOD<br /><em>BROTHERS.</em></strong></Reveal>

      <Chapter number={6} eyebrow="Z TIKTOKU NA YOUTUBE" title="Chceli sme väčšie príbehy." className="is-journey">
        <p>Neskôr prišiel ďalší krok.</p><p>YouTube.</p><p>Krátke videá nám už nestačili. Chceli sme robiť väčšie príbehy, dlhšie scénky, nové postavy a projekty, pri ktorých budeme mať väčšiu slobodu.</p><p>A tak sme začali budovať YouTube kanál Východ Brothers.</p>
        <ol className="story-steps" aria-label="Vývoj tvorby">
          <li><span>01</span><strong>KRÁTKE VIDEÁ</strong><small>Začiatky na sociálnych sieťach</small></li>
          <li><span>02</span><strong>VÝCHOD BROTHERS</strong><small>Vznik spoločnej identity</small></li>
          <li><span>03</span><strong>YOUTUBE</strong><small>Dlhšie príbehy a nové formáty</small></li>
          <li><span>04</span><strong>VÄČŠIE PROJEKTY</strong><small>Viac možností, väčšia sloboda</small></li>
        </ol>
      </Chapter>

      <Chapter number={7} eyebrow="KTO SME DNES" title={<>Sme<br /><em>Východ Brothers.</em></>} className="is-identity">
        <strong className="story-names">DAVID • IVAN • RIŠO</strong>
        <figure className="story-today-portrait"><img src="/images/team/vychod-brothers-team-evening.webp" alt="David, Ivan a Rišo – Východ Brothers dnes" width="1536" height="2048" loading="lazy" decoding="async" /><figcaption><span>VÝCHOD BROTHERS • DNES</span><strong>DAVID • IVAN • RIŠO</strong></figcaption></figure>
        <p>Traja chalani, ktorých spojilo kamarátstvo, humor a východ Slovenska.</p><p>Za tie roky nebolo všetko dokonalé.</p><p>Pohádali sme sa. Urobili sme chyby. Niektoré videá uspeli, iné vôbec. Stretli sme ľudí, ktorí nám pomohli, ale aj takých, ktorí sa nás snažili oklamať. Boli chvíle, keď veci nešli podľa predstáv.</p><p>Jedna vec sa však nezmenila:</p><strong className="story-statement">NEVZDALI SME SA.</strong>
      </Chapter>

      <Chapter number={8} eyebrow="VÝCHOD JE NÁŠ DOMOV" title={<>Východ nie je<br />iba náš názov.<br /><em>Je to náš domov.</em></>} className="is-home">
        <p>Nikdy sme nezabudli, odkiaľ pochádzame.</p><p>Sme na východ Slovenska hrdí a práve jeho humor, ľudia, nárečie, rodiny a každodenné situácie sú veľkou časťou toho, čo tvoríme.</p>
      </Chapter>

      <Chapter number={9} eyebrow="PREČO TO ROBÍME" title="Za každým číslom je človek." className="is-purpose">
        <p>Na začiatku nás tešilo niekoľko stoviek lajkov.</p><p>Dnes pre nás majú najväčšiu hodnotu úplne iné správy.</p><p>Za tie roky nám písali ľudia, ktorí prechádzali veľmi ťažkým obdobím. Ozvali sa nám aj ľudia bojujúci s vážnymi chorobami, ktorí nám povedali, že naše videá im aspoň na chvíľu pomohli vypnúť, zasmiať sa a myslieť na niečo iné.</p><p className="story-purpose-truth">A práve vtedy si človek uvedomí, že za každým číslom na obrazovke je skutočný človek.</p><p>Ak dokážeme niekomu po ťažkom dni zlepšiť náladu, rozosmiať rodinu pri jednom videu alebo aspoň na pár minút pomôcť zabudnúť na problémy, potom má to, čo robíme, zmysel.</p>
      </Chapter>

      <Reveal as="footer" className="story-finale"><span>VÝCHOD BROTHERS</span><h2>Kým sa budete<br />smiať vy,<br /><em>budeme tvoriť my.</em></h2><strong>DAVID • IVAN • RIŠO</strong><p>Nie preto, že všetko vždy vyjde.<br />Nie preto, že cesta je jednoduchá.<br />Ale preto, že nás to stále baví.</p><CtaButton href="/videos" icon="play" label="POZRIEŤ NAŠE VIDEÁ" /></Reveal>
    </div>
  </article>
}
