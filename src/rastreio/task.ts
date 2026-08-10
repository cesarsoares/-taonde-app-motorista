// Rastreio em segundo plano (expo-location + expo-task-manager).
//
// ⚠️ `defineTask` TEM de rodar no escopo global do bundle (exigência do SDK): o
// Android acorda o app sem tela, executa o bundle e dispara a task. Por isso este
// módulo é importado no topo do App.tsx — não dentro de um componente.
//
// Não roda em Expo Go no Android (foreground service exige development build).
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as fila from './fila';
import { drenar } from './sync';

export const TASK_RASTREIO = 'taonde-rastreio-posicao';

/** Cadência: o que for atingido primeiro. 50 m separa parado de andando sem
 *  encher a fila no semáforo; 60 s garante sinal de vida com o caminhão parado. */
const INTERVALO_MS = 60_000;
const DISTANCIA_M = 50;

TaskManager.defineTask(TASK_RASTREIO, async ({ data, error }) => {
  if (error) {
    fila.anotar('ultimo_erro_task', { msg: error.message, em: new Date().toISOString() });
    return;
  }
  const locs = (data as { locations?: Location.LocationObject[] } | null)?.locations ?? [];
  if (locs.length === 0) return;

  for (const l of locs) {
    fila.enfileirar({
      lat: l.coords.latitude,
      lon: l.coords.longitude,
      // HORA DE CAMPO (invariante do contrato): o servidor sem ela carimba a hora
      // do sync e a timeline mente depois de um trecho sem sinal.
      momento: new Date(l.timestamp).toISOString(),
      precisao: l.coords.accuracy ?? null,
      velocidade: l.coords.speed ?? null,
    });
    fila.incrementar('fixacoes');
  }
  const ultima = locs[locs.length - 1];
  fila.anotar('ultima_fixacao', {
    lat: ultima.coords.latitude,
    lon: ultima.coords.longitude,
    precisao: ultima.coords.accuracy ?? null,
    em: new Date(ultima.timestamp).toISOString(),
    recebida_em: new Date().toISOString(),
  });

  // Melhor esforço: sem sinal, falha e a fila segura. Não relança — exceção aqui
  // derruba a task e o Android pode não reagendá-la.
  try {
    await drenar();
  } catch {
    /* já anotado em ultimo_sync */
  }
});

export interface UltimaFixacao {
  lat: number;
  lon: number;
  precisao: number | null;
  em: string;
  recebida_em: string;
}

export function ultimaFixacao(): UltimaFixacao | null {
  return fila.ler<UltimaFixacao>('ultima_fixacao');
}

export function rastreando(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(TASK_RASTREIO);
}

export class PermissaoNegada extends Error {}

/** Liga o rastreio. Duas permissões, em ordem — no Android 11+ a de segundo plano
 *  ("O tempo todo") só pode ser concedida na tela de Configurações que o sistema
 *  abre; o app não consegue pedir num diálogo. */
export async function iniciar(): Promise<void> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    throw new PermissaoNegada('Sem permissão de localização. Autorize para a torre acompanhar a rota.');
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    throw new PermissaoNegada(
      'Falta a permissão "O tempo todo". Abra Configurações → Apps → taonde → Localização e escolha "Permitir o tempo todo".',
    );
  }

  await Location.startLocationUpdatesAsync(TASK_RASTREIO, {
    accuracy: Location.Accuracy.High,
    timeInterval: INTERVALO_MS,
    distanceInterval: DISTANCIA_M,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'taonde — rastreio ligado',
      notificationBody: 'A torre acompanha sua rota durante a jornada.',
      notificationColor: '#34d399',
      // O serviço sobrevive ao app ser fechado pelo motorista (o teste do spike).
      killServiceOnDestroy: false,
    },
  });
  fila.anotar('ligado_em', new Date().toISOString());
}

export async function parar(): Promise<void> {
  if (await rastreando()) {
    await Location.stopLocationUpdatesAsync(TASK_RASTREIO);
  }
  fila.anotar('ligado_em', null);
}
