# taonde — app do motorista (contexto + técnico)

> **Projeto separado** do backend `taonde` e da torre de controle (web). Aqui mora
> o **app do motorista**, **nativo (React Native)**. Este documento consolida tudo
> que já foi decidido para que a construção comece sem re-derivar contexto.
>
> Fontes no repo `taonde`: `docs/referencia-fleetbase/NAVIGATOR_MOTORISTA.md`
> (referência de design), `docs/UX.md` §5.3 (régua de UX do motorista),
> `docs/PRD.md` §14.4 e §7.1 (decisões), `docs/HANDOFF.md` §5.

---

## 1. O que é

App mobile que o **motorista** usa em campo: ver a rota/entregas do dia, navegar
até cada parada, registrar entrega/falha com **comprovante (POD)** e reportar a
**posição GPS** em tempo real (inclusive em segundo plano e offline).

- **Usuário:** motorista (papel `motorista` no taonde). Em campo: celular, uma mão,
  sol, dirigindo, **muitas vezes sem sinal** (interior do RS).
- **Não é** a torre/operador (essa é **web**, projeto/área separada) nem a área do
  gerente.

## 2. Relação com o backend `taonde`

- O app é um **cliente** da **API do taonde** (FastAPI). Toda regra de negócio vive
  no backend; o app é tela + captura + sincronização.
- **Fronteira entre os projetos = o contrato de API (JSON).** Sem código
  compartilhado (backend é Python; app é TypeScript).
- **Multi-tenancy:** o **tenant vem do token JWT** (nunca do cliente). O app
  autentica e recebe um token que carrega `org` + `papel`; a RLS no Postgres
  garante o isolamento. O app **não** escolhe organização.

## 3. Decisões firmes (não reabrir sem decisão explícita)

- **Nativo (React Native)** — não PWA. Motivo: GPS em segundo plano + offline é
  frágil em PWA e maduro no nativo (PRD §14.4).
- **FleetBase Navigator = REFERÊNCIA**, não base de código. É **AGPL** — estudar
  fluxo/padrões sim, **copiar código não**. Construir do zero.
- **GPS/offline:** `react-native-background-geolocation` (rastreio em background +
  fila offline + auto-sync HTTP nativos) + `react-native-background-fetch`.
- **Offline-first:** o app funciona sem sinal (vê a rota, registra entrega) e
  sincroniza depois. Estado de sinal/sync sempre visível.
- **Tenant do token; um app só** (cai o "dois apps" PWA + cliente Traccar).

## 4. Escopo do MVP

**Dentro (fatia vertical fina):**
1. **Setup/login** — descobrir o tenant + autenticar (ver §8).
2. **Permissão de localização** — tela dedicada explicando o porquê do GPS.
3. **Dash** — resumo do dia (rota, nº de paradas).
4. **Entregas** — lista ordenada (badge de pendentes) → detalhe da parada →
   **navegar** (abre app externo) → **Entregue/Falha** → **POD**.
5. **Ajuste de pin** — corrigir coordenada no local (caso do **centroide de
   cidade**, "pin aproximado", do interior).
6. **Conta** — perfil, sair, toggle **online/offline** (liga/desliga o rastreio).

**Fora do MVP (não trazer agora):** chat, relatórios de combustível, ocorrências/
issues, gestão de frota, login social (Google/Apple/FB), storefront.

## 5. Fluxo de telas (referência: Navigator, adaptado)

```
Setup (slug/tenant) → Login (telefone/OTP ou email/senha) → Permissão GPS
        │
        ▼
  [bottom tabs]  Dash · Entregas(badge) · Conta        (toggle online/offline no topo)
                          │
                 Lista → Parada (detalhe) → Navegar (Waze/Google Maps)
                          │
                 Entregue / Falha → POD (foto + assinatura) → próxima parada
```
Régua de UX: `docs/UX.md` §5.3 (taonde) — 1 tarefa por tela, alvos grandes, offline,
POD em 1–2 toques.

## 6. Stack técnica (libs de referência, vindas do Navigator)

