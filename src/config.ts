// Endereço da API do taonde (FastAPI). O app é só cliente — toda regra vive no backend.
//
// ATENÇÃO (Expo Go no celular): 'localhost' aqui seria o PRÓPRIO celular. Use a IP
// da máquina na LAN. Detectamos a sua: 192.168.1.17. Se mudar de rede, ajuste aqui.
//
// O backend roda no Docker do WSL (porta 8000). Para o CELULAR (na LAN) alcançar,
// o Windows precisa encaminhar a porta 8000 para o WSL2 — ver README/notas de setup.
export const API_BASE_URL = 'http://192.168.1.17:8000';
