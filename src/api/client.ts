// Cliente HTTP mínimo da API do taonde. Bearer + JSON + erro amigável.
import { API_BASE_URL } from '../config';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Opts {
  method?: string;
  body?: unknown;
  token?: string | null;
}

export async function apiFetch<T>(path: string, opts: Opts = {}): Promise<T> {
  const { method = 'GET', body, token } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let resp: Response;
  try {
    resp = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // rede/DNS/servidor fora — o app é offline-first, mas aqui é uma ação online.
    throw new ApiError(0, 'Sem conexão com o servidor. Confira a rede e o endereço da API.');
  }

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail = (json as { detail?: string }).detail;
    throw new ApiError(resp.status, detail || `Erro ${resp.status}`);
  }
  return json as T;
}
