"use client";

import { useSyncExternalStore } from "react";
import type { Hex } from "viem";
import type { Extraction } from "@/lib/ai/schema";
import type { Role } from "@/lib/chain/actors";
import { deserialize, serialize } from "@/lib/json";

/** What the person has done in the guided demo, kept across reloads. */

export interface DocRun {
  status: "idle" | "reading" | "done" | "error";
  source?: "ai" | "reference";
  extraction?: Extraction;
  error?: string;
  ms?: number;
  sha256?: Hex;
}

export interface Upload {
  id: string;
  name: string;
  run: DocRun;
}

export interface Shipment {
  allocationId: Hex;
  recipient: Role;
  tonnes: number;
  mrn: string;
  declaredAs?: string;
}

export interface SignedStatement {
  attestation: Record<string, unknown>;
  signature: Hex;
  reportSeed: Hex;
  statementId?: Hex;
}

export interface DemoState {
  step: number;
  runs: Record<string, DocRun>;
  uploads: Upload[];
  /** Lines the verifier removed by hand, with the reason. */
  removed: Record<string, string>;
  signed?: SignedStatement;
  shipments: Shipment[];
}

const KEY = "ingot.demo.v1";
const initial: DemoState = { step: 0, runs: {}, uploads: [], removed: {}, shipments: [] };

let state: DemoState = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...(deserialize(raw) as DemoState) };
    // A document that was mid-read when the page closed is read again.
    for (const run of Object.values(state.runs)) if (run.status === "reading") run.status = "idle";
  } catch {
    state = initial;
  }
}

export function getState(): DemoState {
  load();
  return state;
}

export function setState(update: Partial<DemoState> | ((s: DemoState) => Partial<DemoState>)) {
  load();
  const patch = typeof update === "function" ? update(state) : update;
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, serialize(state));
  } catch {
    // In-memory only.
  }
  listeners.forEach((l) => l());
}

export function setRun(id: string, run: Partial<DocRun>) {
  setState((s) => ({ runs: { ...s.runs, [id]: { ...(s.runs[id] ?? { status: "idle" }), ...run } } }));
}

export function resetDemo() {
  state = initial;
  try {
    localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDemo(): DemoState {
  return useSyncExternalStore(subscribe, getState, () => initial);
}
