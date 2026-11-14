import { vaiAScheda, type Vista } from '../lib/rotta';

const VOCI: { vista: Vista; percorso: string; nome: string; disegno: string }[] = [
  { vista: 'elenco', percorso: '/', nome: 'Ricette', disegno: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zm0 13a3 3 0 0 1 3-3h11M9 8h6' },
  { vista: 'menu', percorso: '/menu', nome: 'Menù', disegno: 'M4 6h16v14H4V6zm0 4h16M8 3v4m8-4v4M8 14h3m2 0h3' },
  { vista: 'lista', percorso: '/lista', nome: 'Lista', disegno: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2' },
];

export default function Barra({ vista }: { vista: Vista }) {
  return (
    <nav className="barra-basso" aria-label="Sezioni">
      {VOCI.map((v) => (
        <a
          key={v.vista}
          href={`#${v.percorso}`}
          aria-current={v.vista === vista ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            if (v.vista !== vista) vaiAScheda(v.percorso);
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path d={v.disegno} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {v.nome}
        </a>
      ))}
    </nav>
  );
}
