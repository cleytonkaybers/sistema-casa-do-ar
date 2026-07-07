import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { OFFLINE_ENABLED, getOfflineClient } from '@/api/offline/gate.js';

// O "gate" decide o modo: em produção é o stub (OFFLINE_ENABLED=false) e o código
// offline NÃO entra no bundle. No build offline, o alias troca gate.js por
// gate.offline.js (OFFLINE_ENABLED=true) e injeta o adaptador local de leitura.
export const IS_OFFLINE = OFFLINE_ENABLED;

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Valores PÚBLICOS do app (aparecem em qualquer URL do Base44), usados como
// fallback quando o build é feito sem o .env.local — caso da hospedagem
// externa que compila a partir do GitHub (o .env.local é gitignored).
// Sem o fallback de appBaseUrl, o SDK usava o domínio do próprio site
// (ex.: casadoarservice.com) para montar a URL de login, e o redirect de
// sessão expirada caía em /login — rota que não existe no app → 404.
export const BASE44_APP_BASE_URL =
  import.meta.env.VITE_BASE44_APP_BASE_URL || 'https://sistema-casa-do-ar-copy-ef8ddf65.base44.app';
const FALLBACK_APP_ID = '69c180d661f0af9eef8ddf65';

const onlineClient = IS_OFFLINE ? null : createClient({
  appId: appId || FALLBACK_APP_ID,
  token,
  functionsVersion,
  serverUrl: BASE44_APP_BASE_URL,
  requiresAuth: false,
  appBaseUrl: appBaseUrl || BASE44_APP_BASE_URL,
});

export const base44 = IS_OFFLINE ? getOfflineClient() : onlineClient;
