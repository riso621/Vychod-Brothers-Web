import CtaButton from './CtaButton'

export default function CollaborationTeaser() {
  return <section className="collaboration-teaser" id="kontakt" aria-labelledby="collaboration-teaser-heading">
    <div className="collaboration-teaser-copy">
      <span>SPOLUPRÁCE / PARTNERSTVÁ</span>
      <h2 id="collaboration-teaser-heading">Poďme vytvoriť<br />niečo silné.</h2>
      <p>Máte značku, produkt alebo nápad, ktorý patrí do sveta Východ Brothers? Pošlite nám konkrétnu ponuku.</p>
      <CtaButton className="collaboration-main-cta" href="/spolupraca" icon="handshake" label="MÁM ZÁUJEM O SPOLUPRÁCU" />
    </div>
  </section>
}
