/**
 * Build só para verificar se o projeto compila, sem encostar no `.next`.
 *
 * `npm run build` apaga o `.next` (prebuild → clean). Com o `next dev` de pé, isso
 * arranca a pasta debaixo do dev server e ele passa a falhar com
 * ENOENT ... .next/server/pages/_app/build-manifest.json. Aqui a saída vai para
 * `.next-check`, então dá para validar a compilação com o dev rodando.
 *
 * O `next build` reescreve o tsconfig.json para incluir `<distDir>/types` (e
 * reformata o arquivo). O original é devolvido no fim, para não sujar o git.
 */
import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const DIST = ".next-check";
const TSCONFIG = "tsconfig.json";

rmSync(DIST, { recursive: true, force: true });
const tsconfigOriginal = readFileSync(TSCONFIG, "utf8");

const filho = spawn("next", ["build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: DIST },
});

filho.on("exit", (code) => {
  writeFileSync(TSCONFIG, tsconfigOriginal);
  process.exit(code ?? 1);
});
