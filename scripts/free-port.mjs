#!/usr/bin/env node
import { execSync } from "child_process";

const port = process.argv[2] ?? "3000";

try {
  const out = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();
  if (!out) process.exit(0);
  for (const pid of out.split("\n").filter(Boolean)) {
    if (pid === String(process.pid)) continue;
    try {
      execSync(`kill ${pid}`);
      console.log(`Porta ${port}: encerrado processo ${pid}`);
    } catch {
      /* ignore */
    }
  }
} catch {
  /* nenhum processo na porta */
}
