import React, { useState } from 'react';
import {
  Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../session';
import { ApiError } from '../api/client';

export default function LoginScreen() {
  const { entrar } = useSession();
  // pré-preenchido com a credencial de teste (org `teste`); trocar em produção.
  const [slug, setSlug] = useState('teste');
  const [email, setEmail] = useState('motorista@teste.com.br');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function submeter() {
    if (!slug.trim() || !email.trim() || !senha) {
      setErro('Preencha transportadora, e-mail e senha.');
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      await entrar(slug, email, senha);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível entrar.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.wrap}
      >
        <Text style={s.marca}>
          Tá Onde<Text style={s.dot}>?</Text>
        </Text>
        <Text style={s.sub}>App do motorista</Text>

        <Text style={s.label}>Transportadora</Text>
        <TextInput
          style={s.input} value={slug} onChangeText={setSlug}
          autoCapitalize="none" autoCorrect={false} placeholder="slug"
          placeholderTextColor="#5a6560"
        />

        <Text style={s.label}>E-mail</Text>
        <TextInput
          style={s.input} value={email} onChangeText={setEmail}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
          placeholder="voce@empresa.com.br" placeholderTextColor="#5a6560"
        />

        <Text style={s.label}>Senha</Text>
        <TextInput
          style={s.input} value={senha} onChangeText={setSenha}
          secureTextEntry placeholder="senha" placeholderTextColor="#5a6560"
          onSubmitEditing={submeter} returnKeyType="go"
        />

        {erro && <Text style={s.erro}>{erro}</Text>}

        <TouchableOpacity
          style={[s.btn, carregando && s.btnOff]}
          onPress={submeter} disabled={carregando} activeOpacity={0.85}
        >
          {carregando
            ? <ActivityIndicator color="#042417" />
            : <Text style={s.btnTxt}>Entrar</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a1310' },
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 26 },
  marca: { fontSize: 34, fontWeight: '800', color: '#e8f2ec', letterSpacing: -1 },
  dot: { color: '#34d399' },
  sub: { fontSize: 15, color: '#93a8a0', marginBottom: 34 },
  label: { fontSize: 13, fontWeight: '600', color: '#93a8a0', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#14241d', borderWidth: 1, borderColor: 'rgba(255,255,255,.11)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15,
    fontSize: 17, color: '#e8f2ec',
  },
  erro: { color: '#f87171', marginTop: 16, fontSize: 14 },
  btn: {
    backgroundColor: '#34d399', borderRadius: 12, paddingVertical: 17,
    alignItems: 'center', marginTop: 28,
  },
  btnOff: { opacity: 0.6 },
  btnTxt: { color: '#042417', fontSize: 17, fontWeight: '700' },
});
