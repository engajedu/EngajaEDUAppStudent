// src/hooks/useWebSocket.js
import { useState, useEffect, useRef } from 'react';
import Constants from 'expo-constants';

// Resolve base de URL a partir das ENVs do EAS/Expo
const RAW_API =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
  Constants.manifest?.extra?.EXPO_PUBLIC_API_URL ||
  'https://engajedu.com.br/api';

// Se tiver EXPO_PUBLIC_WEBSOCKET_URL usamos ela; senão, derivamos do API_URL
// https -> wss  |  http -> ws
const RAW_WS =
  process.env.EXPO_PUBLIC_WEBSOCKET_URL ||
  (RAW_API.startsWith('https')
    ? RAW_API.replace(/^https/, 'wss')
    : RAW_API.replace(/^http/, 'ws'));

// remove barra final para evitar '//' quando concatenar paths
const WS_BASE = RAW_WS.replace(/\/$/, '');

// caminho do socket no backend (ajuste se o seu for outro)
const WS_PATH = ''; // ex: '/socket' ou '/ws' se precisar

export const useWebSocket = () => {
  const [socket, setSocket] = useState(null);
  const reconnectAttemptsRef = useRef(0);
  const timerRef = useRef(null);
  const pingRef = useRef(null);

  useEffect(() => {
    console.log('🔌 Iniciando conexão WebSocket');

    const maxReconnectAttempts = 5;
    const url = `${WS_BASE}${WS_PATH || ''}`;
    let ws;

    const connect = () => {
      const attempt = reconnectAttemptsRef.current + 1;
      console.log(`📡 Tentativa de conexão WebSocket ${attempt}:`, url);

      try {
        ws = new WebSocket(url); // Expo/RN suporta wss nativamente

        ws.onopen = () => {
          console.log('✅ WebSocket conectado em:', url);
          reconnectAttemptsRef.current = 0;
          setSocket(ws);

          // Keep-alive opcional (envia ping a cada 25s)
          clearInterval(pingRef.current);
          pingRef.current = setInterval(() => {
            try {
              if (ws.readyState === WebSocket.OPEN) ws.send('ping');
            } catch {}
          }, 25000);
        };

        ws.onmessage = (e) => {
          // se quiser, processe mensagens aqui
          // console.log('📨 WS msg:', e.data);
        };

        ws.onerror = (e) => {
          console.log('⚠️ WebSocket erro:', e?.message || e);
        };

        ws.onclose = (e) => {
          console.log('🔌 WebSocket fechado:', e?.code, e?.reason || '');
          setSocket(null);
          clearInterval(pingRef.current);

          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current += 1;
            const backoff = Math.min(10000, 500 * 2 ** (reconnectAttemptsRef.current - 1)); // 0.5s,1s,2s,4s,8s,10s...
            console.log(`🔄 Reconnect em ${backoff}ms (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(connect, backoff);
          } else {
            console.log('❌ Máximo de tentativas de reconexão atingido.');
          }
        };
      } catch (error) {
        console.log('❌ Exceção ao criar WebSocket:', error?.message || error);
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const backoff = Math.min(10000, 500 * 2 ** (reconnectAttemptsRef.current - 1));
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(connect, backoff);
        }
      }
    };

    connect();

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(pingRef.current);
      try {
        if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      } catch {}
    };
  }, []);

  return socket;
};

export default useWebSocket;
