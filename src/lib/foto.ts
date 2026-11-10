import { supabase } from './supabase';

const LATO_MASSIMO = 1400;

/** Rimpicciolisce la foto sul telefono prima dell'invio: da qualche MB a circa 200 KB. */
async function riduci(file: File): Promise<Blob> {
  const immagine = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scala = Math.min(1, LATO_MASSIMO / Math.max(immagine.width, immagine.height));
  const tela = document.createElement('canvas');
  tela.width = Math.round(immagine.width * scala);
  tela.height = Math.round(immagine.height * scala);
  tela.getContext('2d')!.drawImage(immagine, 0, 0, tela.width, tela.height);
  immagine.close();
  return new Promise((ok, ko) =>
    tela.toBlob((b) => (b ? ok(b) : ko(new Error('Conversione della foto non riuscita'))), 'image/jpeg', 0.82),
  );
}

/** Carica la foto come copertina della ricetta e rimuove quella precedente, se c'era. */
export async function salvaCopertina(casaId: string, ricettaId: string, file: File, precedente: string | null) {
  const foto = await riduci(file);
  const percorso = `${casaId}/${ricettaId}-${Date.now()}.jpg`;
  const caricamento = await supabase.storage.from('copertine').upload(percorso, foto, { contentType: 'image/jpeg' });
  if (caricamento.error) throw new Error(caricamento.error.message);
  const aggiornamento = await supabase.from('ricette').update({ copertina_path: percorso }).eq('id', ricettaId);
  if (aggiornamento.error) {
    await supabase.storage.from('copertine').remove([percorso]);
    throw new Error(aggiornamento.error.message);
  }
  // la vecchia foto non serve più; se la rimozione fallisce resta solo un file inutilizzato
  if (precedente) await supabase.storage.from('copertine').remove([precedente]);
}
