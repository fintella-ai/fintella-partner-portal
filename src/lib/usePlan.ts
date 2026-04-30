"use client";

import { useState, useEffect } from "react";

export interface PlanLimits {
  calculatorEntries: number;
  bulkUploadEntries: number;
  dossiers: number;
  pdfExports: number;
  aiChats: number;
  knowledgeSearch: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
}

export interface PlanState {
  plan: string;
  name: string;
  limits: PlanLimits;
  loading: boolean;
  isPro: boolean;
  isEnterprise: boolean;
  isFree: boolean;
}

const DEFAULT_LIMITS: PlanLimits = {
  calculatorEntries: 10,
  bulkUploadEntries: 10,
  dossiers: 1,
  pdfExports: 3,
  aiChats: 5,
  knowledgeSearch: false,
  apiAccess: false,
  whiteLabel: false,
  prioritySupport: false,
};

export function usePlan(): PlanState {
  const [state, setState] = useState<PlanState>({
    plan: "free",
    name: "Free",
    limits: DEFAULT_LIMITS,
    loading: true,
    isPro: false,
    isEnterprise: false,
    isFree: true,
  });

  useEffect(() => {
    fetch("/api/partner/plan")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setState({
            plan: data.plan,
            name: data.name,
            limits: data.limits || DEFAULT_LIMITS,
            loading: false,
            isPro: data.plan === "pro" || data.plan === "enterprise",
            isEnterprise: data.plan === "enterprise",
            isFree: data.plan === "free",
          });
        } else {
          setState((s) => ({ ...s, loading: false }));
        }
      })
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);

  return state;
}
