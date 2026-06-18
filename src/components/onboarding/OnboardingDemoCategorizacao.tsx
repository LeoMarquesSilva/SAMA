"use client";

import {
  CalendarClock,
  ClipboardList,
  EyeOff,
  Building2,
  Users,
  Save,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { clsx } from "clsx";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { OnboardingDemoKind } from "@/lib/onboarding/types";

export function OnboardingDemoCategorizacao({
  kind,
}: {
  kind: OnboardingDemoKind;
}) {
  if (kind.startsWith("reuniao-")) {
    return <DemoReuniaoForm highlight={kind.replace("reuniao-", "")} />;
  }

  if (kind.startsWith("passos-")) {
    return <DemoPassos highlight={kind.replace("passos-", "")} />;
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">Não categorizado</Badge>
          <span className="text-xs text-slate-400">Exemplo · demonstração</span>
        </div>
        <h3 className="mt-2 text-base font-semibold text-slate-800">
          Reunião de alinhamento — Cliente Exemplo
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Ontem, 14:00 · 1h · Online
        </p>
      </div>

      {kind === "evento" && (
        <div className="px-4 py-3 text-sm text-slate-600">
          <p className="flex items-center gap-2">
            <Building2 size={15} className="text-slate-400" />
            Microsoft Teams
          </p>
          <p className="mt-2 text-xs text-slate-400">
            3 envolvidos · importado do Outlook
          </p>
        </div>
      )}

      {kind === "evento-acoes" && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
          <Button size="sm" className="ring-2 ring-brand-400 ring-offset-2">
            <CalendarClock size={15} /> Reclassificação Reunião
          </Button>
          <Button size="sm" variant="secondary">
            <ClipboardList size={15} /> Reclassificação Atividade
          </Button>
          <Button size="sm" variant="ghost">
            <EyeOff size={15} /> Ignorar
          </Button>
        </div>
      )}
    </article>
  );
}

function DemoPassos({ highlight }: { highlight: string }) {
  const showChecklist = highlight === "checklist" || highlight === "ver-reuniao";
  const showButton = highlight === "ver-reuniao";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
      <header className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-800">
              Reunião com Cliente Exemplo
            </h3>
            <Badge tone="green">Reunião</Badge>
            <span className="text-xs text-slate-400">Demonstração</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            12/06/2026, 10:00 · Captação · Cliente Exemplo Ltda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">2 pend. · 1 ok</span>
          {showButton && (
            <Button
              size="sm"
              variant="secondary"
              className="ring-2 ring-brand-400 ring-offset-2"
            >
              Ver reunião
            </Button>
          )}
        </div>
      </header>

      {showChecklist && (
        <ul className="divide-y divide-slate-100">
          <li className="flex items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              readOnly
              checked={highlight === "checklist"}
              className={clsx(
                "mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600",
                highlight === "checklist" &&
                  "ring-2 ring-brand-400 ring-offset-2"
              )}
            />
            <span className="text-sm text-slate-800">
              Enviar proposta comercial revisada
              <span className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                <CheckCircle2 size={12} /> Realizada
              </span>
            </span>
          </li>
          <li className="flex items-start gap-3 px-4 py-3 opacity-80">
            <input
              type="checkbox"
              readOnly
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-800">
              Agendar follow-up com diretoria
              <span className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
                <Circle size={12} /> Pendente
              </span>
            </span>
          </li>
        </ul>
      )}

      {highlight === "grupo" && (
        <div className="px-4 py-3 text-sm text-slate-600">
          Cada reunião realizada com próximos passos registrados aparece assim,
          com todas as ações combinadas listadas abaixo do cabeçalho.
        </div>
      )}
    </section>
  );
}

function DemoReuniaoForm({ highlight }: { highlight: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Formulário de reunião
        </p>
        <h3 className="mt-1 text-base font-semibold text-slate-800">
          Reunião de alinhamento — Cliente Exemplo
        </h3>
      </div>

      <div className="space-y-3 p-4">
        <DemoField
          label="Tipo de reunião"
          value="Captação"
          active={highlight === "tipo"}
        />
        <DemoField
          label="Cliente / grupo"
          value="Grupo Exemplo Ltda."
          active={highlight === "cliente"}
        />
        <DemoField
          label="Participantes"
          value="Você, Ana Silva, João Externo"
          active={highlight === "participantes"}
          icon={<Users size={14} />}
        />
        {(highlight === "resultado" || highlight === "salvar") && (
          <DemoField
            label="Resultado e próximos passos"
            value="Alinhar proposta comercial até sexta..."
            active={highlight === "resultado"}
            multiline
          />
        )}

        {highlight === "abertura" && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
            Título, horário e participantes já vêm do Outlook.
          </p>
        )}

        {highlight === "salvar" && (
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <Button size="sm" className="ring-2 ring-brand-400 ring-offset-2">
              <Save size={15} /> Salvar reunião
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DemoField({
  label,
  value,
  active,
  icon,
  multiline,
}: {
  label: string;
  value: string;
  active: boolean;
  icon?: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border px-3 py-2.5 transition",
        active
          ? "border-brand-400 bg-brand-50/80 ring-2 ring-brand-300 ring-offset-1"
          : "border-slate-200 bg-slate-50/50 opacity-70"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={clsx(
          "mt-1 flex items-center gap-1.5 text-sm text-slate-700",
          multiline && "leading-relaxed"
        )}
      >
        {icon}
        {value}
      </p>
    </div>
  );
}
