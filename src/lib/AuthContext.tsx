import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "./auth";
import { clearAuthPromptState } from "./authPrompt";
import { afterFirstPaint } from "./afterFirstPaint";
import { refreshDataIfSafe } from "./dataVersion";

interface AuthState {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Which uid we've already reconciled this page load. Firebase restores a
    // saved session on refresh (also firing this callback), and in that case
    // local data is already the account's, so only a genuinely fresh sign-in
    // (no reconcile recorded for this tab session) pulls from the cloud.
    let reconciledUid: string | null = null;
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    let pushOnBackground: (() => Promise<void>) | null = null;

    // Deferred so the auth iframe handshake doesn't compete with the
    // initial paint on first load — see afterFirstPaint.ts. Firebase itself is
    // loaded here too (dynamic import), so it is not part of the entry bundle.
    const cancel = afterFirstPaint(() => {
      void Promise.all([import("./auth"), import("./syncEngine")])
        .then(([authMod, sync]) => {
          if (disposed) return;
          pushOnBackground = sync.pushOnBackground;
          unsubscribe = authMod.subscribeToAuth((u) => {
            setUser(u);
            setLoading(false);
            // Once signed in, nothing left to nag about — drop all milestone
            // tracking so a future sign-out doesn't resume mid-sequence oddly.
            if (u) clearAuthPromptState();

            if (!u) {
              reconciledUid = null;
              return;
            }
            if (reconciledUid === u.uid) return;
            reconciledUid = u.uid;

            const key = `medicetamol:reconciled:${u.uid}`;
            if (localStorage.getItem(key)) {
              // Returning session on this device: pick up what other devices did,
              // then push our own queued changes (if the 15-minute gate allows).
              void sync.pullAndPush(u.uid).then((changed) => {
                if (changed) refreshDataIfSafe();
              });
            } else {
              void sync.reconcileOnSignIn(u.uid).then((replaced) => {
                localStorage.setItem(key, "1");
                // Pages that already read IndexedDB on mount would show stale data.
                if (replaced) refreshDataIfSafe();
              });
            }
          });
        })
        .catch(() => {
          // Couldn't load the sign-in code (offline?). The app works signed-out.
          setLoading(false);
        });
    });

    // Closest thing the web has to "app closed": the page going to the
    // background (tab switch, app switch, screen lock). Gated to once per 15
    // minutes and only when something changed, so this is cheap.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void pushOnBackground?.();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      cancel();
      unsubscribe?.();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
