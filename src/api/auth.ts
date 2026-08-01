// Autenticação + rota do dia. O token JWT (tenant no token) guarda no keychain
// seguro do aparelho (expo-secure-store).
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from './client';
import { LoginResp, RotaDoDia } from './types';

const TOKEN_KEY = 'taonde_motorista_token';

export async function login(slug: string, email: string, senha: string): Promise<string> {
  const r = await apiFetch<LoginResp>('/auth/login', {
    method: 'POST',
    body: { slug: slug.trim().toLowerCase(), email: email.trim(), senha },
  });
  await SecureStore.setItemAsync(TOKEN_KEY, r.access_token);
  return r.access_token;
}

export function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// GET /motoristas/eu/rota — o motorista vem do token.
export function getRotaDoDia(token: string): Promise<RotaDoDia> {
  return apiFetch<RotaDoDia>('/motoristas/eu/rota', { token });
}
