import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALERTAS_LOGIN_COOKIE } from "@/lib/alertas-login";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
  response.cookies.delete(ALERTAS_LOGIN_COOKIE);
  return response;
}
