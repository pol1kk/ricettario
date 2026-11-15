-- Dispensa: valori nutrizionali dei prodotti scansionati e funzioni per mettere via la spesa
-- e chiudere una confezione. Le tabelle (prodotti, dispensa, movimenti_dispensa) esistono dalla 0001.

alter table public.prodotti
  add column kcal_100 numeric check (kcal_100 >= 0),
  add column proteine_100 numeric check (proteine_100 >= 0),
  add column carboidrati_100 numeric check (carboidrati_100 >= 0),
  add column grassi_100 numeric check (grassi_100 >= 0);

-- Mette in dispensa una o più confezioni uguali, registra l'acquisto e, se arriva dalla lista
-- della spesa, toglie la voce dalla lista. Tutto insieme: o riesce tutto o niente.
-- p: { ingrediente_id, prodotto_id?, quantita?, stato?, scadenza?, posizione?, confezioni?, voce_lista? }
create function public.metti_in_dispensa(p_casa uuid, p jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_ingrediente uuid := (p->>'ingrediente_id')::uuid;
  v_prodotto uuid := (p->>'prodotto_id')::uuid;
  v_quantita numeric := (p->>'quantita')::numeric;
  v_stato public.stato_scorta := (p->>'stato')::public.stato_scorta;
  v_posizione public.posizione_dispensa := coalesce((p->>'posizione')::public.posizione_dispensa, 'dispensa');
  v_confezioni integer := least(greatest(coalesce((p->>'confezioni')::integer, 1), 1), 50);
  v_tracciamento public.tipo_tracciamento;
  v_riga uuid;
begin
  select i.tracciamento into v_tracciamento from public.ingredienti i
  where i.id = v_ingrediente and i.casa_id = p_casa;
  if not found then
    raise exception 'metti_in_dispensa: ingrediente inesistente o non accessibile';
  end if;
  if v_tracciamento = 'stato' then
    v_quantita := null;
    v_stato := coalesce(v_stato, 'presente');
  else
    v_stato := null;
  end if;

  for n in 1..v_confezioni loop
    insert into public.dispensa (casa_id, ingrediente_id, prodotto_id, quantita, stato, scadenza, posizione)
    values (p_casa, v_ingrediente, v_prodotto, v_quantita, v_stato, (p->>'scadenza')::date, v_posizione)
    returning id into v_riga;
    insert into public.movimenti_dispensa (casa_id, dispensa_id, variazione, stato_nuovo, motivo)
    values (p_casa, v_riga, v_quantita, v_stato, 'acquisto');
  end loop;

  -- la prossima volta lo stesso prodotto viene proposto nello stesso posto
  if v_prodotto is not null then
    update public.prodotti set posizione_predefinita = v_posizione
    where id = v_prodotto and casa_id = p_casa and posizione_predefinita <> v_posizione;
  end if;

  if p->>'voce_lista' is not null then
    delete from public.lista_spesa where id = (p->>'voce_lista')::uuid and casa_id = p_casa;
  end if;
  return v_confezioni;
end;
$$;

-- Chiude una confezione: finita ('uso') oppure buttata ('buttato').
create function public.chiudi_confezione(p_dispensa uuid, p_motivo public.motivo_movimento)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v public.dispensa;
begin
  if p_motivo not in ('uso', 'buttato') then
    raise exception 'chiudi_confezione: motivo non valido';
  end if;
  update public.dispensa set esaurita_il = now(), stato = case when stato is null then null else 'finito'::public.stato_scorta end
  where id = p_dispensa and esaurita_il is null
  returning * into v;
  if not found then
    return;
  end if;
  insert into public.movimenti_dispensa (casa_id, dispensa_id, variazione, stato_nuovo, motivo)
  values (v.casa_id, v.id, -v.quantita, v.stato, p_motivo);
end;
$$;

revoke all on function public.metti_in_dispensa(uuid, jsonb) from public, anon;
grant execute on function public.metti_in_dispensa(uuid, jsonb) to authenticated;
revoke all on function public.chiudi_confezione(uuid, public.motivo_movimento) from public, anon;
grant execute on function public.chiudi_confezione(uuid, public.motivo_movimento) to authenticated;
