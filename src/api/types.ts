// Tipos do contrato da API (taonde/docs/API-MOTORISTA.md). Só o que o app usa.

export type TipoOperacao = 'entrega' | 'coleta';

export interface Entrega {
  id: string;
  nota_fiscal: string;
  destinatario?: string | null;
  endereco?: string | null;
  lat?: number | null;
  lon?: number | null;
  status: string;
  tipo_operacao?: TipoOperacao;
  peso_kg?: number | null;
  quantidade_volumes?: number | null;
}

export interface Parada {
  ordem: number;
  previsto?: string | null;
  entrega: Entrega;
  antieconomica?: boolean;
}

export interface RotaResumo {
  id: string;
  numero?: number | null;
  finalidade?: string;
  distancia_m?: number | null;
}

// GET /motoristas/eu/rota?data= — rota=null quando não há rota no dia.
export interface RotaDoDia {
  data: string;
  motorista_id: string;
  motorista_nome: string;
  rota: RotaResumo | null;
  paradas: Parada[];
}

export interface LoginResp {
  access_token: string;
  papel?: string;
}
