import "server-only";

import { createSign, randomUUID, X509Certificate } from "crypto";
import { readFileSync } from "fs";

import { variantesEmailEscritorio } from "@/lib/email-escritorio";

type PessoaSp = {
  id: string;
  loginName: string;
  email: string;
};

function sharepointListId(): string {
  return (
    process.env.SHAREPOINT_LIST_ID?.trim() ||
    process.env.SHAREPOINT_AGENDAMENTOS_LIST_ID?.trim() ||
    ""
  );
}

export function sharepointConfigurado(): boolean {
  return Boolean(
    process.env.SHAREPOINT_SITE_ID?.trim() &&
      sharepointListId() &&
      (process.env.MICROSOFT_TENANT_ID || process.env.SHAREPOINT_CLIENT_ID)
  );
}

export type SharePointItemInput = {
  titulo: string;
  data: string;
  ci: string;
  cliente?: string;
  /** Texto do próximo passo → MOTIVO / OBSERVAÇÃO. */
  publicacao: string;
  descricaoPrazo?: string;
  prazo?: string | null;
  tipo?: string;
  responsavel: string;
  responsavelEmail?: string | null;
  area: string;
  departamento?: string;
  pastaTipo?: string;
  pasta?: string;
  processo?: string;
  criadoPorEmail?: string | null;
};

export type SharePointCreateResult = {
  id: string;
};

const GRAPH = "https://graph.microsoft.com/v1.0";

const AREA_CHOICES = [
  "CÍVEL",
  "INSOLVÊNCIA",
  "TRABALHISTA",
  "TRIBUTÁRIO",
  "CÍVEL | INSOLVÊNCIA",
  "COMERCIAL",
  "CONTRATOS",
  "RECUPERAÇÃO DE CRÉDITO",
  "SPECIAL SITUATIONS",
];

const DEPTO_CHOICES = [
  "CÍVEL",
  "INSOLVÊNCIA",
  "TRABALHISTA",
  "TRIBUTÁRIO",
  "OPERAÇÕES LEGAIS",
  "DISTRESSED DEALS",
  "CONTRATOS",
  "COMERCIAL",
  "RECUPERAÇÃO DE CRÉDITO",
];

const COL = {
  titulo: () => process.env.SHAREPOINT_COL_TITULO?.trim() || "Title",
  processo: () => process.env.SHAREPOINT_COL_CI?.trim() || "PROCESSO",
  descricao: () =>
    process.env.SHAREPOINT_COL_DESCRICAO?.trim() ||
    "DESCRI_x00c7__x00c3_ODOPRAZO",
  dataEnviar: () =>
    process.env.SHAREPOINT_COL_DATA_ENVIAR?.trim() || "DATA_x002d_ENVIAR",
  dataAgendamento: () =>
    process.env.SHAREPOINT_COL_DATA?.trim() || "Data_x0020_do_x0020_Agendamento",
  cliente: () => process.env.SHAREPOINT_COL_CLIENTE?.trim() || "CLIENTE",
  area: () =>
    process.env.SHAREPOINT_COL_AREA?.trim() || "_x00c1_REA_x0020__x002f__x0020_E",
  departamento: () =>
    process.env.SHAREPOINT_COL_DEPARTAMENTO?.trim() || "DEPARTAMENTO",
  publicacao: () =>
    process.env.SHAREPOINT_COL_PUBLICACAO?.trim() ||
    process.env.SHAREPOINT_COL_MOTIVO?.trim() ||
    "MOTIVO_x0020__x002f__x0020_OBSER",
  status: () => process.env.SHAREPOINT_COL_STATUS?.trim() || "Status",
  tipo: () =>
    process.env.SHAREPOINT_COL_TIPO?.trim() || "Tipo_x0020_do_x0020_Agendamento",
  enviarLookup: () =>
    process.env.SHAREPOINT_COL_ENVIAR_LOOKUP?.trim() || "ENVIARLookupId",
  autorLookup: () =>
    process.env.SHAREPOINT_COL_AUTOR_LOOKUP?.trim() || "AuthorLookupId",
  editorLookup: () =>
    process.env.SHAREPOINT_COL_EDITOR_LOOKUP?.trim() || "EditorLookupId",
};

