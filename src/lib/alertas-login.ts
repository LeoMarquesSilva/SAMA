import { cookies } from "next/headers";

export const ALERTAS_LOGIN_COOKIE = "sama_alertas_login";

export async function shouldShowAlertasLoginBanner(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ALERTAS_LOGIN_COOKIE)?.value === "1";
}

export async function setAlertasLoginCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ALERTAS_LOGIN_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 8,
    sameSite: "lax",
  });
}

export async function clearAlertasLoginCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ALERTAS_LOGIN_COOKIE);
}
