// Param list do stack de navegação, centralizado para tipar route/navigation
// nas telas sem cada uma declarar seu próprio tipo solto.
import type { Parada } from '../api/types';

export type RootStackParamList = {
  Login: undefined;
  Rota: undefined;
  Rastreio: undefined;
  Parada: { parada: Parada };
};
