// Estado de sessão: token + entrar/sair. Um provider simples (sem lib de estado
// no MVP). A UI decide Login vs Rota pela presença do token.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, login as apiLogin, logout as apiLogout } from './api/auth';

interface SessionCtx {
  token: string | null;
  carregando: boolean;
  entrar: (slug: string, email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | undefined>(undefined);

export function useSession(): SessionCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession fora do SessionProvider');
  return c;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    getToken()
      .then(setToken)
      .finally(() => setCarregando(false));
  }, []);

  const entrar = async (slug: string, email: string, senha: string) => {
    setToken(await apiLogin(slug, email, senha));
  };
  const sair = async () => {
    await apiLogout();
    setToken(null);
  };

  return <Ctx.Provider value={{ token, carregando, entrar, sair }}>{children}</Ctx.Provider>;
}
