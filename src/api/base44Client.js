import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { localClient } from './offline/localClient.js';

// Em modo offline (VITE_OFFLINE=1) substitui o cliente Base44 pelo adaptador local
// de somente leitura. A produção nunca define essa variável — o Vite faz tree-shaking
// do branch morto, então o localClient não entra no bundle de produção.
export const IS_OFFLINE = import.meta.env.VITE_OFFLINE === '1';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const onlineClient = IS_OFFLINE ? null : createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: import.meta.env.VITE_BASE44_APP_BASE_URL ?? 'https://sistema-casa-do-ar-copy-ef8ddf65.base44.app',
  requiresAuth: false,
  appBaseUrl,
});

export const base44 = IS_OFFLINE ? localClient : onlineClient;
