// Ações de status do motorista sobre uma entrega (taonde/docs/API-MOTORISTA.md §2).
// 'entregue' não entra aqui — exige comprovante (POD), fatia futura.
import { apiFetch } from './client';

export type StatusMotorista = 'em_rota' | 'falha' | 'devolvida';

export type MotivoFalha =
  | 'ausente'
  | 'endereco'
  | 'recusa'
  | 'avaria'
  | 'sem_pagamento'
  | 'dificil_acesso'
  | 'fechado'
  | 'outro';

export const MOTIVOS_FALHA: { valor: MotivoFalha; rotulo: string }[] = [
  { valor: 'ausente', rotulo: 'Cliente ausente' },
  { valor: 'endereco', rotulo: 'Endereço incorreto' },
  { valor: 'recusa', rotulo: 'Recusa da mercadoria' },
  { valor: 'avaria', rotulo: 'Mercadoria avariada' },
  { valor: 'sem_pagamento', rotulo: 'Sem pagamento (COD)' },
  { valor: 'dificil_acesso', rotulo: 'Difícil acesso' },
  { valor: 'fechado', rotulo: 'Estabelecimento fechado' },
  { valor: 'outro', rotulo: 'Outro' },
];

interface EventoLocalizado {
  observacao?: string;
  lat?: number;
  lon?: number;
  // Hora de campo — sempre mandar. Ausente, o servidor carimba a hora do
  // sync e a timeline mente num trecho sem sinal.
  ocorrido_em?: string;
}

export interface StatusMotoristaIn extends EventoLocalizado {
  status: StatusMotorista;
  motivo?: MotivoFalha;
}

export interface StatusMotoristaOut {
  entrega_id: string;
  status: string;
  registrado: boolean;
}

export function atualizarStatusEntrega(
  token: string,
  entregaId: string,
  body: StatusMotoristaIn,
): Promise<StatusMotoristaOut> {
  return apiFetch<StatusMotoristaOut>(`/entregas/${entregaId}/status`, {
    method: 'PATCH',
    body,
    token,
  });
}

export type ColetarIn = EventoLocalizado;

export interface ColetaOut {
  entrega_id: string;
  tipo: string;
  registrado: boolean;
}

export function registrarColeta(
  token: string,
  entregaId: string,
  body: ColetarIn,
): Promise<ColetaOut> {
  return apiFetch<ColetaOut>(`/entregas/${entregaId}/coletar`, {
    method: 'POST',
    body,
    token,
  });
}

// O backend não tem máquina de estados (repository.py faz UPDATE incondicional) —
// status desconhecido não pode quebrar a tela.
const ROTULOS: Record<string, { rotulo: string; cor: string }> = {
  alocada: { rotulo: 'Aguardando', cor: '#93a8a0' },
  em_rota: { rotulo: 'A caminho', cor: '#34d399' },
  falha: { rotulo: 'Falha', cor: '#f87171' },
  devolvida: { rotulo: 'Devolvida', cor: '#f5b544' },
  entregue: { rotulo: 'Entregue', cor: '#34d399' },
};

export function rotuloStatusEntrega(status: string): { rotulo: string; cor: string } {
  return ROTULOS[status] ?? { rotulo: status, cor: '#93a8a0' };
}
