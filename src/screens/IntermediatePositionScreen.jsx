import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text, ActivityIndicator, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GradientBackground from '../components/GradientBackground';
import api from '../services/api';
import useStyles from '../hooks/useStyles';
import useWebSocket from '../hooks/useWebSocket';

export default function IntermediatePositionScreen({ navigation }) {
  
  const [posicao, setPosicao] = useState(null);
  const [loading, setLoading] = useState(true);
  const socket = useWebSocket();
  const [moved, setMoved] = useState(false);

  const theme = useTheme();
  const styles = useStyles();

  useEffect(() => {
    const fetchPosition = async () => {
      try {
        setLoading(true);
        console.log("🔍 Buscando posição...");
        
        const matricula = await AsyncStorage.getItem('matricula');
        console.log("📋 Matrícula obtida:", matricula);
        
        const response = await api.post('/retornaPosicao', { matricula: Number(matricula) });
        console.log("✅ Posição recebida:", response.data);
        
        setPosicao(response.data.posicao);
      } catch (error) {
        console.error("❌ Erro detalhado ao obter posição:", {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        
        // Fallback mais robusto
        setPosicao("--");
      } finally {
        setLoading(false);
      }
    };

    // Delay para garantir que o backend processou a transição
    const timer = setTimeout(() => {
      fetchPosition();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const messageHandler = (event) => {
      console.log("📩 Mensagem recebida no IntermediatePosition:", event.data);

      if (event.data === "nova-questao" && !moved) {
        console.log("🔄 Voltando para SolveQuestion");
        setMoved(true);
        navigation.goBack();
      }
    };

    const errorHandler = (e) => {
      console.error("❌ WebSocket erro:", e.message);
    };

    socket.onmessage = messageHandler;
    socket.onerror = errorHandler;

    return () => {
      socket.onmessage = null;
      socket.onerror = null;
    };
  }, [socket, navigation, moved]);

  return (
    <GradientBackground>
      <Text variant="headlineSmall" style={{ marginBottom: 20 }}>
        Sua posição atual
      </Text>

      {loading ? (
        <ActivityIndicator animating={true} size="large" color={theme.colors.primary} />
      ) : (
        <Text variant="displayMedium" style={{ marginBottom: 30 }}>
          {posicao}º lugar
        </Text>
      )}

      <Text variant="titleSmall" style={{ marginTop: 20 }}>
        Aguardando a próxima questão...
      </Text>
    </GradientBackground>
  );
}