- **React Native** + **TypeScript**; navegação `@react-navigation` (bottom-tabs +
  native-stack).
- **GPS:** `react-native-background-geolocation` (+ `-background-fetch`).
- **Mapa:** `react-native-maps`; **turn-by-turn** delegado a app externo via
  `react-native-launch-navigator` (abre Waze/Google Maps).
- **Offline/local store:** `react-native-mmkv-storage`; **token seguro:**
  `react-native-keychain`.
- **POD:** `react-native-signature-canvas` (assinatura) + `react-native-vision-camera`/
  `react-native-image-picker` + `react-native-image-resizer` (foto).
- **Permissões:** `react-native-permissions`. **i18n:** `react-native-localize`.
- **UI:** a definir — Tamagui é opção (universal nativo+web; o Navigator usa), mas
  não obrigatório.
- **Tempo real:** começar com **polling** da API; WebSocket fica para depois.

## 7. GPS em background + offline (o núcleo)

A lib `react-native-background-geolocation` faz, nativamente: rastreio com app
fechado (`stopOnTerminate:false`, `startOnBoot:true`), `distanceFilter`, detecção
de movimento (poupa bateria), **fila offline** e **auto-sync HTTP** — ela mesma
**POSTa cada posição** para um endpoint da API (com template lat/lon/heading/speed/
timestamp/battery). Sem código custom de fila.

- Ligado/desligado pelo **toggle online/offline** do motorista.
- ⚠️ **A VALIDAR ANTES (gating):** a lib tem **componente pago para release
  Android** (freemium da Transistor). Confirmar termos/custo — é o primeiro passo.

## 8. Auth e descoberta do tenant (decisões a fechar)

- **Como o app descobre o tenant?** App nativo não tem subdomínio. Opções:
  (a) motorista digita o **slug** no primeiro acesso; (b) **QR code** gerado pelo
  gerente; (c) **deep link**. (No Navigator é a "InstanceLink".) — **decidir.**
- **Método de login:** **telefone/OTP** (amigável ao motorista, exige infra de SMS)
  **ou** email/senha (já existe no backend). — **decidir.**
- O backend hoje: `POST /auth/login` com `{ slug, email, senha }` → JWT. Para OTP,
  precisaria de endpoint novo + provedor de SMS.

## 9. Contrato com a API — JÁ EXISTE (auditado 2026-07-12)

✅ **Os endpoints estão de pé e verificados end-to-end.** Contrato completo (fonte
de verdade) em **`taonde/docs/API-MOTORISTA.md`**. Resumo:

- `POST /auth/login` — slug+email+senha → JWT. (OTP: decisão em aberto, §8.)
- `GET /motoristas/eu/rota?data=` — rota/paradas do dia (motorista do token).
- `PATCH /entregas/{id}/status` — em_rota/falha/devolvida → timeline + status.
- `POST /entregas/{id}/pod` — comprovante (multipart) → `entregue` + `foto_ref`
  em **object storage (MinIO)**.
- `POST /entregas/{id}/coletar` — sucesso da **coleta** (pickup): evento
  `coletada` sem mudar status (só em parada de coleta).
- `POST /motoristas/eu/posicao` — **lote** de posições (fila offline), idempotente
  por (motorista, `momento`). *(É `/eu/posicao`, não `/{id}/posicao` — motorista
  do token; e é lote, não uma por request.)*
- `PATCH /entregas/{id}/coordenada` — ajuste de pin.
- `GET /entregas/{id}/pod` — a torre lê o comprovante (proxy; MinIO interno).

⚠️ **Invariante do app:** enviar `ocorrido_em` (status/POD/coletar) e `momento`
(posição) com a **hora de campo** — offline, o servidor sem isso carimba a hora do
sync e a timeline mente. Detalhe em `API-MOTORISTA.md` §3.

## 10. Pendências / decisões antes de codar

