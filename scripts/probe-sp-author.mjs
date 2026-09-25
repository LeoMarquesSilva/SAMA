import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      out[t.slice(0, i).trim()] = v;
    }
  } catch {
    /* arquivo ausente */
  }
  return out;
}

const env = {
  ...loadEnv(resolve(process.cwd(), ".env")),
  ...loadEnv(resolve(process.cwd(), ".env.local")),
};
const tenant = env.MICROSOFT_TENANT_ID;
const clientId = env.MICROSOFT_CLIENT_ID || env.SHAREPOINT_CLIENT_ID;
const clientSecret = env.MICROSOFT_CLIENT_SECRET || env.SHAREPOINT_CLIENT_SECRET;
const siteId = env.SHAREPOINT_SITE_ID;
const listId = env.SHAREPOINT_LIST_ID || env.SHAREPOINT_AGENDAMENTOS_LIST_ID;
const email = "vinicius.marques@bismarchipires.com.br";

async function token(scope) {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope,
        grant_type: "client_credentials",
      }),
    }
  );
  const txt = await res.text();
  if (!res.ok) throw new Error(`token ${res.status}`);
  return JSON.parse(txt).access_token;
}

const graphToken = await token("https://graph.microsoft.com/.default");

async function g(path, init = {}) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${graphToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const txt = await res.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    json = { raw: txt.slice(0, 240) };
  }
  return { ok: res.ok, status: res.status, json };
}

const site = await g(`/sites/${encodeURIComponent(siteId)}?$select=webUrl`);
const webUrl = String(site.json.webUrl || "").replace(/\/$/, "");
const restToken = await token(`${new URL(webUrl).origin}/.default`);

async function rest(path, init = {}) {
  const res = await fetch(`${webUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${restToken}`,
      Accept: "application/json;odata=nometadata",
      "Content-Type": "application/json;odata=nometadata",
      ...(init.headers || {}),
    },
  });
  const txt = await res.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    json = { raw: txt.slice(0, 240) };
  }
  return { ok: res.ok, status: res.status, json, err: txt.slice(0, 180) };
}

const lists = await g(
  `/sites/${encodeURIComponent(siteId)}/lists?$select=id,name,list,system&$top=200`
);
const usersList = (lists.json.value ?? []).find(
  (l) => l.list?.template === "userInformation" || l.name === "users"
);
const userHit = await g(
  `/sites/${encodeURIComponent(siteId)}/lists/${usersList.id}/items?$filter=${encodeURIComponent(`fields/EMail eq '${email}'`)}&$select=id&$expand=fields&$top=3`,
  { headers: { Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly" } }
);
const uf = userHit.json.value?.[0]?.fields ?? {};
const lookupId = Number(userHit.json.value?.[0]?.id);
const loginName = String(uf.Name || `i:0#.f|membership|${email}`);

const created = await g(
  `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items`,
  {
    method: "POST",
    body: JSON.stringify({
      fields: {
        Title: "SAMA-TEST-AUTHOR-DELETE",
        PROCESSO: "TESTE-AUTHOR",
        DESCRI_x00c7__x00c3_ODOPRAZO: "PROVIDÊNCIAS",
        DATA_x002d_ENVIAR: "2026-09-21",
        Status: "Pendente",
        Tipo_x0020_do_x0020_Agendamento: "Providências",
        ENVIARLookupId: lookupId,
        MOTIVO_x0020__x002f__x0020_OBSER: "teste criado por — apagar",
      },
    }),
  }
);

if (!created.ok) {
  console.log(JSON.stringify({ createFailed: created.status }, null, 2));
  process.exit(1);
}

const itemId = created.json.id;

async function autor() {
  const createdBy = await g(
    `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items/${itemId}?$select=id,createdBy`
  );
  return createdBy.json?.createdBy?.user?.displayName ?? "(sem nome)";
}

const antes = await autor();
const upd = await rest(
  `/_api/web/lists(guid'${listId}')/items(${itemId})/validateUpdateListItem()`,
  {
    method: "POST",
    body: JSON.stringify({
      formValues: [
        { FieldName: "Author", FieldValue: `[{'Key':'${loginName}'}]` },
        { FieldName: "Editor", FieldValue: `[{'Key':'${loginName}'}]` },
      ],
      bNewDocumentUpdate: true,
    }),
  }
);
const depois = await autor();

await g(
  `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items/${itemId}`,
  { method: "DELETE" }
);

console.log(
  JSON.stringify(
    {
      pessoa: uf.Title,
      lookupId,
      itemId,
      criadoPorAntes: antes,
      restStatus: upd.status,
      restErro: upd.ok ? null : upd.err,
      hasException: (upd.json?.value ?? []).map((v) => ({
        field: v.FieldName,
        hasException: v.HasException,
        error: v.ErrorMessage,
      })),
      criadoPorDepois: depois,
      mudou: antes !== depois,
    },
    null,
    2
  )
);
