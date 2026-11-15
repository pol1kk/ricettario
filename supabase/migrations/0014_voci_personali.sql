-- Menù condiviso con voci personali.
-- Una voce del menù vale per tutta la casa (per_utente nullo) oppure per una sola persona.
-- Le voci personali restano visibili alla casa (la spesa è comune), ma l'app le mostra di base solo all'interessato.
alter table public.piano_pasti
  add column per_utente uuid references auth.users (id) on delete cascade;

create index piano_pasti_per_utente on public.piano_pasti (per_utente) where per_utente is not null;

-- Nome con cui una persona compare agli altri della casa ("Solo per Diana").
alter table public.membri add column nome text check (nome is null or btrim(nome) <> '');

-- Ognuno sceglie il proprio nome; la tabella membri non è scrivibile direttamente dall'app.
create function public.imposta_nome(p_casa uuid, p_nome text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.membri set nome = nullif(btrim(p_nome), '')
  where casa_id = p_casa and utente_id = (select auth.uid());
$$;

revoke all on function public.imposta_nome(uuid, text) from public, anon;
grant execute on function public.imposta_nome(uuid, text) to authenticated;
