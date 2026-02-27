"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { getMe, type AuthUser } from "@/lib/api";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  loginUser: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginUser: () => {},
  logout: () => {},
});

const PUBLIC_PATHS = ["/login", "/register"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      if (!PUBLIC_PATHS.includes(pathname)) {
        router.replace("/login");
      }
      return;
    }
    getMe()
      .then((u) => {
        setUser(u);
        if (PUBLIC_PATHS.includes(pathname)) {
          router.replace("/");
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (!PUBLIC_PATHS.includes(pathname)) {
          router.replace("/login");
        }
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loginUser = (token: string, userData: AuthUser) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    router.replace("/");
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen c-bg-main flex items-center justify-center">
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
