import { createClient } from "@supabase/supabase-js";

export type ResponsumUser = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

/** Cliente admin do Supabase Responsum (somente servidor). */
export function createResponsumClient() {
  const url = process.env.RESPONSUM_SUPABASE_URL;
  const key = process.env.RESPONSUM_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
