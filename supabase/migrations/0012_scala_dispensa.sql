-- Scala dalla dispensa gli ingredienti usati, cucinando una ricetta o usando un ingrediente da solo.
-- Per ogni ingrediente consuma le confezioni aperte dalla scadenza più vicina (quelle senza scadenza per ultime);
-- una confezione che arriva a zero viene chiusa. Ogni variazione è registrata in movimenti_dispensa.
-- Se in dispensa c'è meno di quanto richiesto, scala quello che c'è e basta.
-- p: { "ricetta_id": uuid facoltativo, "righe": [ { "ingrediente_id": uuid, "quantita": numero } ] }
-- Restituisce quante confezioni ha toccato.
create function public.scala_dispensa(p_casa uuid, p jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_ricetta uuid := (p->>'ricetta_id')::uuid;
  v_motivo public.motivo_movimento := case when (p->>'ricetta_id') is null then 'uso' else 'ricetta' end;
  v_riga jsonb;
  v_resto numeric;
  v_preso numeric;
  v_conf record;
  v_toccate integer := 0;
begin
  if not exists (select 1 from public.case c where c.id = p_casa) then
    raise exception 'scala_dispensa: casa inesistente o non accessibile';
  end if;

  for v_riga in select * from jsonb_array_elements(coalesce(p->'righe', '[]'::jsonb))
  loop
    v_resto := (v_riga->>'quantita')::numeric;
    if v_resto is null or v_resto <= 0 then
      continue;
    end if;
    for v_conf in
      select d.id, d.quantita from public.dispensa d
      where d.casa_id = p_casa and d.ingrediente_id = (v_riga->>'ingrediente_id')::uuid
        and d.esaurita_il is null and d.quantita is not null and d.quantita > 0
      order by d.scadenza nulls last, d.aggiunto_il
      for update
    loop
      exit when v_resto <= 0;
      v_preso := least(v_conf.quantita, v_resto);
      update public.dispensa
      set quantita = v_conf.quantita - v_preso,
          esaurita_il = case when v_conf.quantita - v_preso <= 0 then now() else null end
      where id = v_conf.id;
      insert into public.movimenti_dispensa (casa_id, dispensa_id, variazione, motivo, ricetta_id)
      values (p_casa, v_conf.id, -v_preso, v_motivo, v_ricetta);
      v_resto := v_resto - v_preso;
      v_toccate := v_toccate + 1;
    end loop;
  end loop;
  return v_toccate;
end;
$$;

revoke all on function public.scala_dispensa(uuid, jsonb) from public, anon;
grant execute on function public.scala_dispensa(uuid, jsonb) to authenticated;
