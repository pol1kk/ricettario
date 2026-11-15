import { useEffect, useRef, useState, type FormEvent } from 'react';

type Rilevatore = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type FinestraConRilevatore = Window & { BarcodeDetector?: new (o: { formats: string[] }) => Rilevatore };

const valido = (codice: string) => /^\d{8,14}$/.test(codice);

/**
 * Inquadra un codice a barre con la fotocamera e restituisce le cifre.
 * Dove il telefono sa leggerli da solo (Android) usa quello, altrimenti (iPhone) una libreria caricata al momento.
 * Si può sempre scrivere il codice a mano: la fotocamera è una scorciatoia, non un obbligo.
 */
export default function Scanner({ trovato, chiudi }: { trovato: (codice: string) => void; chiudi: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [pronta, setPronta] = useState(false);
  const [aMano, setAMano] = useState('');
  const consegna = useRef(trovato);
  consegna.current = trovato;

  useEffect(() => {
    let attivo = true;
    let flusso: MediaStream | null = null;
    let ferma: (() => void) | null = null;

    const letto = (codice: string) => {
      if (!attivo || !valido(codice)) return;
      attivo = false;
      navigator.vibrate?.(40);
      consegna.current(codice);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('assente');
        flusso = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!attivo || !video.current) {
          flusso.getTracks().forEach((t) => t.stop());
          return;
        }
        const Nativo = (window as FinestraConRilevatore).BarcodeDetector;
        if (Nativo) {
          video.current.srcObject = flusso;
          await video.current.play();
          setPronta(true);
          const rilevatore = new Nativo({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          const giro = window.setInterval(async () => {
            if (!video.current || video.current.readyState < 2) return;
            try {
              const [primo] = await rilevatore.detect(video.current);
              if (primo) letto(primo.rawValue);
            } catch {
              /* fotogramma non leggibile: si riprova al prossimo */
            }
          }, 200);
          ferma = () => window.clearInterval(giro);
        } else {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import('@zxing/browser'),
            import('@zxing/library'),
          ]);
          if (!attivo || !video.current) return;
          const indizi = new Map<number, unknown>([
            [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
            [DecodeHintType.TRY_HARDER, true],
          ]);
          const lettore = new BrowserMultiFormatReader(indizi as never, { delayBetweenScanAttempts: 120 });
          const controlli = await lettore.decodeFromStream(flusso, video.current, (risultato) => {
            if (risultato) letto(risultato.getText());
          });
          setPronta(true);
          ferma = () => controlli.stop();
        }
      } catch (e) {
        if (!attivo) return;
        const nome = (e as Error).name;
        setErrore(
          nome === 'NotAllowedError'
            ? 'Non ho il permesso di usare la fotocamera. Puoi darlo dalle impostazioni del telefono, oppure scrivere il codice qui sotto.'
            : 'Non riesco ad aprire la fotocamera. Scrivi il codice qui sotto.',
        );
      }
    })();

    return () => {
      attivo = false;
      ferma?.();
      flusso?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const invia = (e: FormEvent) => {
    e.preventDefault();
    const codice = aMano.replace(/\D/g, '');
    if (valido(codice)) trovato(codice);
  };

  return (
    <main className="scanner">
      <div className="barra">
        <button className="indietro secondario" onClick={chiudi}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Annulla
        </button>
      </div>
      <header className="ricetta-testa">
        <h1>Inquadra il codice a barre</h1>
      </header>

      {errore ? (
        <p role="alert" className="errore">
          {errore}
        </p>
      ) : (
        <div className="mirino" data-pronta={pronta}>
          <video ref={video} playsInline muted />
          <span className="riga-mirino" aria-hidden="true" />
          {!pronta && <p className="nota">Apro la fotocamera…</p>}
        </div>
      )}

      <form className="modulo codice-a-mano" onSubmit={invia}>
        <label htmlFor="codice">Oppure scrivi le cifre sotto il codice</label>
        <div className="riga">
          <input id="codice" inputMode="numeric" placeholder="8001234567890" value={aMano} onChange={(e) => setAMano(e.target.value)} />
          <button type="submit" className="contorno" disabled={!valido(aMano.replace(/\D/g, ''))}>
            Cerca
          </button>
        </div>
      </form>
    </main>
  );
}
