-- Corrige marcar_apolice_ativa_por_nomes: o match exato por
-- unaccent(upper(trim(name))) falhava em casos reais encontrados em
-- produção:
--   1. Espaço duplo interno no nome guardado ("MARTINEZ  MELO") — trim()
--      só remove espaços nas pontas, não colapsa espaços a meio.
--   2. Nome do worker sem uma partícula "DE" que a apólice tem
--      ("ANTONIO AUGUSTO DE LIMA" vs "ANTONIO AUGUSTO LIMA").
--   3. Pequenas variantes de grafia entre a extração da apólice (Gemini,
--      a partir de OCR/texto do PDF) e o nome registado
--      ("EDILSON SOUZA..." vs "...SOUSA...", "GABRIEL GOES..." vs
--      "...GOIS...").
-- Adiciona 3 níveis de tentativa, do mais para o menos estrito: exato
-- (com espaços colapsados) → sem palavras de ligação (de/dos/das/da/e) →
-- semelhança por trigram (pg_trgm), só aceite se houver EXATAMENTE UM
-- candidato acima do limiar (nunca escolhe "o mais parecido" às cegas,
-- para não marcar a pessoa errada quando há ambiguidade).
create extension if not exists pg_trgm;

create or replace function public.marcar_apolice_ativa_por_nomes(p_nomes text[])
returns jsonb
language plpgsql as $$
declare
  v_nome_bruto text;
  v_nome text;
  v_worker_id text;
  v_worker_name text;
  v_metodo text;
  v_n_candidatos int;
  v_conectores text[] := array['DE','DOS','DAS','DA','E'];
  v_resultado jsonb := '[]'::jsonb;
begin
  foreach v_nome_bruto in array p_nomes loop
    v_nome := regexp_replace(trim(v_nome_bruto), '\s+', ' ', 'g');
    v_worker_id := null; v_worker_name := null; v_metodo := null;

    -- 1. Match exato (com espaços internos colapsados)
    select id, name into v_worker_id, v_worker_name
    from workers
    where regexp_replace(unaccent(upper(trim(name))), '\s+', ' ', 'g') = v_nome
    limit 1;
    if v_worker_id is not null then v_metodo := 'exato'; end if;

    -- 2. Sem palavras de ligação, dos dois lados
    if v_worker_id is null then
      select id, name into v_worker_id, v_worker_name
      from workers
      where (
        select string_agg(t.w, ' ' order by t.ord)
        from unnest(string_to_array(regexp_replace(unaccent(upper(trim(name))), '\s+', ' ', 'g'), ' ')) with ordinality as t(w, ord)
        where t.w <> all(v_conectores)
      ) = (
        select string_agg(t.w, ' ' order by t.ord)
        from unnest(string_to_array(v_nome, ' ')) with ordinality as t(w, ord)
        where t.w <> all(v_conectores)
      )
      limit 1;
      if v_worker_id is not null then v_metodo := 'sem_conectores'; end if;
    end if;

    -- 3. Semelhança (trigram) — só se for candidato único e inequívoco
    if v_worker_id is null then
      select count(*) into v_n_candidatos
      from workers
      where similarity(unaccent(upper(trim(name))), v_nome) > 0.55;

      if v_n_candidatos = 1 then
        select id, name into v_worker_id, v_worker_name
        from workers
        where similarity(unaccent(upper(trim(name))), v_nome) > 0.55
        limit 1;
        v_metodo := 'semelhanca';
      end if;
    end if;

    if v_worker_id is not null then
      insert into worker_apolice_seguro (worker_id, status, ativo_em, atualizado_por, updated_at)
      values (v_worker_id, 'ativo', now(), 'trabalhador_virtual', now())
      on conflict (worker_id) do update set
        status = 'ativo',
        ativo_em = now(),
        atualizado_por = 'trabalhador_virtual',
        updated_at = now();

      v_resultado := v_resultado || jsonb_build_object(
        'nome_apolice', v_nome_bruto, 'encontrado', true,
        'worker_id', v_worker_id, 'worker_name', v_worker_name, 'metodo', v_metodo
      );
    else
      v_resultado := v_resultado || jsonb_build_object(
        'nome_apolice', v_nome_bruto, 'encontrado', false
      );
    end if;
  end loop;

  return v_resultado;
end;
$$;
