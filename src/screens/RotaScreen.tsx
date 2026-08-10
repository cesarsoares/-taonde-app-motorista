import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useSession } from '../session';
import { getRotaDoDia } from '../api/auth';
import { ApiError } from '../api/client';
import { RotaDoDia, Parada } from '../api/types';
import * as filaRastreio from '../rastreio/fila';
import { rastreando } from '../rastreio/task';

type Rotas = { Rota: undefined; Rastreio: undefined };

export default function RotaScreen() {
  const { token, sair } = useSession();
  const nav = useNavigation<NavigationProp<Rotas>>();
  const [dados, setDados] = useState<RotaDoDia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    if (!token) return;
    setErro(null);
    try {
      setDados(await getRotaDoDia(token));
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Falha ao carregar a rota.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Estado do rastreio sempre à vista (régua de UX do motorista: sinal/sync
  // visíveis). Em Expo Go o serviço não existe — degrada para desligado.
  const [gps, setGps] = useState({ ligado: false, pendentes: 0 });
  useEffect(() => {
    const ler = async () => {
      try {
        setGps({ ligado: await rastreando(), pendentes: filaRastreio.tamanho() });
      } catch {
        setGps({ ligado: false, pendentes: 0 });
      }
    };
    ler();
    const t = setInterval(ler, 5000);
    return () => clearInterval(t);
  }, []);

  if (carregando) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ marginTop: 48 }} color="#34d399" size="large" />
      </SafeAreaView>
    );
  }

  const paradas = dados?.paradas ?? [];
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>{dados?.rota ? `Rota ${dados.rota.numero ?? ''}` : 'Sem rota hoje'}</Text>
          <Text style={s.sub}>
            {dados?.motorista_nome} · {paradas.length} parada{paradas.length === 1 ? '' : 's'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => nav.navigate('Rastreio')}
          hitSlop={10}
          style={s.chip}
          activeOpacity={0.7}
        >
          <View style={[s.ponto, gps.ligado ? s.pontoOn : s.pontoOff]} />
          <Text style={s.chipTxt}>
            {gps.pendentes > 0 ? `${gps.pendentes} a enviar` : gps.ligado ? 'Em jornada' : 'GPS'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={sair} hitSlop={10} style={{ marginLeft: 14 }}>
          <Text style={s.sair}>Sair</Text>
        </TouchableOpacity>
      </View>

      {erro && <Text style={s.erro}>{erro}</Text>}

      <FlatList
        data={paradas}
        keyExtractor={(p) => p.entrega.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => { setAtualizando(true); carregar(); }}
            tintColor="#34d399"
          />
        }
        ListEmptyComponent={
          !erro ? <Text style={s.vazio}>Nenhuma parada atribuída ainda. Puxe para atualizar.</Text> : null
        }
        renderItem={({ item }) => <ParadaCard p={item} />}
      />
    </SafeAreaView>
  );
}

function ParadaCard({ p }: { p: Parada }) {
  const e = p.entrega;
  const coleta = e.tipo_operacao === 'coleta';
  return (
    <TouchableOpacity style={s.card} activeOpacity={0.8}>
      <Text style={s.ordem}>{p.ordem}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.dest}>{e.destinatario || e.nota_fiscal}</Text>
        <Text style={s.end} numberOfLines={2}>{e.endereco || 'Sem endereço'}</Text>
      </View>
      <Text style={[s.tag, coleta ? s.tagColeta : s.tagEntrega]}>{coleta ? 'coleta' : 'entrega'}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a1310' },
  head: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18,
    paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.07)',
  },
  titulo: { fontSize: 22, fontWeight: '800', color: '#e8f2ec', letterSpacing: -0.5 },
  sub: { fontSize: 14, color: '#93a8a0', marginTop: 2 },
  sair: { fontSize: 15, color: '#93a8a0', fontWeight: '600' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,.13)',
  },
  chipTxt: { fontSize: 12, color: '#93a8a0', fontWeight: '700' },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  pontoOn: { backgroundColor: '#34d399' },
  pontoOff: { backgroundColor: '#6f827b' },
  erro: { color: '#f87171', fontSize: 14, paddingHorizontal: 18, paddingTop: 12 },
  vazio: { color: '#93a8a0', textAlign: 'center', marginTop: 40, fontSize: 15 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#0f1b16', borderWidth: 1, borderColor: 'rgba(255,255,255,.11)',
    borderRadius: 14, padding: 16, marginBottom: 10,
  },
  ordem: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(52,211,153,.12)',
    color: '#34d399', fontWeight: '800', fontSize: 16, textAlign: 'center', lineHeight: 34,
  },
  dest: { fontSize: 16, fontWeight: '700', color: '#e8f2ec' },
  end: { fontSize: 13, color: '#93a8a0', marginTop: 3 },
  tag: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, overflow: 'hidden',
  },
  tagEntrega: { color: '#34d399', backgroundColor: 'rgba(52,211,153,.12)' },
  tagColeta: { color: '#f5b544', backgroundColor: 'rgba(245,181,68,.12)' },
});
