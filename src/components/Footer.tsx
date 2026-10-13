import Logo from "./Logo";

const Footer = () => (
  <footer className="w-full bg-muted py-20">
    <div className="container max-w-3xl mx-auto text-center space-y-6">
      <Logo className="h-12 w-auto mx-auto" />
      <p className="text-sm text-muted-foreground leading-relaxed">
        Trova le offerte dei volantini italiani senza aprire decine di PDF.
        Inserisci la tua città, scegli i volantini delle catene preferite e i
        prodotti che ti interessano: i prezzi vengono estratti automaticamente
        da doveconviene.it.
      </p>
      <div className="pt-4 border-t border-border text-xs text-muted-foreground">
        © {new Date().getFullYear()} dove-conviene-scraper · Progetto personale
        di Giacomo Rossi · Dati estratti da{" "}
        <a
          href="https://www.doveconviene.it"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          doveconviene.it
        </a>
      </div>
    </div>
  </footer>
);

export default Footer;
