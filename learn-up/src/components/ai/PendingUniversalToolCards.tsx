"use client";

import { useEffect, useState } from "react";
import UniversalToolCard, { universalToolActionKey, type UniversalToolAction } from "./UniversalToolCard";
import { listPendingAiWorkflows } from "@/actions/ai-workflows";
import { approveStableToolAction, cancelStableToolAction } from "@/actions/stable-ai-agents";

interface PendingAction extends UniversalToolAction {
  workflowId?: string;
}

export default function PendingUniversalToolCards() {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [localCardVisible, setLocalCardVisible] = useState(false);

  const refresh = async () => {
    const next = await listPendingAiWorkflows();
    setActions(next as PendingAction[]);
  };

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const next = await listPendingAiWorkflows();
      if (!cancelled) setActions(next as PendingAction[]);
      if (!cancelled && typeof document !== "undefined") {
        setLocalCardVisible(Boolean(document.querySelector('[data-universal-tool-card="true"][data-pending="true"]:not([data-global-universal-card="true"])')));
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!actions.length || localCardVisible) return null;

  const confirm = async (action: PendingAction) => {
    const key = universalToolActionKey(action);
    setBusyKey(key);
    try {
      const result = await approveStableToolAction(action.tool, action.args || {}, action.workflowId);
      await refresh();
      if (result?.actions?.length) setActions(result.actions as PendingAction[]);
    } finally {
      setBusyKey(null);
    }
  };

  const cancel = async (action: PendingAction) => {
    const key = universalToolActionKey(action);
    setBusyKey(key);
    try {
      await cancelStableToolAction(action.tool, action.args || {}, action.workflowId);
      await refresh();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="fixed right-4 bottom-4 z-[120] w-[min(420px,calc(100vw-2rem))] space-y-3 pointer-events-none">
      {actions.map((action) => {
        const key = universalToolActionKey(action);
        return (
          <div key={key} className="pointer-events-auto">
            <UniversalToolCard
              action={action}
              status="pending"
              busy={busyKey === key}
              globalRecovery
              onConfirm={(selected) => void confirm(selected as PendingAction)}
              onCancel={(selected) => void cancel(selected as PendingAction)}
            />
          </div>
        );
      })}
    </div>
  );
}
