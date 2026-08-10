// Fila offline de posições — DURÁVEL (SQLite), não em memória.
//
// Por quê SQLite: a task de background do expo-location roda num contexto JS
// efêmero, que o Android sobe e derruba a cada lote de fixações. Estado de módulo
// não sobrevive entre invocações (nem é o mesmo contexto da tela). Só o disco
// atravessa. Esta mesma fila serve depois para status/POD offline.
import * as SQLite from 'expo-sqlite';

export interface PosicaoEnfileirada {
  id: number;
  lat: number;
  lon: number;
  momento: string; // ISO-8601 em UTC — a HORA DE CAMPO, não a do sync.
  precisao: number | null;
  velocidade: number | null;
}

/** Teto da fila: ~4 dias a uma fixação/min. Acima disso, descarta as MAIS ANTIGAS
 *  (a posição recente vale mais para a torre do que a de anteontem). */
const LIMITE = 6000;

let _db: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (_db === null) {
    _db = SQLite.openDatabaseSync('taonde_rastreio.db');
    _db.execSync(`
      CREATE TABLE IF NOT EXISTS posicoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        momento TEXT NOT NULL UNIQUE,
        precisao REAL,
        velocidade REAL
      );
      CREATE TABLE IF NOT EXISTS diagnostico (
        chave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      );
    `);
  }
  return _db;
}

/** Enfileira uma fixação. `momento` é UNIQUE: o mesmo instante não entra duas
 *  vezes — espelha localmente a idempotência por (motorista, momento) do servidor. */
export function enfileirar(p: Omit<PosicaoEnfileirada, 'id'>): void {
  const d = db();
  d.runSync(
    'INSERT OR IGNORE INTO posicoes (lat, lon, momento, precisao, velocidade) VALUES (?, ?, ?, ?, ?)',
    [p.lat, p.lon, p.momento, p.precisao, p.velocidade],
  );
  d.runSync(
    'DELETE FROM posicoes WHERE id NOT IN (SELECT id FROM posicoes ORDER BY id DESC LIMIT ?)',
    [LIMITE],
  );
}

/** As mais antigas primeiro — a torre reconstrói o trajeto na ordem. */
export function proximas(limite: number): PosicaoEnfileirada[] {
  return db().getAllSync<PosicaoEnfileirada>(
    'SELECT id, lat, lon, momento, precisao, velocidade FROM posicoes ORDER BY id LIMIT ?',
    [limite],
  );
}

/** Só depois do 2xx. Antes disso a posição fica na fila (reenvio não duplica). */
export function remover(ids: number[]): void {
  if (ids.length === 0) return;
  db().runSync(`DELETE FROM posicoes WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

export function tamanho(): number {
  const r = db().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM posicoes');
  return r?.n ?? 0;
}

export function limpar(): void {
  db().runSync('DELETE FROM posicoes');
}

// ── Diagnóstico ────────────────────────────────────────────────────────────
// O painel da tela precisa enxergar o que aconteceu NO BACKGROUND — outro
// contexto JS. Passa pelo disco também.

export function anotar(chave: string, valor: unknown): void {
  db().runSync('INSERT OR REPLACE INTO diagnostico (chave, valor) VALUES (?, ?)', [
    chave,
    JSON.stringify(valor),
  ]);
}

export function ler<T>(chave: string): T | null {
  const r = db().getFirstSync<{ valor: string }>('SELECT valor FROM diagnostico WHERE chave = ?', [
    chave,
  ]);
  if (!r) return null;
  try {
    return JSON.parse(r.valor) as T;
  } catch {
    return null;
  }
}

/** Contador acumulado (fixações recebidas, lotes enviados…). */
export function incrementar(chave: string): void {
  anotar(chave, (ler<number>(chave) ?? 0) + 1);
}
