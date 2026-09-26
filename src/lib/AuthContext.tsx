import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { subscribeToAuth, type User } from "./auth";
import { clearAuthPromptState } from "./authPrompt";

interface AuthState {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((u) => {
      setUser(u);
      setLoading(false);
      // Once signed in, nothing left to nag about — drop all milestone
      // tracking so a future sign-out doesn't resume mid-sequence oddly.
      if (u) clearAuthPromptState();
    });
    return unsubscribe;
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
