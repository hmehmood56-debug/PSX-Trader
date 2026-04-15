"use client";

import { createClient } from "@/utils/supabase/client";
import {
  getLastVisitTimestamp,
  logAnalyticsEvent,
  markVisitTimestamp,
} from "@/lib/analytics/client";
import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const emitSessionStarted = (userId: string) => {
      const key = `perch_session_started_${userId}`;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
      void logAnalyticsEvent("session_started");
    };

    const lastVisit = getLastVisitTimestamp();
    if (lastVisit) {
      const daysSinceLastVisit =
        (Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24);
      void logAnalyticsEvent("return_visit", {
        route: window.location.pathname,
        last_visit_at: lastVisit,
        days_since_last_visit: Number(daysSinceLastVisit.toFixed(2)),
      });
    }
    markVisitTimestamp();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (event === "SIGNED_IN" && nextSession?.user?.id) {
        emitSessionStarted(nextSession.user.id);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session?.user?.id) {
        emitSessionStarted(data.session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signOut,
    }),
    [session, loading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
