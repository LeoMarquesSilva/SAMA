import { AjudaClient } from "@/components/ajuda/AjudaClient";
import { requireModulo } from "@/lib/auth";
import { loadManualSource } from "@/lib/ajuda/load-manual.server";
import { parseManualForApp } from "@/lib/ajuda/parse-manual";
import { FAQ_ECOA } from "@/lib/ajuda/faq-ecoa";

export const dynamic = "force-dynamic";

export default async function AjudaPage() {
  await requireModulo("ajuda");
  const content = parseManualForApp(loadManualSource());

  return (
    <AjudaClient
      intro={content.intro}
      sections={content.sections}
      toc={content.toc}
      faq={[...FAQ_ECOA, ...content.faq]}
      glossary={content.glossary}
    />
  );
}
