-- La lista generata dal menù tiene conto della dispensa: di ogni ingrediente si compra solo quello
-- che manca rispetto a ciò che c'è in casa (somma delle confezioni aperte); se basta, non entra in lista.
-- Il resto è uguale alla 0007.
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
  fabbisogno as (
    select ri.ingrediente_id, sum(ri.quantita * coalesce(pp.porzioni, r.porzioni) / r.porzioni) as quantita
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
    group by ri.ingrediente_id
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
