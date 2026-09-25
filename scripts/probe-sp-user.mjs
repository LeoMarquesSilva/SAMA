import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

const env = loadEnv(resolve(process.cwd(), ".env.local"));
const tenant = env.MICROSOFT_TENANT_ID;
const clientId = env.MICROSOFT_CLIENT_ID || env.SHAREPOINT_CLIENT_ID;
const clientSecret = env.MICROSOFT_CLIENT_SECRET || env.SHAREPOINT_CLIENT_SECRET;
const siteId = env.SHAREPOINT_SITE_ID;
const emails = [
  "vinicius.marques@bismarchipires.com.br",
  "vinicius.marques@bpplaw.com.br",
];

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
  if (!res.ok) return { ok: false, status: res.status, body: txt.slice(0, 160) };
  return { ok: true, token: JSON.parse(txt).access_token };
}

const graph = await token("https://graph.microsoft.com/.default");
const report = { graphToken: graph.ok, users: [], site: null, rest: {}, ensure: [] };

if (!graph.ok) {
  console.log(JSON.stringify({ graph }, null, 2));
  process.exit(1);
}

async function g(path, extra = {}) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${graph.token}`, ...extra },
  });
  const txt = await res.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    json = { raw: txt.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, json };
}

for (const e of emails) {
  const r = await g(
    `/users/${encodeURIComponent(e)}?$select=id,displayName,mail,userPrincipalName`
  );
  report.users.push({
    email: e,
    status: r.status,
    name: r.json.displayName,
    mail: r.json.mail,
    upn: r.json.userPrincipalName,
  });
}

const search = await g(
  `/users?$select=displayName,mail,userPrincipalName&$filter=startsWith(displayName,'Vinicius')&$top=15`
);
report.vinicius = (search.json.value ?? []).map((u) => ({
  name: u.displayName,
  mail: u.mail,
  upn: u.userPrincipalName,
}));

const site = await g(`/sites/${encodeURIComponent(siteId)}?$select=webUrl,displayName`);
report.site = { status: site.status, webUrl: site.json.webUrl };

const webUrl = site.json.webUrl?.replace(/\/$/, "");
if (webUrl) {
  const origin = new URL(webUrl).origin;
  const rest = await token(`${origin}/.default`);
  report.rest.token = rest.ok;
  report.rest.status = rest.status;
  report.rest.err = rest.ok ? undefined : rest.body;

  if (rest.ok) {
    for (const e of emails) {
      for (const logon of [e, `i:0#.f|membership|${e}`]) {
        const res = await fetch(`${webUrl}/_api/web/ensureuser`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${rest.token}`,
            Accept: "application/json;odata=nometadata",
            "Content-Type": "application/json;odata=nometadata",
          },
          body: JSON.stringify({ logonName: logon }),
        });
        const txt = await res.text();
        report.ensure.push({
          logon,
          status: res.status,
          body: txt.slice(0, 180),
        });
      }
    }
    const su = await fetch(
      `${webUrl}/_api/web/siteusers?$select=Id,Email,UserPrincipalName,Title&$top=20`,
      {
        headers: {
          Authorization: `Bearer ${rest.token}`,
          Accept: "application/json;odata=nometadata",
        },
      }
    );
    const suTxt = await su.text();
    report.siteusers = { status: su.status, body: suTxt.slice(0, 240) };
  }
}

const lists = await g(
  `/sites/${encodeURIComponent(siteId)}/lists?$select=id,name,displayName,list,system&$top=200`
);
const usersList = (lists.json.value ?? []).find(
  (l) => l.list?.template === "userInformation" || l.name === "users"
);
report.usersList = usersList
  ? { id: usersList.id, name: usersList.name, display: usersList.displayName }
  : { err: "not found", status: lists.status };

if (usersList?.id) {
  const email = "vinicius.marques@bismarchipires.com.br";
  const filtro = `fields/EMail eq '${email}'`;
  const hit = await g(
    `/sites/${encodeURIComponent(siteId)}/lists/${usersList.id}/items?$filter=${encodeURIComponent(filtro)}&$select=id&$expand=fields&$top=5`,
    { Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly" }
  );
  report.lookup = {
    status: hit.status,
    id: hit.json.value?.[0]?.id,
    email: hit.json.value?.[0]?.fields?.EMail,
    name: hit.json.value?.[0]?.fields?.Title,
  };
}

console.log(JSON.stringify(report, null, 2));
