// Detalhe da parada: navegar até o endereço e registrar o desfecho (falha ou,
// em coleta, a confirmação de coleta). "Entregue" fica de fora desta fatia —
// exige comprovante (POD), que o app ainda não tem como capturar.
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useSession } from '../session';
import { ApiError } from '../api/client';
import { Entrega } from '../api/types';
import {
  atualizarStatusEntrega, registrarColeta, rotuloStatusEntrega,
  MOTIVOS_FALHA, MotivoFalha,
} from '../api/entregas';
import { posicaoPontual } from '../rastreio/posicao';

type Props = NativeStackScreenProps<RootStackParamList, 'Parada'>;

export default function ParadaScreen({ route, navigation }: Props) {
  const { token } = useSession();
  const [entrega, setEntrega] = useState<Entrega>(route.params.parada.entrega);
  const coleta = entrega.tipo_operacao === 'coleta';

  const [modalFalha, setModalFalha] = useState(false);

  const [coletado, setColetado] = useState(false);
  const [horaColeta, setHoraColeta] = useState<string | null>(null);
  const [obsColeta, setObsColeta] = useState('');
  const [enviandoColeta, setEnviandoColeta] = useState(false);
  const [erroColeta, setErroColeta] = useState<string | null>(null);

  // Trava contra double-tap em "Navegar" disparando o PATCH em_rota duas vezes.
  // Libera de novo se a chamada falhar, para o próximo toque tentar.
  const emRotaDisparado = useRef(false);

  async function marcarEmRota() {
    const ocorrido_em = new Date().toISOString();
    const pos = await posicaoPontual();
    try {
      await atualizarStatusEntrega(token!, entrega.id, {
        status: 'em_rota', ocorrido_em, lat: pos?.lat, lon: pos?.lon,
      });
      setEntrega((e) => ({ ...e, status: 'em_rota' }));
    } catch {
      emRotaDisparado.current = false;
    }
  }

  async function aoNavegar() {
    if (entrega.lat == null || entrega.lon == null) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${entrega.lat},${entrega.lon}`;
    Linking.openURL(url).catch(() => Alert.alert('Não foi possível abrir o mapa.'));

    // Melhor esforço, invisível ao motorista — não atrasa a abertura do mapa.
    if (entrega.status === 'alocada' && !emRotaDisparado.current) {
      emRotaDisparado.current = true;
      marcarEmRota();
    }
  }

  async function confirmarFalha(motivo: MotivoFalha, observacao: string) {
    const ocorrido_em = new Date().toISOString();
    const pos = await posicaoPontual();
    await atualizarStatusEntrega(token!, entrega.id, {
      status: 'falha', motivo, observacao: observacao || undefined,
      ocorrido_em, lat: pos?.lat, lon: pos?.lon,
    });
    setEntrega((e) => ({ ...e, status: 'falha' }));
    setModalFalha(false);
  }

  async function confirmarColeta() {
    setEnviandoColeta(true);
    setErroColeta(null);
    const ocorrido_em = new Date().toISOString();
    const pos = await posicaoPontual();
    try {
      await registrarColeta(token!, entrega.id, {
        observacao: obsColeta || undefined, ocorrido_em, lat: pos?.lat, lon: pos?.lon,
      });
      setColetado(true);
      setHoraColeta(ocorrido_em);
    } catch (e) {
      setErroColeta(e instanceof ApiError ? e.message : 'Falha ao confirmar a coleta.');
    } finally {
      setEnviandoColeta(false);
    }
  }

  const semNavegar = entrega.lat == null || entrega.lon == null;
  const statusInfo = rotuloStatusEntrega(entrega.status);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.head}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={12}>
          <Text style={s.voltar}>‹ Rota</Text>
        </TouchableOpacity>
        <Text style={s.titulo} numberOfLines={1}>{entrega.destinatario || entrega.nota_fiscal}</Text>
        <View style={{ width: 54 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={s.card}>
          <View style={s.linhaTopo}>
            <Text style={[s.tag, coleta ? s.tagColeta : s.tagEntrega]}>{coleta ? 'coleta' : 'entrega'}</Text>
            <Text style={[s.pill, { color: statusInfo.cor, borderColor: statusInfo.cor }]}>{statusInfo.rotulo}</Text>
          </View>
          <Text style={s.dest}>{entrega.destinatario || 'Destinatário não informado'}</Text>
          <Text style={s.end}>{entrega.endereco || 'Sem endereço'}</Text>
          <View style={s.divisor} />
          <Linha t="Nota fiscal" v={entrega.nota_fiscal} />
          {entrega.peso_kg != null && <Linha t="Peso" v={`${entrega.peso_kg} kg`} />}
          {entrega.quantidade_volumes != null && <Linha t="Volumes" v={String(entrega.quantidade_volumes)} />}
          {route.params.parada.previsto && <Linha t="Previsto" v={hora(route.params.parada.previsto)} />}
        </View>

        <TouchableOpacity
          style={[s.botao, semNavegar && s.botaoDesabilitado]}
          onPress={aoNavegar}
          disabled={semNavegar}
          activeOpacity={0.85}
        >
          <Text style={s.botaoTxt}>{semNavegar ? 'Sem coordenada para navegar' : 'Navegar'}</Text>
        </TouchableOpacity>

        {coleta && (
          <View style={s.card}>
            <Text style={s.secaoTitulo}>Coleta</Text>
            {coletado ? (
              <Text style={s.coletaOk}>Coleta confirmada às {hora(horaColeta)}</Text>
            ) : (
              <>
                <TextInput
                  style={s.input}
                  placeholder="Observação (opcional)"
                  placeholderTextColor="#6f827b"
                  value={obsColeta}
                  onChangeText={setObsColeta}
                  editable={!enviandoColeta}
                />
                {erroColeta && <Text style={s.erro}>{erroColeta}</Text>}
                <TouchableOpacity
                  style={[s.botao, s.botaoSecundario]}
                  onPress={confirmarColeta}
                  disabled={enviandoColeta}
                  activeOpacity={0.85}
                >
                  {enviandoColeta
                    ? <ActivityIndicator color="#06231a" />
                    : <Text style={s.botaoTxt}>Confirmar coleta</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[s.botao, s.botaoFraco]}
          onPress={() => setModalFalha(true)}
          activeOpacity={0.85}
        >
          <Text style={[s.botaoTxt, s.botaoTxtFraco]}>Registrar falha</Text>
        </TouchableOpacity>
      </ScrollView>

      <FalhaModal
        visivel={modalFalha}
        aoFechar={() => setModalFalha(false)}
        aoConfirmar={confirmarFalha}
      />
    </SafeAreaView>
  );
}

function Linha({ t, v }: { t: string; v: string }) {
  return (
    <View style={s.linha}>
      <Text style={s.linhaT}>{t}</Text>
      <Text style={s.linhaV} numberOfLines={2}>{v}</Text>
    </View>
  );
}

function hora(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function FalhaModal({
  visivel, aoFechar, aoConfirmar,
}: {
  visivel: boolean;
  aoFechar: () => void;
  aoConfirmar: (motivo: MotivoFalha, observacao: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState<MotivoFalha | null>(null);
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fechar = () => {
    setMotivo(null);
    setObservacao('');
    setErro(null);
    aoFechar();
  };

  const confirmar = async () => {
    if (!motivo) return;
    setEnviando(true);
    setErro(null);
    try {
      await aoConfirmar(motivo, observacao);
      setMotivo(null);
      setObservacao('');
    } catch (e) {
      // Não fecha nem limpa — o motorista não digita tudo de novo por causa
      // de um trecho sem sinal.
      setErro(e instanceof ApiError ? e.message : 'Falha ao registrar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={fechar}>
      <View style={s.modalFundo}>
        <View style={s.modalCard}>
          <Text style={s.modalTitulo}>Registrar falha</Text>
          <View style={s.chips}>
            {MOTIVOS_FALHA.map((m) => (
              <TouchableOpacity
                key={m.valor}
                style={[s.chip, motivo === m.valor && s.chipSelecionado]}
                onPress={() => setMotivo(m.valor)}
                activeOpacity={0.8}
              >
                <Text style={[s.chipTxt, motivo === m.valor && s.chipTxtSelecionado]}>{m.rotulo}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={s.input}
            placeholder="Observação (opcional)"
            placeholderTextColor="#6f827b"
            value={observacao}
            onChangeText={setObservacao}
            editable={!enviando}
            multiline
          />
          {erro && <Text style={s.erro}>{erro}</Text>}
          <View style={s.modalBotoes}>
            <TouchableOpacity style={[s.botao, s.botaoFraco, { flex: 1 }]} onPress={fechar} disabled={enviando} activeOpacity={0.85}>
              <Text style={[s.botaoTxt, s.botaoTxtFraco]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.botao, { flex: 1 }, (!motivo || enviando) && s.botaoDesabilitado]}
              onPress={confirmar}
              disabled={!motivo || enviando}
              activeOpacity={0.85}
            >
              {enviando ? <ActivityIndicator color="#06231a" /> : <Text style={s.botaoTxt}>Confirmar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a1310' },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.07)',
  },
  voltar: { fontSize: 16, color: '#93a8a0', fontWeight: '600', width: 54 },
  titulo: { fontSize: 17, fontWeight: '800', color: '#e8f2ec', flex: 1, textAlign: 'center' },
  card: {
    backgroundColor: '#0f1b16', borderWidth: 1, borderColor: 'rgba(255,255,255,.11)',
    borderRadius: 14, padding: 16, marginBottom: 14,
  },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tag: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, overflow: 'hidden',
  },
  tagEntrega: { color: '#34d399', backgroundColor: 'rgba(52,211,153,.12)' },
  tagColeta: { color: '#f5b544', backgroundColor: 'rgba(245,181,68,.12)' },
  pill: {
    fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, overflow: 'hidden',
  },
  dest: { fontSize: 19, fontWeight: '800', color: '#e8f2ec' },
  end: { fontSize: 14, color: '#93a8a0', marginTop: 3 },
  divisor: { height: 1, backgroundColor: 'rgba(255,255,255,.08)', marginVertical: 12 },
  linha: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    paddingVertical: 8,
  },
  linhaT: { fontSize: 14, color: '#93a8a0' },
  linhaV: { fontSize: 14, color: '#e8f2ec', fontWeight: '600', flex: 1, textAlign: 'right' },
  secaoTitulo: {
    fontSize: 12, fontWeight: '700', color: '#93a8a0', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 10,
  },
  coletaOk: { fontSize: 15, color: '#34d399', fontWeight: '700' },
  input: {
    backgroundColor: '#0a1310', borderWidth: 1, borderColor: 'rgba(255,255,255,.14)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#e8f2ec',
    fontSize: 14, marginBottom: 10,
  },
  erro: { color: '#f87171', fontSize: 13, marginBottom: 10 },
  botao: {
    backgroundColor: '#34d399', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginBottom: 14,
  },
  botaoSecundario: { marginBottom: 0 },
  botaoFraco: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,.14)' },
  botaoDesabilitado: { opacity: 0.45 },
  botaoTxt: { fontSize: 16, fontWeight: '800', color: '#06231a' },
  botaoTxtFraco: { color: '#93a8a0' },
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,.55)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#0f1b16', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: '#e8f2ec', marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,.14)',
  },
  chipSelecionado: { backgroundColor: 'rgba(52,211,153,.16)', borderColor: '#34d399' },
  chipTxt: { fontSize: 13, color: '#93a8a0', fontWeight: '600' },
  chipTxtSelecionado: { color: '#34d399' },
  modalBotoes: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
