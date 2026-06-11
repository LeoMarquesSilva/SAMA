import { readFileSync, writeFileSync } from "fs";

const rows = JSON.parse(readFileSync("scripts/responsum-seed.json", "utf8"));
const esc = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);

const values = rows
  .map(
    (r) =>
      `(${esc(r.id)}::uuid, ${esc(r.name)}, ${esc(r.email)}, ${esc(r.department)}, ${esc(r.avatar_url)})`
  )
  .join(",\n  ");

const sql = `-- SAMA — seed inicial de colaboradores (Responsum)
insert into public.colaboradores (responsum_id, nome, email, departamento, avatar_url, ativo, sincronizado_em)
values
  ${values}
on conflict (responsum_id) do update set
  nome = excluded.nome,
  email = excluded.email,
  departamento = excluded.departamento,
  avatar_url = excluded.avatar_url,
  ativo = true,
  sincronizado_em = now();

update public.colaboradores c
set usuario_id = u.id
from public.usuarios u
where lower(c.email) = lower(u.email);
`;

writeFileSync("supabase/migrations/0024_seed_colaboradores.sql", sql);
console.log(`Gerado 0024_seed_colaboradores.sql (${rows.length} linhas)`);
