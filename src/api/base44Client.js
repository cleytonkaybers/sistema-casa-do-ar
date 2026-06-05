import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { OFFLINE_ENABLED, getOfflineClient } from '@/api/offline/gate.js';

// O "gate" decide o modo: em produção é o stub (OFFLINE_ENABLED=false) e o código
// offline NÃO entra no bundle. No build offline, o alias troca gate.js por
// gate.offline.js (OFFLINE_ENABLED=true) e injeta o adaptador local de leitura.
export const IS_OFFLINE = OFFLINE_ENABLED;

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const onlineClient = IS_OFFLINE ? null : createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: import.meta.env.VITE_BASE44_APP_BASE_URL ?? 'https://sistema-casa-do-ar-copy-ef8ddf65.base44.app',
  requiresAuth: false,
  appBaseUrl,
});

export const base44 = IS_OFFLINE ? getOfflineClient() : onlineClient;
