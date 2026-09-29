"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, ApiError } from "./api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenantSlug?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthCtx extends AuthState {
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  tenantName: string;
  tenantSlug: string;
  email: string;
  password: string;
  name: string;
}

interface AuthResponse {
  data: {
    accessToken: string;
    user: User;
  };
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem("csaas_token");
    const user = localStorage.getItem("csaas_user");
    if (saved && user) {
      setState({ token: saved, user: JSON.parse(user), loading: false });
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string, tenantSlug: string) => {
    const res = await api.post<AuthResponse>("/api/v1/auth/login", { email, password, tenantSlug });
    const { accessToken, user } = res.data;
    const enriched = { ...user, tenantSlug };
    localStorage.setItem("csaas_token", accessToken);
    localStorage.setItem("csaas_user", JSON.stringify(enriched));
    setState({ token: accessToken, user: enriched, loading: false });
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await api.post<AuthResponse>("/api/v1/auth/register", data);
    const { accessToken, user } = res.data;
    const enriched = { ...user, tenantSlug: data.tenantSlug };
    localStorage.setItem("csaas_token", accessToken);
    localStorage.setItem("csaas_user", JSON.stringify(enriched));
    setState({ token: accessToken, user: enriched, loading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("csaas_token");
    localStorage.removeItem("csaas_user");
    setState({ token: null, user: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
