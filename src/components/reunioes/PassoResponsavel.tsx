"use client";

import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import type { ColaboradorOpt } from "@/lib/colaboradores";
import {
  emailsEscritorioIguais,
  isEmailEscritorio,
} from "@/lib/email-escritorio";

export type PessoaCitada = {
  nome: string;
  email: string | null;
  avatar_url: string | null;
  colaborador_id: string | null;
  /** Fora do escritório (cliente, parceiro...). */
  externo?: boolean;
  /** Empresa inferida do domínio do e-mail (só externos). */
  empresa?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMINIOS_GENERICOS = new Set([
  "gmail",
  "hotmail",
  "outlook",
  "live",
  "yahoo",
  "icloud",
  "uol",
  "bol",
  "terra",
]);

function empresaDoEmail(email: string): string | null {
  const dominio = email.split("@")[1]?.toLowerCase() ?? "";
  const base = dominio.split(".")[0] ?? "";
  if (!base || DOMINIOS_GENERICOS.has(base)) return null;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

const PREFIXO_RE = /^\s*([^:\n]{2,80}?)\s*:\s+([\s\S]+)$/;

function nomeDoEmail(email: string): string {
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function normalizaNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Separa o colaborador citado no início do passo ("email@escritorio: ação" ou
 * "Nome do Colaborador: ação"). Só reconhece e-mails do escritório ou nomes da equipe.
 */
export function separarPessoaDoPasso(
  texto: string,
  colaboradores: ColaboradorOpt[]
): { pessoa: PessoaCitada | null; prefixo: string; resto: string } {
  const m = texto.match(PREFIXO_RE);
  if (!m) return { pessoa: null, prefixo: "", resto: texto };
  const alvo = m[1].trim();
  const resto = m[2];
  const prefixo = texto.slice(0, texto.length - resto.length);

  if (alvo.includes("@")) {
    const colab = colaboradores.find(
      (c) => c.email && emailsEscritorioIguais(c.email, alvo)
    );
    if (colab) {
      return {
        pessoa: {
          nome: colab.nome,
          email: colab.email,
          avatar_url: colab.avatar_url,
          colaborador_id: colab.id,
        },
        prefixo,
        resto,
      };
    }
    if (!EMAIL_RE.test(alvo)) return { pessoa: null, prefixo: "", resto: texto };
    const externo = !isEmailEscritorio(alvo);
    return {
      pessoa: {
        nome: nomeDoEmail(alvo),
        email: alvo,
        avatar_url: null,
        colaborador_id: null,
        externo,
        empresa: externo ? empresaDoEmail(alvo) : null,
      },
      prefixo,
      resto,
    };
  }

  const chave = normalizaNome(alvo);
  const colab = colaboradores.find((c) => normalizaNome(c.nome) === chave);
  if (!colab) return { pessoa: null, prefixo: "", resto: texto };
  return {
    pessoa: {
      nome: colab.nome,
      email: colab.email,
      avatar_url: colab.avatar_url,
      colaborador_id: colab.id,
    },
    prefixo,
    resto,
  };
}

/** Colaborador da equipe pelo nome exibido (ex.: responsável vindo do VIOS). */
export function colaboradorPorNome(
  nome: string | null | undefined,
  colaboradores: ColaboradorOpt[]
): ColaboradorOpt | undefined {
  if (!nome?.trim()) return undefined;
  const chave = normalizaNome(nome);
  return (
    colaboradores.find((c) => normalizaNome(c.nome) === chave) ??
    colaboradores.find((c) => {
      const n = normalizaNome(c.nome);
      return n.startsWith(chave) || chave.startsWith(n);
    })
  );
}

/** Chip com avatar + nome da pessoa citada. */
export function PessoaChip({
  pessoa,
  size = 20,
  className,
}: {
  pessoa: Pick<PessoaCitada, "nome" | "email" | "avatar_url" | "externo" | "empresa">;
  size?: number;
  className?: string;
}) {
  return (
    <span
      title={pessoa.email ?? pessoa.nome}
      className={clsx(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs font-medium",
        pessoa.externo
          ? "border-slate-200 bg-slate-50 text-slate-700"
          : "border-brand-200 bg-brand-50 text-brand-800",
        className
      )}
    >
      <Avatar
        nome={pessoa.nome}
        src={pessoa.avatar_url}
        size={size}
        className={pessoa.externo ? "!bg-slate-200 !text-slate-600" : undefined}
      />
      <span className="truncate">{pessoa.nome}</span>
      {pessoa.externo && (
        <span className="rounded-full bg-slate-200 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          {pessoa.empresa ?? "externo"}
        </span>
      )}
    </span>
  );
}

/** Linha "Responsável" discreta, para ir abaixo do texto da tarefa. */
export function ResponsavelLinha({
  pessoa,
  className,
}: {
  pessoa: PessoaCitada;
  className?: string;
}) {
  return (
    <span
      title={pessoa.email ?? pessoa.nome}
      className={clsx("inline-flex max-w-full items-center gap-2 text-xs text-slate-500", className)}
    >
      <span className="font-medium uppercase tracking-wide text-[10px] text-slate-400">
        Responsável
      </span>
      <Avatar
        nome={pessoa.nome}
        src={pessoa.avatar_url}
        size={20}
        className={pessoa.externo ? "!bg-slate-200 !text-slate-600" : undefined}
      />
      <span className="truncate font-medium text-slate-700">{pessoa.nome}</span>
      {pessoa.externo && (
        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
          Externo{pessoa.empresa ? ` · ${pessoa.empresa}` : ""}
        </span>
      )}
    </span>
  );
}

/** Texto do passo com o colaborador citado destacado por avatar. */
export function PassoTexto({
  texto,
  colaboradores,
  className,
}: {
  texto: string;
  colaboradores: ColaboradorOpt[];
  className?: string;
}) {
  const { pessoa, resto } = separarPessoaDoPasso(texto, colaboradores);
  return (
    <span className={clsx("flex flex-col gap-1.5", className)}>
      <span className="min-w-0">{resto}</span>
      {pessoa && <ResponsavelLinha pessoa={pessoa} />}
    </span>
  );
}
