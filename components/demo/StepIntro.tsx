import type { ReactNode } from "react";
import { More, RoleChip } from "@/components/ui/Kit";
import type { RoleKey } from "@/components/ui/roles";

/** The top of each step: who acts, one sentence, and the long story folded away. */
export function StepIntro({ role, who, lead, more, action }: { role: RoleKey; who: string; lead: ReactNode; more?: ReactNode; action?: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <RoleChip role={role}>{who}</RoleChip>
          <p className="max-w-2xl text-[15px] font-medium text-ink">{lead}</p>
        </div>
        {action}
      </div>
      {more && <More>{more}</More>}
    </div>
  );
}