1. **Validar a licença/custo** do `react-native-background-geolocation` (Android).
2. **Login do motorista:** telefone/OTP vs email/senha.
3. **Descoberta do tenant:** slug digitado / QR / deep link.
4. ~~**Contrato de API** dos endpoints do §9~~ ✅ **feito** (auditado 2026-07-12;
   ver `taonde/docs/API-MOTORISTA.md`). App só consome.
5. **Object storage** para POD (MinIO local / S3) — infra nova compartilhada.
6. **Distribuição:** contas de loja (Google Play / App Store), assinatura, ou
   distribuição interna no início.

## 10b. Custos / licenças (verificar termos atuais)

- **`react-native-background-geolocation`**: licença **paga só para Android** (release);
  **iOS é gratuito**. → a Apple **não** entra nessa licença.
- **Lojas (distribuição):** Apple Developer Program **~US$ 99/ano**; Google Play
  **US$ 25** (taxa única).
- **Mapas:** Google Maps (Android, via `react-native-maps`) pode ter **custo por uso**
  na API key em escala; Apple Maps (iOS) é gratuito.

## 10c. Plano de CUSTO ZERO (pré-financiamento)

Premissa: sem financiamento agora → trocar **dinheiro por engenharia** e adiar o
que custa. Tudo abaixo é gratuito/open-source ou self-hosted.

- **Android-first, iOS depois.** O público (motoristas de transportadoras pequenas
  no RS) é majoritariamente Android. Mirar **só Android no MVP** elimina os
  **US$ 99/ano da Apple** e metade do trabalho. iOS quando houver verba/demanda.
- **Distribuição sem loja no piloto:** instalar o **APK direto** (sideload) nos
  celulares dos motoristas do parceiro → **R$ 0**. Google Play (US$ 25, taxa única)
  só quando quiser distribuição em loja.
- **GPS em background sem a lib paga:** usar **`expo-location` + `expo-task-manager`**
  (background location, gratuito/MIT, mantido) — *ou* `@mauron85/react-native-background-geolocation`
  (grátis; verificar compat com RN atual). **A fila offline + sync em lote nós
  construímos** (MMKV/SQLite → POST em lote com retry). É o que a Transistor dava
  pronto; aqui é código nosso (não é difícil, e ganhamos controle).
- **Mapas sem Google API key:** **MapLibre** (`@maplibre/maplibre-react-native`) com
  **tiles OSM** — grátis e coerente com nosso stack (já usamos OSM no Nominatim/
  Valhalla). Navegação turn-by-turn **delegada ao Waze/Google Maps** já instalado
  (`react-native-launch-navigator`) → grátis.
- **POD / object storage:** **MinIO** self-hosted (S3-compatível, grátis).
- **Backend, roteirização e geocodificação:** já self-hosted (Valhalla, Nominatim,
  Postgres) → **R$ 0**.

**Trade-off honesto:** o caminho grátis = **mais engenharia** (fila offline própria,
config de *foreground service* que varia por fabricante Android) e **mais teste em
aparelho real** (a otimização de bateria agressiva de alguns Androids é exatamente
o que a lib paga resolvia). Aceitável agora; dá pra comprar a Transistor/EAS depois,
se provar valer.

## 11. Riscos

- **Licença do background-geolocation** (custo recorrente Android).
- **Background GPS** varia por fabricante Android (otimização de bateria agressiva);
  testar em aparelhos reais do público-alvo.
- **Sem design partner** validando UX agora (Jaeger saiu) — manter MVP fino e
  validar cedo com o parceiro entrante.

## 12. Primeiros passos sugeridos (quando iniciar)

1. **Repo próprio** (`git init` aqui) — ciclo de vida e releases separados do taonde.
2. Resolver as pendências §10.1 e §10.2 (licença + login) — são *gating*.
3. ~~Definir o **contrato de API** (§9) no backend taonde.~~ ✅ feito — o backend
   já expõe e verifica os endpoints (`taonde/docs/API-MOTORISTA.md`).
4. Bootstrap RN + navegação + tela de login + permissão de GPS + um *spike* real
   da lib de GPS num aparelho (rastreio background + offline → sincroniza).
5. Então a fatia vertical: lista de entregas → detalhe → status → POD.
