-- Allow signed-in admins to list incomplete WordBase rows directly from the app.
GRANT EXECUTE ON FUNCTION public.get_incomplete_wordbase_rows(integer, text) TO authenticated;
