-- Le voci scritte a mano nella lista della spesa possono avere un reparto,
-- e la scelta viene ricordata per la volta successiva ("birra" -> Bevande).

alter table public.lista_spesa
  add column reparto_id uuid references public.reparti (id) on delete set null;
create index lista_spesa_reparto_idx on public.lista_spesa (reparto_id);

create table public.voci_ricordate (
  casa_id uuid not null references public.case (id) on delete cascade,
  testo text not null check (testo = lower(btrim(testo)) and testo <> ''),
  reparto_id uuid not null references public.reparti (id) on delete cascade,
  aggiornata_il timestamptz not null default now(),
  primary key (casa_id, testo)
);
create index voci_ricordate_reparto_idx on public.voci_ricordate (reparto_id);

alter table public.voci_ricordate enable row level security;
revoke all on public.voci_ricordate from anon, authenticated;
grant select, insert, update, delete on public.voci_ricordate to authenticated;
create policy voci_ricordate_casa on public.voci_ricordate for all to authenticated
  using (casa_id in (select private.mie_case()))
  with check (casa_id in (select private.mie_case()));
