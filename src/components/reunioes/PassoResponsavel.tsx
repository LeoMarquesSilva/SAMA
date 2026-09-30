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
const SUFIXO_RE = /^([\s\S]+?)\s+\(([^()]*)\)\s*$/;
const PARTICULA = new Set(["de", "da", "do", "dos", "das", "e", "di", "du", "del"]);
const PALAVRA_GENERICA = new Set([
  "online",
  "presencial",
  "processo",
  "urgente",
  "interno",
  "externo",
  "ok",
  "sim",
  "nao",
  "não",
  "email",
  "ata",
  "pauta",
  "vios",
  "fellow",
  "cliente",
  "equipe",
]);

export type MarcadorResponsavel =
  | { tipo: "prefixo"; bruto: string }
  | { tipo: "sufixo"; bruto: string };

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

function pessoaDoColaborador(colab: ColaboradorOpt): PessoaCitada {
  return {
    nome: colab.nome,
    email: colab.email,
    avatar_url: colab.avatar_url,
    colaborador_id: colab.id,
  };
}

function formatarNomeSolto(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((p, i) => {
      if (i > 0 && PARTICULA.has(p.toLowerCase())) return p.toLowerCase();
      if (p === p.toLowerCase()) return p.charAt(0).toUpperCase() + p.slice(1);
      return p;
    })
    .join(" ");
}

/** Nome que o Fellow deixou solto, sem cadastro correspondente. */
function pareceNomeLivre(s: string, modo: "prefixo" | "sufixo"): boolean {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts.length > 6) return false;
  const tokenOk = (p: string, i: number) => {
    if (PARTICULA.has(p.toLowerCase()) && parts.length > 1 && i > 0) return true;
    return /^[\p{L}][\p{L}.'’-]*$/u.test(p) && p.length >= 2;
  };
  if (!parts.every(tokenOk)) return false;
  if (parts.length === 1) {
    const w = parts[0].toLowerCase();
    if (w.length < 3 || PALAVRA_GENERICA.has(w)) return false;
    if (modo === "sufixo") return /^[\p{Lu}]/u.test(parts[0]);
    return true;
  }
  return /^[\p{Lu}]/u.test(parts[0]);
}

function pessoaDeAlvo(
  alvo: string,
  colaboradores: ColaboradorOpt[],
  modo: "prefixo" | "sufixo"
): PessoaCitada | null {
  const limpo = alvo.trim();
  if (!limpo) return null;

  if (limpo.includes("@")) {
    if (!EMAIL_RE.test(limpo)) return null;
    const colab = colaboradores.find(
      (c) => c.email && emailsEscritorioIguais(c.email, limpo)
    );
    if (colab) return pessoaDoColaborador(colab);
    const externo = !isEmailEscritorio(limpo);
    return {
      nome: nomeDoEmail(limpo),
      email: limpo,
      avatar_url: null,
      colaborador_id: null,
      externo,
      empresa: externo ? empresaDoEmail(limpo) : null,
    };
  }

  const colab = colaboradorPorNome(limpo, colaboradores);
  if (colab) return pessoaDoColaborador(colab);
  if (!pareceNomeLivre(limpo, modo)) return null;
  return {
    nome: formatarNomeSolto(limpo),
    email: null,
    avatar_url: null,
    colaborador_id: null,
  };
}

/**
 * Tira do texto quem o Fellow marcou como responsável.
 * Prefixo: "email@dominio: ação" ou "Nome: ação".
 * Sufixo: "ação (Nome Completo)" ou "ação (Nome 1, Nome 2)".
 */
export function separarPessoaDoPasso(
  texto: string,
  colaboradores: ColaboradorOpt[]
): {
  pessoa: PessoaCitada | null;
  pessoas: PessoaCitada[];
  prefixo: string;
  resto: string;
  marcador: MarcadorResponsavel | null;
} {
  const vazio = {
    pessoa: null,
    pessoas: [] as PessoaCitada[],
    prefixo: "",
    resto: texto,
    marcador: null,
  };

  const prefixo = texto.match(PREFIXO_RE);
  if (prefixo) {
    const alvo = prefixo[1].trim();
    const pessoa = pessoaDeAlvo(alvo, colaboradores, "prefixo");
    if (pessoa) {
      return {
        pessoa,
        pessoas: [pessoa],
        prefixo: `${alvo}: `,
        resto: prefixo[2],
        marcador: { tipo: "prefixo", bruto: alvo },
      };
    }
  }

  const sufixo = texto.match(SUFIXO_RE);
  if (sufixo) {
    const partes = sufixo[2]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (partes.length > 0 && partes.length <= 8) {
      const pessoas = partes.map((p) => pessoaDeAlvo(p, colaboradores, "sufixo"));
      if (pessoas.every((p): p is PessoaCitada => p !== null)) {
        return {
          pessoa: pessoas[0] ?? null,
          pessoas,
          prefixo: "",
          resto: sufixo[1].trim(),
          marcador: { tipo: "sufixo", bruto: sufixo[2].trim() },
        };
      }
    }
  }

  return vazio;
}

/** Devolve o marcador do Fellow ao texto editado, para não perder o responsável. */
export function recomporPassoComMarcador(
  resto: string,
  marcador: MarcadorResponsavel | null
): string {
  const acao = resto.trim();
  if (!marcador) return acao;
  if (marcador.tipo === "prefixo") {
    return acao ? `${marcador.bruto}: ${acao}` : `${marcador.bruto}:`;
  }
  return acao ? `${acao} (${marcador.bruto})` : `(${marcador.bruto})`;
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

function PessoaSugerida({ pessoa }: { pessoa: PessoaCitada }) {
  return (
    <span
      title={pessoa.email ?? pessoa.nome}
      className="inline-flex max-w-full items-center gap-1.5"
    >
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

/** Quem o Fellow indicou no action item: foto e nome, ou o e-mail quando não há nome. */
export function ResponsaveisSugeridos({
  pessoas,
  className,
}: {
  pessoas: PessoaCitada[];
  className?: string;
}) {
  if (!pessoas.length) return null;
  return (
    <span
      className={clsx(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500",
        className
      )}
    >
      <span className="font-medium text-[11px] text-slate-500">
        Responsável sugerido pelo Fellow
      </span>
      {pessoas.map((pessoa) => (
        <PessoaSugerida
          key={`${pessoa.colaborador_id ?? ""}|${pessoa.email ?? ""}|${pessoa.nome}`}
          pessoa={pessoa}
        />
      ))}
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
  return <ResponsaveisSugeridos pessoas={[pessoa]} className={className} />;
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
