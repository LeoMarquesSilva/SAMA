import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/** Mapa auth_user_id → ISO do último login (Supabase Auth). */
export async function authLastSignInByUserId(): Promise<Map<string, string | null>> {
  const admin = createAdminClient();
  const map = new Map<string, string | null>();

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data.users.length) break;

    for (const u of data.users) {
      map.set(u.id, u.last_sign_in_at ?? null);
    }
    if (data.users.length < 200) break;
  }

  return map;
}