function soData(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function mapearChoice(valor: string | undefined, choices: string[]): string | undefined {
  if (!valor?.trim()) return undefined;
  const n = normalizar(valor);
  const direto = choices.find((c) => normalizar(c) === n);
  if (direto) return direto;
  if (/REESTRUTUR|INSOLV|RECUPERACAO JUDICIAL/.test(n)) return "INSOLVÊNCIA";
  return undefined;
}

const personCache = new Map<string, PessoaSp>();

function pemDoEnv(): string | null {
  const inline = process.env.SHAREPOINT_CERT_PEM?.replace(/\\n/g, "\n").trim();
  if (inline) return inline;
  const path = process.env.SHAREPOINT_CERT_PATH?.trim();
  if (!path) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function partesPem(pem: string): { cert: string; key: string } | null {
  const cert = pem.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/
  )?.[0];
  const key = pem.match(
    /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/
  )?.[0];
  if (!cert || !key) return null;
  return { cert, key };
}

function assertionCliente(tenant: string, clientId: string, pem: string): string {
  const partes = partesPem(pem);
  if (!partes) {
    throw new Error(
      "SHAREPOINT_CERT_PEM/PATH precisa ter o certificado e a chave privada em PEM."
    );
  }
  const x5t = Buffer.from(
    new X509Certificate(partes.cert).fingerprint.replace(/:/g, ""),
    "hex"
  ).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT", x5t })
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      aud: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      iss: clientId,
      sub: clientId,
      jti: randomUUID(),
      nbf: now,
      exp: now + 9 * 60,
    })
  ).toString("base64url");
  const data = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(data);
  sign.end();
  return `${data}.${sign.sign(partes.key, "base64url")}`;
}

async function sharepointToken(): Promise<string> {
  const tenant = process.env.MICROSOFT_TENANT_ID!;
  const clientId =
    process.env.MICROSOFT_CLIENT_ID ?? process.env.SHAREPOINT_CLIENT_ID!;
  const clientSecret =
    process.env.MICROSOFT_CLIENT_SECRET ?? process.env.SHAREPOINT_CLIENT_SECRET!;

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Token SharePoint: ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function siteWebUrl(token: string, siteId: string): Promise<string> {
  const res = await fetch(
    `${GRAPH}/sites/${encodeURIComponent(siteId)}?$select=webUrl`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error("Não foi possível ler o site do SharePoint.");
  const data = (await res.json()) as { webUrl?: string };
  if (!data.webUrl) throw new Error("Site SharePoint sem webUrl.");
  return data.webUrl.replace(/\/$/, "");
}

async function tokenSharePointRest(
  webUrl: string
): Promise<{ token: string; viaCertificado: boolean }> {
  const origin = new URL(webUrl).origin;
  const tenant = process.env.MICROSOFT_TENANT_ID!;
  const clientId =
    process.env.MICROSOFT_CLIENT_ID ?? process.env.SHAREPOINT_CLIENT_ID!;
  const clientSecret =
    process.env.MICROSOFT_CLIENT_SECRET ?? process.env.SHAREPOINT_CLIENT_SECRET!;
  const pem = pemDoEnv();
  const body = new URLSearchParams({
    client_id: clientId,
    scope: `${origin}/.default`,
    grant_type: "client_credentials",
  });
  if (pem) {
    body.set(
      "client_assertion_type",
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
    );
    body.set("client_assertion", assertionCliente(tenant, clientId, pem));
  } else {
    body.set("client_secret", clientSecret);
  }
  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    }
  );
  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`Token SharePoint REST: ${txt.slice(0, 180)}`);
  }
  return {
    token: (JSON.parse(txt) as { access_token: string }).access_token,
    viaCertificado: Boolean(pem),
  };
}

function idDeUsuarioSp(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as { Id?: number; id?: number; d?: { Id?: number } };
  const id = o.Id ?? o.id ?? o.d?.Id;
  return id != null ? String(id) : null;
}

