"use client";

import { useSyncExternalStore } from "react";
import { actors } from "@/lib/chain/actors";
import { resetDemo, setState, useDemo } from "@/lib/demo/store";
import { resetWorld } from "@/lib/demo/world";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { roleStyle, type RoleKey } from "@/components/ui/roles";
import { useChain } from "./hooks";
import { LedgerPanel } from "./LedgerPanel";
import { Allocate } from "./steps/Allocate";
import { Calculate } from "./steps/Calculate";
import { Declare } from "./steps/Declare";
import { Evidence } from "./steps/Evidence";
import { Verify } from "./steps/Verify";

const STEPS: { title: string; who: string; role: RoleKey }[] = [
  { title: "Evidence", who: actors.operator.name, role: "mill" },
  { title: "Calculate", who: "Ingot engine", role: "engine" },
  { title: "Verify & record", who: actors.verifier.name, role: "verifier" },
  { title: "Ship", who: actors.operator.name, role: "mill" },
  { title: "Declare", who: "EU importers", role: "importer" },
];

export function DemoApp() {
  const s = useDemo();
  const chain = useChain();
  // Saved progress lives in localStorage, so the server renders step one.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const done = [
    STEPS.length && Object.values(s.runs).filter((r) => r.status === "done").length >= 7,
    Boolean(s.signed),
    Boolean(s.signed?.statementId),
    s.shipments.length > 0,
    s.shipments.some((x) => x.declaredAs),
  ];
  const go = (step: number) => {
    setState({ step });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const step = mounted ? s.step : 0;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Guided demo · Q3 2026 · fictional companies</p>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              From a Turkish mill&apos;s invoices to an <span className="text-importer">EU customs declaration</span>
            </h1>
          </div>
          <Button
            tone="ghost"
            onClick={async () => {
              resetDemo();
              await resetWorld();
            }}
          >
            <Icon name="reset" /> Start over
          </Button>
        </div>

        <nav aria-label="Steps">
          <ol className="grid grid-cols-5 gap-2">
            {STEPS.map((st, i) => {
              const active = i === step;
              const r = roleStyle[st.role];
              return (
                <li key={st.title}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={active ? "step" : undefined}
                    className={`group w-full rounded-xl border px-3 py-2.5 text-left transition ${
                      active ? `${r.soft} ${r.border} shadow-sm ring-1 ring-inset ${r.border}` : "border-line bg-card hover:bg-paper-2"
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${active ? `${r.bg} text-white` : `${r.soft} ${r.text}`}`}>
                        <Icon name={r.icon} className="h-4 w-4" />
                      </span>
                      {done[i] ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-verified text-white">
                          <Icon name="check" className="h-3 w-3" />
                        </span>
                      ) : (
                        <span className="num text-xs font-semibold text-muted">{i + 1}</span>
                      )}
                    </span>
                    <span className={`mt-2 block truncate text-sm font-semibold ${active ? r.text : ""}`}>{st.title}</span>
                    <span className="hidden truncate text-xs text-muted md:block">{st.who}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {!mounted || !chain ? (
          <p className="text-sm text-muted">Starting the EVM sandbox and deploying the registry…</p>
        ) : (
          <div>
            {step === 0 && <Evidence onNext={() => go(1)} />}
            {step === 1 && <Calculate onNext={() => go(2)} />}
            {step === 2 && <Verify onNext={() => go(3)} />}
            {step === 3 && <Allocate onNext={() => go(4)} />}
            {step === 4 && <Declare />}
          </div>
        )}
      </div>
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <LedgerPanel />
        <p className="mt-2 px-1 text-xs text-muted">
          The registry&apos;s compiled bytecode runs in this page on an EVM (ethereumjs). Nothing is mocked: every row is a transaction the
          contract accepted or refused.
        </p>
      </aside>
    </div>
  );
}
