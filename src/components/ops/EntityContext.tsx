"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface OpsEntity {
  id: string;
  slug: string;
  name: string;
  colorAccent: string;
  createdAt: string;
  memberCount: number;
  myRole: string | null;
}

interface EntityContextValue {
  /** null = "All Entities" cross-entity view */
  activeEntity: OpsEntity | null;
  setActiveEntity: (entity: OpsEntity | null) => void;
  entities: OpsEntity[];
  loading: boolean;
}

const STORAGE_KEY = "ops-active-entity";
const SWITCH_EVENT = "entity-switched";

const EntityContext = createContext<EntityContextValue>({
  activeEntity: null,
  setActiveEntity: () => {},
  entities: [],
  loading: true,
});

// ── Provider ─────────────────────────────────────────────────────────────────

export function EntityProvider({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<OpsEntity[]>([]);
  const [activeEntity, setActiveEntityState] = useState<OpsEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Fetch entities from API
  useEffect(() => {
    fetch("/api/ops/entities")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: OpsEntity[]) => {
        setEntities(data);
        // Hydrate from localStorage once we have the entity list
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as OpsEntity;
            // Validate the stored entity still exists in the user's memberships
            const match = data.find((e) => e.slug === parsed.slug);
            if (match) {
              setActiveEntityState(match);
            }
          }
        } catch {
          // localStorage unavailable or invalid — stay on "All"
        }
        setHydrated(true);
        setLoading(false);
      })
      .catch(() => {
        setHydrated(true);
        setLoading(false);
      });
  }, []);

  // Set active entity + persist + dispatch custom event
  const setActiveEntity = useCallback(
    (entity: OpsEntity | null) => {
      setActiveEntityState(entity);
      try {
        if (entity) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(entity));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // localStorage unavailable
      }
      window.dispatchEvent(
        new CustomEvent(SWITCH_EVENT, { detail: entity })
      );
    },
    []
  );

  // Listen for cross-component "entity-switched" events
  useEffect(() => {
    function handleSwitch(e: Event) {
      const detail = (e as CustomEvent<OpsEntity | null>).detail;
      setActiveEntityState(detail);
    }
    window.addEventListener(SWITCH_EVENT, handleSwitch);
    return () => window.removeEventListener(SWITCH_EVENT, handleSwitch);
  }, []);

  return (
    <EntityContext.Provider
      value={{ activeEntity, setActiveEntity, entities, loading }}
    >
      {children}
    </EntityContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useEntity() {
  return useContext(EntityContext);
}
