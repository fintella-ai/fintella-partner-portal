"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface ServiceInfo {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  accentColor: string | null;
  iconEmoji: string | null;
}

interface ServiceContextValue {
  services: ServiceInfo[];
  activeServiceId: string | null;
  activeService: ServiceInfo | null;
  setActiveServiceId: (id: string | null) => void;
  loading: boolean;
}

const ServiceCtx = createContext<ServiceContextValue>({
  services: [],
  activeServiceId: null,
  activeService: null,
  setActiveServiceId: () => {},
  loading: true,
});

export function ServiceProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [activeServiceId, setActiveServiceIdRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        const list: ServiceInfo[] = (data.services || []).map((s: any) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          shortName: s.shortName,
          accentColor: s.accentColor,
          iconEmoji: s.iconEmoji,
        }));
        setServices(list);
        const stored = typeof window !== "undefined" ? localStorage.getItem("activeServiceId") : null;
        if (stored && list.some((s) => s.id === stored)) {
          setActiveServiceIdRaw(stored);
        } else if (list.length > 0) {
          setActiveServiceIdRaw(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setActiveServiceId = useCallback((id: string | null) => {
    setActiveServiceIdRaw(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem("activeServiceId", id);
      else localStorage.removeItem("activeServiceId");
    }
  }, []);

  const activeService = activeServiceId
    ? services.find((s) => s.id === activeServiceId) ?? null
    : null;

  return (
    <ServiceCtx.Provider value={{ services, activeServiceId, activeService, setActiveServiceId, loading }}>
      {children}
    </ServiceCtx.Provider>
  );
}

export function useService() {
  return useContext(ServiceCtx);
}
