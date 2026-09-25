import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path) {
  const out = {};
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = loadEnv(resolve(process.cwd(), ".env.local"));
const tenant = env.MICROSOFT_TENANT_ID;
const clientId = env.MICROSOFT_CLIENT_ID || env.SHAREPOINT_CLIENT_ID;
const clientSecret = env.MICROSOFT_CLIENT_SECRET || env.SHAREPOINT_CLIENT_SECRET;
const siteId = env.SHAREPOINT_SITE_ID;
const listId = env.SHAREPOINT_LIST_ID || env.SHAREPOINT_AGENDAMENTOS_LIST_ID;

const tokenRes = await fetch(
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
  }
);
const tokenTxt = await tokenRes.text();
if (!tokenRes.ok) {
  console.log(JSON.stringify({ token: tokenTxt.slice(0, 200) }, null, 2));
  process.exit(1);
}
const token = JSON.parse(tokenTxt).access_token;

async function graph(path, headers = {}) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });
  const txt = await res.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    json = { raw: txt.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, json };
}

const report = { token: "ok" };

const cols = await graph(
  `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/columns`
);
if (cols.ok) {
  report.columnTypes = (cols.json.value ?? [])
    .filter((c) => !c.hidden)
    .map((c) => ({
      name: c.name,
      display: c.displayName,
      readOnly: Boolean(c.readOnly),
      required: Boolean(c.required),
      kind: c.dateTime
        ? "date"
        : c.choice
          ? "choice"
          : c.personOrGroup
            ? "person"
            : c.lookup
              ? "lookup"
              : c.number
                ? "number"
                : c.text
                  ? "text"
                  : c.boolean
                    ? "bool"
                    : "other",
      choices: c.choice?.choices,
      personMulti: c.personOrGroup?.allowMultipleSelection,
    }));
} else {
  report.colsError = `${cols.status}: ${JSON.stringify(cols.json).slice(0, 240)}`;
}

const items = await graph(
  `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items?$expand=fields&$top=1&$orderby=createdDateTime desc`
);
if (items.ok) {
  const fields = items.json.value?.[0]?.fields ?? {};
  report.sampleKeys = Object.keys(fields);
  report.sample = fields;
} else {
  report.sampleError = `${items.status}: ${JSON.stringify(items.json).slice(0, 240)}`;
}

report.userRooms = [];
report.userRoomsError = [];
for (const name of ["Sala", "Biblioteca", "Outback", "Reun"]) {
  const r = await graph(
    `/users?$select=displayName,mail,userPrincipalName&$filter=startsWith(displayName,'${name}')&$top=25`
  );
  if (r.ok) {
    report.userRooms.push(
      ...(r.json.value ?? []).map((u) => ({
        name: u.displayName,
        mail: u.mail,
        upn: u.userPrincipalName,
      }))
    );
  } else {
    report.userRoomsError.push(
      `${name} ${r.status}: ${JSON.stringify(r.json).slice(0, 160)}`
    );
  }
}

const search = await graph(
  `/users?$select=displayName,mail,userPrincipalName&$search="displayName:Sala"&$top=20`,
  { ConsistencyLevel: "eventual" }
);
if (search.ok) {
  report.searchSala = (search.json.value ?? []).map((u) => ({
    name: u.displayName,
    mail: u.mail,
  }));
} else {
  report.searchSalaError = `${search.status}: ${JSON.stringify(search.json).slice(0, 180)}`;
}

console.log(JSON.stringify(report, null, 2));
