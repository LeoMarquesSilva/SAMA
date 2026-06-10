import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client para uso em Client Components (browser).
 * Usa a anon key — protegido por RLS no banco.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
