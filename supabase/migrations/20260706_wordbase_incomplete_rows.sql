-- Efficient lookup for WordBase maintenance: rows missing text, memory tips, or images.

CREATE OR REPLACE FUNCTION public.wordbase_has_memory_tips(
  tips_by_locale jsonb,
  tip_locale text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(tips_by_locale -> tip_locale -> 'tips', '[]'::jsonb)) AS tip(value)
    WHERE btrim(COALESCE(tip.value ->> 'method', '')) <> ''
      AND btrim(COALESCE(tip.value ->> 'content', '')) <> ''
  );
$$;

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

GRANT EXECUTE ON FUNCTION public.wordbase_has_memory_tips(jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_incomplete_wordbase_rows(integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_incomplete_wordbase_rows(integer, text) TO authenticated;
