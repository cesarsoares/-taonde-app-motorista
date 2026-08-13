// Posição pontual (não a task de background) — para anexar lat/lon a uma
// ação de status feita no momento (Navegar, Falha, Coletado).
import * as Location from 'expo-location';

export interface Coordenada {
  lat: number;
  lon: number;
}

/** Best-effort: sem permissão, sem fixação a tempo ou qualquer erro → null.
 *  Quem chama decide se manda o evento sem lat/lon (o schema aceita ambos
 *  opcionais) — não vale travar um formulário de campo esperando o GPS. */
export async function posicaoPontual(timeoutMs = 6000): Promise<Coordenada | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;

    const posicao = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!posicao) return null;
    return { lat: posicao.coords.latitude, lon: posicao.coords.longitude };
  } catch {
    return null;
  }
}