async function ensureUser(
  restToken: string,
  webUrl: string,
  logonName: string
): Promise<string | null> {
  const res = await fetch(`${webUrl}/_api/web/ensureuser`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${restToken}`,
      Accept: "application/json;odata=nometadata",
      "Content-Type": "application/json;odata=nometadata",
    },
    body: JSON.stringify({ logonName }),
    cache: "no-store",
  });
  const txt = await res.text();
  if (!res.ok) return null;
  try {
    return idDeUsuarioSp(JSON.parse(txt));
  } catch {
    return null;
  }
}

async function siteUserPorEmail(
  restToken: string,
  webUrl: string,
  email: string
): Promise<string | null> {
  const safe = email.replace(/'/g, "''");
  for (const qs of [
    `Email eq '${safe}'`,
    `UserPrincipalName eq '${safe}'`,
  ]) {
    const res = await fetch(
      `${webUrl}/_api/web/siteusers?$filter=${encodeURIComponent(qs)}&$select=Id,Email,UserPrincipalName`,
      {
        headers: {
          Authorization: `Bearer ${restToken}`,
          Accept: "application/json;odata=nometadata",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) continue;
    const data = (await res.json()) as { value?: { Id?: number }[] };
    const id = data.value?.[0]?.Id;
    if (id != null) return String(id);
  }
  return null;
}

let userInfoListIdCache: string | null = null;

function listaDeUsuariosSp(lista: {
  id?: string;
  name?: string;
  displayName?: string;
  list?: { template?: string };
}): boolean {
  if (lista.list?.template === "userInformation") return true;
  const nome = `${lista.name ?? ""} ${lista.displayName ?? ""}`.toLowerCase();
  return (
    lista.name === "users" ||
    /informa(c|ç)(o|õ)es de utilizador/.test(nome) ||
    /user information list/.test(nome)
  );
}

async function idListaUsuarios(
  graphToken: string,
  siteId: string
): Promise<string | null> {
  const fromEnv = process.env.SHAREPOINT_USERINFO_LIST_ID?.trim();
  if (fromEnv) return fromEnv;
  if (userInfoListIdCache) return userInfoListIdCache;

  // Lista oculta: Graph 404 por nome/título; só aparece com $select=system.
  let next: string | null =
    `${GRAPH}/sites/${encodeURIComponent(siteId)}/lists?$select=id,name,displayName,list,system&$top=200`;
  while (next) {
    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${graphToken}` },
      cache: "no-store",
    });
    if (!res.ok) break;
    const data = (await res.json()) as {
      value?: {
        id?: string;
        name?: string;
        displayName?: string;
        list?: { template?: string };
      }[];
      "@odata.nextLink"?: string;
    };
    const hit = (data.value ?? []).find(listaDeUsuariosSp);
    if (hit?.id) {
      userInfoListIdCache = hit.id;
      return hit.id;
    }
    next = data["@odata.nextLink"] ?? null;
  }
  return null;
}

function emailNosCamposPessoa(
  fields: Record<string, unknown> | undefined,
  emails: string[]
): boolean {
  if (!fields) return false;
  const emailsSet = new Set(emails.map((e) => e.toLowerCase()));
  const candidatos = [
    fields.EMail,
    fields.Email,
    fields.UserName,
    fields.Name,
    fields.SipAddress,
  ].map((v) => String(v ?? "").toLowerCase());
  return candidatos.some(
    (v) =>
      emailsSet.has(v) ||
      emails.some((e) => v.includes(e.toLowerCase()))
  );
}

function pessoaDeCampos(
  id: string,
  fields: Record<string, unknown> | undefined,
  fallbackEmail: string
): PessoaSp {
  const login =
    String(fields?.Name ?? "").trim() ||
    `i:0#.f|membership|${String(fields?.UserName ?? fields?.EMail ?? fallbackEmail).trim()}`;
  return {
    id: String(id),
    loginName: login,
    email: String(fields?.EMail ?? fields?.UserName ?? fallbackEmail),
  };
}

