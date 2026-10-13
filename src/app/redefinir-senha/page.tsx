import { RedefinirSenhaForm } from "./RedefinirSenhaForm";

/**
 * Chega pelo link do e-mail de "Esqueci minha senha" (?token_hash=…&type=recovery)
 * ou, nos links antigos, já com sessão criada pelo /auth/callback.
 */
export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;
  const tokenHash = type === "recovery" && token_hash?.trim() ? token_hash.trim() : null;
  return <RedefinirSenhaForm tokenHash={tokenHash} />;
}
