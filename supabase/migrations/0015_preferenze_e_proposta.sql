-- Preferenze del menù, limiti sugli ingredienti e proposta della settimana.

-- Gruppo dell'ingrediente, per i limiti settimanali ("carne rossa al massimo 2 volte").
-- Porzione tipica e ruolo quando l'ingrediente si mangia da solo o in coppia a colazione o merenda
-- ("fiocchi di latte e gallette"); nulli = non viene proposto come spuntino.
alter table public.ingredienti
  add column gruppo text check (gruppo in ('carne_rossa', 'carne_bianca', 'pesce', 'uova', 'latticini', 'legumi')),
  add column porzione_spuntino numeric check (porzione_spuntino > 0),
  add column ruolo_spuntino text check (ruolo_spuntino in ('latticino', 'uova', 'pane', 'cereali', 'frutta', 'frutta_secca', 'polvere'));

-- Voce proposta dall'app (si può annullare in blocco) e voce fatta di alimenti singoli:
-- alimenti = [{"ingrediente_id": uuid, "quantita": numero nell'unità base}], con il nome leggibile in "nota".
alter table public.piano_pasti
  add column proposta boolean not null default false,
  add column alimenti jsonb;

-- Preferenze della casa per il menù: una riga per casa, modificabile da tutti i membri.
create table public.preferenze_casa (
  casa_id uuid primary key references public.case (id) on delete cascade,
  dati jsonb not null default '{}'::jsonb,
  aggiornato_il timestamptz not null default now()
);
alter table public.preferenze_casa enable row level security;
revoke all on public.preferenze_casa from anon, authenticated;
grant select, insert, update, delete on public.preferenze_casa to authenticated;
create policy preferenze_casa_casa on public.preferenze_casa for all to authenticated
  using (casa_id in (select private.mie_case()))
  with check (casa_id in (select private.mie_case()));

-- Preferenze di ciascuno (cosa non mangia, limiti, cosa gli piace): le leggono tutti i membri
-- della casa, perché servono a comporre un menù comune; le scrive solo l'interessato.
create table public.preferenze_persona (
  casa_id uuid not null references public.case (id) on delete cascade,
  utente_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dati jsonb not null default '{}'::jsonb,
  aggiornato_il timestamptz not null default now(),
  primary key (casa_id, utente_id)
);
alter table public.preferenze_persona enable row level security;
revoke all on public.preferenze_persona from anon, authenticated;
grant select, insert, update, delete on public.preferenze_persona to authenticated;
create policy preferenze_persona_lettura on public.preferenze_persona for select to authenticated
  using (casa_id in (select private.mie_case()));
create policy preferenze_persona_inserisci on public.preferenze_persona for insert to authenticated
  with check (utente_id = (select auth.uid()) and casa_id in (select private.mie_case()));
create policy preferenze_persona_modifica on public.preferenze_persona for update to authenticated
  using (utente_id = (select auth.uid()) and casa_id in (select private.mie_case()))
  with check (utente_id = (select auth.uid()) and casa_id in (select private.mie_case()));
create policy preferenze_persona_elimina on public.preferenze_persona for delete to authenticated
  using (utente_id = (select auth.uid()) and casa_id in (select private.mie_case()));

-- Obiettivi di tutte le persone della casa, per calcolare un menù che vada bene a ognuno.
-- Deciso con Paul: gli obiettivi sono leggibili dagli altri membri solo per questo calcolo.
-- La tabella obiettivi resta leggibile direttamente solo dal suo proprietario; il diario resta privato.
create function public.obiettivi_casa(p_casa uuid)
returns table (utente_id uuid, fissi boolean, settimana jsonb, giorni jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select o.utente_id, o.fissi, o.settimana, o.giorni
  from public.obiettivi o
  join public.membri m on m.utente_id = o.utente_id
  where m.casa_id = p_casa and p_casa in (select private.mie_case());
$$;
revoke all on function public.obiettivi_casa(uuid) from public, anon;
grant execute on function public.obiettivi_casa(uuid) to authenticated;

-- La lista della spesa conta anche le voci fatte di alimenti singoli.
create or replace function public.genera_lista_spesa(p_casa uuid, p_dal date, p_al date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  if p_casa not in (select private.mie_case()) then
    raise exception 'genera_lista_spesa: casa non accessibile';
  end if;
  if p_al < p_dal then
    raise exception 'genera_lista_spesa: intervallo di date non valido';
  end if;

  with vecchie as (
    delete from public.lista_spesa l
    where l.casa_id = p_casa and l.origine = 'menu'
    returning l.ingrediente_id, l.spuntata, l.spuntata_il
  ),
  da_ricette as (
    select ri.ingrediente_id, ri.quantita * coalesce(pp.porzioni, r.porzioni) / r.porzioni as quantita
    from public.piano_pasti pp
    join public.ricette r on r.id = pp.ricetta_id
    join public.ricetta_ingredienti ri on ri.ricetta_id = r.id
    join public.ingredienti i on i.id = ri.ingrediente_id
    where pp.casa_id = p_casa
      and pp.data between p_dal and p_al
      and pp.cucinata_il is null
      and ri.quantita is not null
      and not ri.facoltativo
      and i.tracciamento = 'quantita'
  ),
  -- voci del menù fatte di alimenti singoli (per esempio una merenda "fiocchi di latte e gallette")
  da_alimenti as (
    select (a->>'ingrediente_id')::uuid as ingrediente_id, (a->>'quantita')::numeric as quantita
    from public.piano_pasti pp
    cross join lateral jsonb_array_elements(pp.alimenti) a
    join public.ingredienti i on i.id = (a->>'ingrediente_id')::uuid
    where pp.casa_id = p_casa
      and pp.data between p_dal and p_al
      and pp.cucinata_il is null
      and pp.alimenti is not null
      and i.tracciamento = 'quantita'
  ),
  fabbisogno as (
    select x.ingrediente_id, sum(x.quantita) as quantita
    from (select * from da_ricette union all select * from da_alimenti) x
    group by x.ingrediente_id
  ),
  in_casa as (
    select d.ingrediente_id, sum(d.quantita) as quantita
    from public.dispensa d
    where d.casa_id = p_casa and d.esaurita_il is null and d.quantita is not null
      and (d.scadenza is null or d.scadenza >= current_date)  -- ciò che è scaduto non conta come disponibile
    group by d.ingrediente_id
  )
  insert into public.lista_spesa (casa_id, ingrediente_id, quantita, unita, origine, spuntata, spuntata_il)
  select p_casa, f.ingrediente_id, f.quantita - coalesce(c.quantita, 0), i.unita_base, 'menu',
         coalesce(v.spuntata, false), v.spuntata_il
  from fabbisogno f
  join public.ingredienti i on i.id = f.ingrediente_id
  left join in_casa c on c.ingrediente_id = f.ingrediente_id
  left join lateral (
    select bool_or(x.spuntata) as spuntata, max(x.spuntata_il) as spuntata_il
    from vecchie x where x.ingrediente_id = f.ingrediente_id
  ) v on true
  where f.quantita - coalesce(c.quantita, 0) > 0;

  get diagnostics n = row_count;
  return n;
end;
$$;