async function lookupPessoaViaGraph(
  graphToken: string,
  siteId: string,
  emails: string[]
): Promise<PessoaSp | null> {
  const listId = await idListaUsuarios(graphToken, siteId);
  if (!listId) return null;

  const headers = {
    Authorization: `Bearer ${graphToken}`,
    Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
  };

  for (const email of emails) {
    const safe = email.replace(/'/g, "''");
    const filtros = [
      `fields/EMail eq '${safe}'`,
      `fields/UserName eq '${safe}'`,
      `fields/Name eq 'i:0#.f|membership|${safe}'`,
    ];
    for (const filtro of filtros) {
      const res = await fetch(
        `${GRAPH}/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items?$filter=${encodeURIComponent(filtro)}&$select=id&$expand=fields&$top=5`,
        { headers, cache: "no-store" }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        value?: { id?: string; fields?: Record<string, unknown> }[];
      };
      const hit =
        (data.value ?? []).find(
          (row) => row.id && emailNosCamposPessoa(row.fields, emails)
        ) ?? data.value?.[0];
      if (hit?.id) return pessoaDeCampos(hit.id, hit.fields, email);
    }
  }
  return null;
}

async function lookupPessoa(
  graphToken: string,
  siteId: string,
  email: string
): Promise<PessoaSp> {
  const key = email.trim().toLowerCase();
  const cached = personCache.get(key);
  if (cached) return cached;

  const emails = new Set(variantesEmailEscritorio(email));
  for (const candidato of [...emails]) {
    const u = await fetch(
      `${GRAPH}/users/${encodeURIComponent(candidato)}?$select=mail,userPrincipalName`,
      {
        headers: { Authorization: `Bearer ${graphToken}` },
        cache: "no-store",
      }
    );
    if (!u.ok) continue;
    const data = (await u.json()) as {
      mail?: string;
      userPrincipalName?: string;
    };
    if (data.mail) emails.add(data.mail.toLowerCase());
    if (data.userPrincipalName) {
      emails.add(data.userPrincipalName.toLowerCase());
    }
  }
  const listaEmails = [...emails];
  const logons = listaEmails.flatMap((e) => [e, `i:0#.f|membership|${e}`]);

  const viaGraph = await lookupPessoaViaGraph(graphToken, siteId, listaEmails);
  if (viaGraph) {
    personCache.set(key, viaGraph);
    return viaGraph;
  }

  const webUrl = await siteWebUrl(graphToken, siteId);
  let restToken = graphToken;
  try {
    restToken = (await tokenSharePointRest(webUrl)).token;
  } catch {
    /* tenta o token Graph no REST */
  }

  for (const logon of logons) {
    const id = await ensureUser(restToken, webUrl, logon);
    if (id) {
      const pessoa = { id, loginName: logon.includes("|") ? logon : `i:0#.f|membership|${listaEmails[0]}`, email: listaEmails[0] };
      personCache.set(key, pessoa);
      return pessoa;
    }
  }
  for (const e of listaEmails) {
    const id = await siteUserPorEmail(restToken, webUrl, e);
    if (id) {
      const pessoa = {
        id,
        loginName: `i:0#.f|membership|${e}`,
        email: e,
      };
      personCache.set(key, pessoa);
      return pessoa;
    }
  }

  throw new Error(
    `Não achei o responsável ${email} na lista de usuários do site SharePoint. A conta precisa ter acessado o site ao menos uma vez.`
  );
}

async function fieldsDeItem(
  token: string,
  siteId: string,
  input: SharePointItemInput
): Promise<{ fields: Record<string, string | number>; enviar: PessoaSp }> {
  if (!input.ci?.trim()) {
    throw new Error("O envio ao VIOS exige o CI do cliente (coluna PROCESSO).");
  }
  const email = input.responsavelEmail?.trim();
  if (!email) {
    throw new Error(
      "Cada próximo passo precisa de um responsável BP com e-mail para a coluna ENVIAR."
    );
  }

  const enviar = await lookupPessoa(token, siteId, email);
  const processo =
    input.processo?.trim() || input.pasta?.trim() || input.ci;
  const fields: Record<string, string | number> = {
    [COL.titulo()]: (input.criadoPorEmail?.trim() || input.titulo).slice(0, 255),
    [COL.processo()]: processo,
    [COL.descricao()]: input.descricaoPrazo?.trim() || "",
    [COL.dataEnviar()]: soData(input.prazo || input.data),
    [COL.status()]: "Pendente",
    [COL.tipo()]: input.tipo?.trim() || "Providências",
    [COL.enviarLookup()]: Number(enviar.id),
    [COL.publicacao()]: input.publicacao.trim(),
  };

  if (input.data) fields[COL.dataAgendamento()] = soData(input.data);

  const area = mapearChoice(input.area, AREA_CHOICES);
  if (area) fields[COL.area()] = area;
  const depto = mapearChoice(input.departamento || input.area, DEPTO_CHOICES);
  if (depto) fields[COL.departamento()] = depto;

  return { fields, enviar };
}

function valorPessoaRest(loginName: string): string {
  return `[{'Key':'${loginName}'}]`;
}

function formValuesDeCampos(
  fields: Record<string, string | number>,
  enviar: PessoaSp,
  criador: PessoaSp | null
): { FieldName: string; FieldValue: string }[] {
  const skip = new Set([
    COL.enviarLookup(),
    COL.autorLookup(),
    COL.editorLookup(),
    "AuthorId",
    "EditorId",
    "Author",
    "Editor",
  ]);
  const values = Object.entries(fields)
    .filter(([name]) => !skip.has(name))
    .map(([FieldName, FieldValue]) => ({
      FieldName,
      FieldValue: String(FieldValue),
    }));
  values.push({
    FieldName: "ENVIAR",
    FieldValue: valorPessoaRest(enviar.loginName),
  });
  if (criador) {
    values.push(
      { FieldName: "Author", FieldValue: valorPessoaRest(criador.loginName) },
      { FieldName: "Editor", FieldValue: valorPessoaRest(criador.loginName) }
    );
  }
  return values;
}

async function pastaDaLista(
  restToken: string,
  webUrl: string,
  listId: string
): Promise<string> {
  const res = await fetch(
    `${webUrl}/_api/web/lists(guid'${listId}')/RootFolder?$select=ServerRelativeUrl`,
    {
      headers: {
        Authorization: `Bearer ${restToken}`,
        Accept: "application/json;odata=nometadata",
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Pasta da lista SharePoint: ${res.status}`);
  }
  const data = (await res.json()) as { ServerRelativeUrl?: string };
  if (!data.ServerRelativeUrl) throw new Error("Lista SharePoint sem pasta.");
  return data.ServerRelativeUrl;
}

function itemIdDoValidate(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const value = (
    json as {
      value?: {
        ItemId?: number;
        HasException?: boolean;
        ErrorMessage?: string;
        FieldName?: string;
      }[];
    }
  ).value;
  if (!value?.length) return null;
  const erro = value.find(
    (v) =>
      v.HasException &&
      v.FieldName !== "Author" &&
      v.FieldName !== "Editor"
  );
  if (erro) {
    throw new Error(
      `SharePoint ${erro.FieldName}: ${erro.ErrorMessage || "HasException"}`
    );
  }
  const id = value.find((v) => v.ItemId != null)?.ItemId;
  return id != null ? String(id) : null;
}

async function criarItemViaRest(opts: {
  restToken: string;
  webUrl: string;
  listId: string;
  fields: Record<string, string | number>;
  enviar: PessoaSp;
  criador: PessoaSp | null;
}): Promise<string> {
  const folder = await pastaDaLista(opts.restToken, opts.webUrl, opts.listId);
  const origin = new URL(opts.webUrl).origin;
  const res = await fetch(
    `${opts.webUrl}/_api/web/lists(guid'${opts.listId}')/AddValidateUpdateItemUsingPath`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.restToken}`,
        Accept: "application/json;odata=nometadata",
        "Content-Type": "application/json;odata=nometadata",
      },
      body: JSON.stringify({
        listItemCreateInfo: {
          FolderPath: { DecodedUrl: `${origin}${folder}` },
          UnderlyingObjectType: 0,
        },
        formValues: formValuesDeCampos(opts.fields, opts.enviar, opts.criador),
        bNewDocumentUpdate: false,
      }),
      cache: "no-store",
    }
  );
  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`SharePoint REST ${res.status}: ${txt.slice(0, 240)}`);
  }
  const id = itemIdDoValidate(JSON.parse(txt));
  if (!id) throw new Error("SharePoint REST não devolveu o ID do item.");
  return id;
}

