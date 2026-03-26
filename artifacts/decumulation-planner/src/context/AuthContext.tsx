import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export interface InvestorProfile {
  id: number;
  name: string;
  email: string | null;
  accessCode: string;
  createdAt: string;
}

interface AuthContextValue {
  investor: InvestorProfile | null;
  isLoading: boolean;
  error: string | null;
  login: (accessCode: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = 'unlock-access-code';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [investor, setInvestor] = useState<InvestorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (code: string): Promise<InvestorProfile | null> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_code: code }),
      });
      if (!res.ok) return null;
      return (await res.json()) as InvestorProfile;
    } catch {
      return null;
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) {
      setIsLoading(false);
      return;
    }
    fetchProfile(saved).then((profile) => {
      if (profile) {
        setInvestor(profile);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
      setIsLoading(false);
    });
  }, [fetchProfile]);

  const login = useCallback(async (accessCode: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    const profile = await fetchProfile(accessCode);
    if (profile) {
      setInvestor(profile);
      sessionStorage.setItem(SESSION_KEY, profile.accessCode);
      setIsLoading(false);
      return true;
    }
    setError('Invalid access code. Please check and try again.');
    setIsLoading(false);
    return false;
  }, [fetchProfile]);

  const logout = useCallback(() => {
    setInvestor(null);
    setError(null);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ investor, isLoading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
