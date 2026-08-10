// Endereço da API do taonde (FastAPI). O app é só cliente — toda regra vive no backend.
//
// Dois ambientes, um interruptor. Para o teste EM CAMPO tem de ser o VPS: no 4G a
// LAN de casa não existe, e o ponto do spike é ver o trajeto chegando na torre.
//
// ⚠️ LAN: 'localhost' aqui seria o PRÓPRIO celular. O backend roda no Docker do WSL,
// então o Windows precisa encaminhar a 8000 para o WSL2 (netsh portproxy — ver
// README). A IP do WSL muda a cada reinício do WSL.
//
// ⚠️ O VPS ainda é HTTP puro (sem domínio/TLS). Por isso o app.json liga
// `usesCleartextTraffic` — Android bloqueia HTTP em build de release. Remover os
// dois quando houver domínio + HTTPS.
const AMBIENTES = {
  vps: 'http://148.230.73.212:8000',
  lan: 'http://192.168.1.17:8000',
} as const;

export const AMBIENTE: keyof typeof AMBIENTES = 'vps';

export const API_BASE_URL: string = AMBIENTES[AMBIENTE];
