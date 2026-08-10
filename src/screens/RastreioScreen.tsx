// Tela de rastreio: o toggle do motorista + o PAINEL DE DIAGNÓSTICO do spike.
//
// O painel existe porque o teste é em campo, longe do Metro: sem ele, "o GPS
// parou" não distingue serviço morto, permissão revogada, fila cheia ou API fora.
// Quando o spike fechar, o painel vira uma linha discreta ("N pendentes").
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as fila from '../rastreio/fila';
import { drenar, ultimoSync, UltimoSync } from '../rastreio/sync';
import { iniciar, parar, rastreando, ultimaFixacao, UltimaFixacao, PermissaoNegada } from '../rastreio/task';

interface Painel {
  ligado: boolean;
  pendentes: number;
  fixacoes: number;
  lotes: number;
  ultima: UltimaFixacao | null;
  sync: UltimoSync | null;
  erroTask: { msg: string; em: string } | null;
}

function lerPainel(ligado: boolean): Painel {
  return {
    ligado,
    pendentes: fila.tamanho(),
    fixacoes: fila.ler<number>('fixacoes') ?? 0,
    lotes: fila.ler<number>('lotes_enviados') ?? 0,
    ultima: ultimaFixacao(),
    sync: ultimoSync(),
    erroTask: fila.ler<{ msg: string; em: string }>('ultimo_erro_task'),
  };
}

export default function RastreioScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const [p, setP] = useState<Painel | null>(null);
  const [mexendo, setMexendo] = useState(false);

  const atualizar = useCallback(async () => {
    setP(lerPainel(await rastreando()));
  }, []);

  useEffect(() => {
    atualizar();
    const t = setInterval(atualizar, 3000); // a task escreve no disco; a tela relê
    return () => clearInterval(t);
  }, [atualizar]);

  const alternar = async (ligar: boolean) => {
    setMexendo(true);
    try {
      if (ligar) await iniciar();
      else await parar();
    } catch (e) {
      Alert.alert(
        'Rastreio não ligou',
        e instanceof PermissaoNegada ? e.message : 'Falha ao iniciar o rastreio.',
      );
    } finally {
      setMexendo(false);
      atualizar();
    }
  };

  const enviarAgora = async () => {
    setMexendo(true);
    const r = await drenar();
    setMexendo(false);
    atualizar();
    Alert.alert(
      'Envio',
      r.erro
        ? `Não enviou (${r.erro}). ${r.restantes} posiç${r.restantes === 1 ? 'ão' : 'ões'} na fila.`
        : `${r.enviadas} enviada(s), ${r.gravadas} gravada(s). ${r.restantes} na fila.`,
    );
  };

  if (!p) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ marginTop: 48 }} color="#34d399" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.head}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={12}>
          <Text style={s.voltar}>‹ Rota</Text>
        </TouchableOpacity>
        <Text style={s.titulo}>Rastreio</Text>
        <View style={{ width: 54 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={s.card}>
          <View style={{ flex: 1 }}>
            <Text style={s.rotulo}>{p.ligado ? 'Em jornada' : 'Fora de jornada'}</Text>
            <Text style={s.ajuda}>
              {p.ligado
                ? 'A torre está acompanhando. Continua com a tela apagada.'
                : 'Ligue ao sair para a rua. Desligue no fim do dia.'}
            </Text>
          </View>
          <Switch
            value={p.ligado}
            onValueChange={alternar}
            disabled={mexendo}
            trackColor={{ true: '#34d399', false: '#3a4a44' }}
            thumbColor="#e8f2ec"
          />
        </View>

        <Text style={s.secao}>Diagnóstico</Text>
        <View style={s.painel}>
          <Linha t="Na fila (não enviadas)" v={String(p.pendentes)} destaque={p.pendentes > 0} />
          <Linha t="Fixações capturadas" v={String(p.fixacoes)} />
          <Linha t="Lotes enviados" v={String(p.lotes)} />
          <Linha
            t="Última posição"
            v={p.ultima ? `${p.ultima.lat.toFixed(5)}, ${p.ultima.lon.toFixed(5)}` : '—'}
          />
          <Linha t="Capturada em" v={hora(p.ultima?.em)} />
          <Linha t="Precisão" v={p.ultima?.precisao != null ? `${Math.round(p.ultima.precisao)} m` : '—'} />
          <Linha t="Último envio" v={hora(p.sync?.em)} />
          <Linha
            t="Resultado"
            v={p.sync ? (p.sync.erro ? `erro — ${p.sync.erro}` : `${p.sync.gravadas} gravada(s)`) : '—'}
            destaque={!!p.sync?.erro}
          />
          {p.erroTask && <Linha t="Erro do serviço" v={`${p.erroTask.msg} (${hora(p.erroTask.em)})`} destaque />}
        </View>

        <TouchableOpacity style={s.botao} onPress={enviarAgora} disabled={mexendo} activeOpacity={0.85}>
          <Text style={s.botaoTxt}>Enviar agora</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.botao, s.botaoFraco]}
          activeOpacity={0.85}
          onPress={() =>
            Alert.alert('Descartar fila?', `${p.pendentes} posição(ões) ainda não enviadas serão perdidas.`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Descartar', style: 'destructive', onPress: () => { fila.limpar(); atualizar(); } },
            ])
          }
        >
          <Text style={[s.botaoTxt, s.botaoTxtFraco]}>Descartar fila</Text>
        </TouchableOpacity>

        <Text style={s.nota}>
          Teste do spike: ligue, apague a tela e dirija ~10 min; feche o app pela lista de recentes;
          ponha em modo avião e veja a fila crescer; volte à rede e confira o envio.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Linha({ t, v, destaque }: { t: string; v: string; destaque?: boolean }) {
  return (
    <View style={s.linha}>
      <Text style={s.linhaT}>{t}</Text>
      <Text style={[s.linhaV, destaque && s.linhaVDestaque]} numberOfLines={2}>{v}</Text>
    </View>
  );
}

function hora(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a1310' },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.07)',
  },
  voltar: { fontSize: 16, color: '#93a8a0', fontWeight: '600', width: 54 },
  titulo: { fontSize: 18, fontWeight: '800', color: '#e8f2ec' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#0f1b16', borderWidth: 1, borderColor: 'rgba(255,255,255,.11)',
    borderRadius: 14, padding: 16,
  },
  rotulo: { fontSize: 17, fontWeight: '700', color: '#e8f2ec' },
  ajuda: { fontSize: 13, color: '#93a8a0', marginTop: 3 },
  secao: {
    fontSize: 12, fontWeight: '700', color: '#93a8a0', textTransform: 'uppercase',
    letterSpacing: 0.8, marginTop: 24, marginBottom: 8, marginLeft: 4,
  },
  painel: {
    backgroundColor: '#0f1b16', borderWidth: 1, borderColor: 'rgba(255,255,255,.11)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4,
  },
  linha: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,.08)',
  },
  linhaT: { fontSize: 14, color: '#93a8a0', flexShrink: 0 },
  linhaV: { fontSize: 14, color: '#e8f2ec', fontWeight: '600', flex: 1, textAlign: 'right' },
  linhaVDestaque: { color: '#f5b544' },
  botao: {
    marginTop: 16, backgroundColor: '#34d399', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
  },
  botaoFraco: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,.14)', marginTop: 10 },
  botaoTxt: { fontSize: 16, fontWeight: '800', color: '#06231a' },
  botaoTxtFraco: { color: '#93a8a0' },
  nota: { fontSize: 13, color: '#6f827b', marginTop: 22, lineHeight: 19 },
});
