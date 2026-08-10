// Dreno da fila → POST /motoristas/eu/posicao (LOTE).
//
// O servidor é idempotente por (motorista, momento): reenviar não duplica. Por
// isso a regra é "envia, só apaga depois do 2xx" — perder a resposta custa um
// reenvio, nunca um buraco no trajeto.
import { apiFetch, ApiError } from '../api/client';
import { getToken } from '../api/auth';
import * as fila from './fila';

/** Tamanho do lote por request. Volta de um dia offline drena em vários lotes. */
const LOTE = 200;
/** Teto de lotes por dreno — não prender a thread numa fila gigante de uma vez. */
const MAX_LOTES = 10;

export interface ResultadoSync {
  enviadas: number;
  gravadas: number;
  restantes: number;
  erro?: string;
}

interface PosicaoLoteOut {
  recebidas: number;
  gravadas: number;
}

// Tela e background podem drenar ao mesmo tempo; serializa dentro deste contexto.
let emAndamento: Promise<ResultadoSync> | null = null;

export function drenar(): Promise<ResultadoSync> {
  if (emAndamento) return emAndamento;
  emAndamento = _drenar().finally(() => {
    emAndamento = null;
  });
  return emAndamento;
}

async function _drenar(): Promise<ResultadoSync> {
  const token = await getToken();
  if (!token) {
    // Deslogado: a fila FICA. Não é erro de rede — é ausência de sessão.
    return registrar({ enviadas: 0, gravadas: 0, restantes: fila.tamanho(), erro: 'sem sessão' });
  }

  let enviadas = 0;
  let gravadas = 0;
  for (let i = 0; i < MAX_LOTES; i++) {
    const lote = fila.proximas(LOTE);
    if (lote.length === 0) break;
    try {
      const r = await apiFetch<PosicaoLoteOut>('/motoristas/eu/posicao', {
        method: 'POST',
        token,
        body: lote.map((p) => ({
          lat: p.lat,
          lon: p.lon,
          momento: p.momento,
          fonte: 'app_motorista',
        })),
      });
      fila.remover(lote.map((p) => p.id));
      enviadas += lote.length;
      gravadas += r.gravadas;
      fila.incrementar('lotes_enviados');
    } catch (e) {
      const erro = e instanceof ApiError ? `${e.status || 'rede'}: ${e.message}` : 'falha no envio';
      return registrar({ enviadas, gravadas, restantes: fila.tamanho(), erro });
    }
  }
  return registrar({ enviadas, gravadas, restantes: fila.tamanho() });
}

function registrar(r: ResultadoSync): ResultadoSync {
  fila.anotar('ultimo_sync', { ...r, em: new Date().toISOString() });
  return r;
}

export interface UltimoSync extends ResultadoSync {
  em: string;
}

export function ultimoSync(): UltimoSync | null {
  return fila.ler<UltimoSync>('ultimo_sync');
}
