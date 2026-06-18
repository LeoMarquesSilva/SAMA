import "server-only";

import fs from "fs";
import path from "path";

export function loadManualSource(): string {
  const filePath = path.join(process.cwd(), "docs/manual-socio.md");
  return fs.readFileSync(filePath, "utf8");
}
