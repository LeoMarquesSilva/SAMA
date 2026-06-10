import { redirect } from "next/navigation";

export default function Home() {
  // O middleware cuida da autenticação; usuários logados caem no dashboard,
  // os demais são redirecionados para /login.
  redirect("/dashboard");
}
