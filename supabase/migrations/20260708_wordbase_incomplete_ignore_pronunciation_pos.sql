-- WordBase maintenance: do not treat pronunciation or part_of_speech as required.

CREATE OR REPLACE FUNCTION public.get_incomplete_wordbase_rows(
  p_limit integer DEFAULT 120,
  p_search text DEFAULT NULL
)
RETURNS SETOF public.wordbase
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.*
  FROM public.wordbase w
  WHERE (
    btrim(COALESCE(w.definition, '')) = ''
    OR btrim(COALESCE(w.translation, '')) = ''
    OR btrim(COALESCE(w.example, '')) = ''
    OR btrim(COALESCE(w.example_translation, '')) = ''
    OR w.memory_image IS NULL
    OR btrim(COALESCE(w.memory_image ->> 'imageUrl', w.memory_image ->> 'url', '')) = ''
    OR (
      NOT public.wordbase_has_memory_tips(w.memory_tips_by_locale, 'zh-Hant')
      AND NOT public.wordbase_has_memory_tips(w.memory_tips_by_locale, 'zh-Hans')
    )
  )
  AND (
    p_search IS NULL
    OR btrim(p_search) = ''
    OR w.term ILIKE ('%' || btrim(p_search) || '%')
    OR w.term_key ILIKE ('%' || lower(btrim(p_search)) || '%')
  )
  ORDER BY w.term_key
  LIMIT GREATEST(COALESCE(p_limit, 120), 1);
$$;
