import { leggiCache } from '../lib/dati';
import { vaiAScheda, type Vista } from '../lib/rotta';

const VOCI: { vista: Vista; percorso: string; nome: string; disegno: string }[] = [
  { vista: 'diario', percorso: '/', nome: 'Diario', disegno: 'M12 3a9 9 0 1 0 9 9M12 7.5a4.5 4.5 0 1 0 4.5 4.5M12 12l7-7m0 0v3.5M19 5h-3.5' },
  { vista: 'menu', percorso: '/menu', nome: 'Menù', disegno: 'M4 6h16v14H4V6zm0 4h16M8 3v4m8-4v4M8 14h3m2 0h3' },
  { vista: 'dispensa', percorso: '/dispensa', nome: 'Dispensa', disegno: 'M5 3h14v18H5V3zm0 7h14M9 6.5v1M9 13v2.5' },
  { vista: 'elenco', percorso: '/ricette', nome: 'Ricette', disegno: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zm0 13a3 3 0 0 1 3-3h11M9 8h6' },
];

export default function Barra({ vista }: { vista: Vista }) {
  return (
    <nav className="barra-basso" aria-label="Sezioni">
      {VOCI.map((v) => {
        // la sezione Dispensa contiene anche la lista della spesa, e riapre l'ultima delle due che si è usata
        const attiva = v.vista === vista || (v.vista === 'dispensa' && vista === 'lista');
        const percorso = v.vista === 'dispensa' && leggiCache<string>('scheda-dispensa') === 'lista' ? '/lista' : v.percorso;
        return (
        <a
          key={v.vista}
          href={`#${percorso}`}
          aria-current={attiva ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            if (!attiva) vaiAScheda(percorso);
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path d={v.disegno} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {v.nome}
        </a>
        );
      })}
    </nav>
  );
}