/**
 * Cria item na lista SOLICITAÇÃO DE AGENDAMENTOS E REAGENDAMENTOS (F4).
 * Um item = um próximo passo.
 */
export async function criarItemSolicitacaoAgendamento(
  input: SharePointItemInput
): Promise<SharePointCreateResult> {
  const siteId = process.env.SHAREPOINT_SITE_ID!.trim();
  const listId = sharepointListId();
  const token = await sharepointToken();
  const { fields, enviar } = await fieldsDeItem(token, siteId, input);
  const criadorEmail = input.criadoPorEmail?.trim();
  const criador = criadorEmail
    ? await lookupPessoa(token, siteId, criadorEmail)
    : null;

  const webUrl = await siteWebUrl(token, siteId);
  try {
    const rest = await tokenSharePointRest(webUrl);
    if (rest.viaCertificado) {
      const id = await criarItemViaRest({
        restToken: rest.token,
        webUrl,
        listId,
        fields,
        enviar,
        criador,
      });
      return { id };
    }
  } catch (err) {
    console.error(
      "[sharepoint] REST Criado por falhou, caindo no Graph:",
      err instanceof Error ? err.message : err
    );
  }

  const url = `${GRAPH}/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SharePoint ${res.status}: ${txt.slice(0, 280)}`);
  }

  const data = (await res.json()) as { id: string };
  if (criador) {
    console.warn(
      "[sharepoint] Criado por ficou como aplicação: o REST do SharePoint recusa client-secret. Configure SHAREPOINT_CERT_PATH (certificado no Legis-app)."
    );
  }
  return { id: String(data.id) };
}

export async function criarItensSolicitacaoAgendamento(
  itens: SharePointItemInput[]
): Promise<SharePointCreateResult[]> {
  const out: SharePointCreateResult[] = [];
  for (const item of itens) {
    out.push(await criarItemSolicitacaoAgendamento(item));
  }
  return out;
}
