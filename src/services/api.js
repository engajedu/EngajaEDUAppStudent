// api.js
import axios from 'axios';
import Constants from 'expo-constants';

// --- Descoberta da URL da API (prioriza env do EAS) ---
const envUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
  Constants.manifest?.extra?.EXPO_PUBLIC_API_URL ||
  'https://api.engajedu.com.br';

// remove barra final, se houver (evita // nas URLs)
const API_URL = envUrl.replace(/\/$/, '');

// Debug de ambiente (aparece no logcat)
console.log('🔧 Environment Info:', {
  isDev: __DEV__,
  releaseChannel: Constants.manifest?.releaseChannel,
  API_URL_FROM_ENV: process.env.EXPO_PUBLIC_API_URL,
  API_URL_FROM_EXPO_CONFIG: Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL,
  API_URL_FROM_MANIFEST: Constants.manifest?.extra?.EXPO_PUBLIC_API_URL,
  resolvedAPI: API_URL,
  platform: Constants.platform,
});

console.log('🌐 Using API URL:', API_URL);

// --- Axios instance ---
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000, // 30s
});

// Logs de requisição
api.interceptors.request.use((request) => {
  const method = request.method?.toUpperCase();
  const url = request.url || '';
  const base = request.baseURL || '';
  console.log('📤 API Request:', {
    method,
    url,
    baseURL: base,
    fullURL: `${base}${url}`,
    headers: request.headers,
    timeout: request.timeout,
  });
  return request;
});

// Logs de resposta/erro
api.interceptors.response.use(
  (response) => {
    console.log('📥 API Response Success:', {
      status: response.status,
      url: response.config?.url,
      dataLength:
        typeof response.data === 'string'
          ? response.data.length
          : Array.isArray(response.data)
          ? response.data.length
          : 'N/A',
      data: response.data,
    });
    return response;
  },
  (error) => {
    const cfg = error.config || {};
    const base = cfg.baseURL || '';
    const url = cfg.url || '';
    const fullURL = `${base}${url}`;

    console.error('❌ API Error Details:', {
      message: error.message,
      code: error.code,
      url,
      fullURL,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      timeout: cfg.timeout,
      headers: cfg.headers,
    });

    // Rede/servidor inacessível
    if (error.code === 'ERR_NETWORK' || /Network Error/i.test(error.message)) {
      console.error('🌐 Problema de conectividade detectado:', {
        baseURL: base,
        possibleCause: 'Servidor offline, DNS, firewall ou rede do dispositivo',
      });
    }

    // Timeout
    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) {
      console.error('⏱️ Timeout detectado:', {
        timeout: cfg.timeout,
        suggestion:
          'Verifique performance do servidor ou aumente o timeout conforme necessário',
      });
    }

    return Promise.reject(error);
  }
);

export { API_URL };
export default api;
