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

// O appBaseUrl decide para ONDE o Google devolve o usuario depois do login.
// Errado aqui = o retorno cai no proprio site, em /api/apps/auth/final-callback,
// que nao existe no app → 404 e volta pra tela de login.
//
// O problema e que esse valor nao vem so do .env. O app-params le tambem
// ?app_base_url= da URL e, principalmente, GUARDA o valor no localStorage do
// aparelho. Como a hospedagem compila a partir do GitHub sem o .env.local, o
// default fica vazio e o valor guardado passa a mandar. Um celular que uma
// vez gravou o dominio do site fica preso nesse 404 — so aquele aparelho,
// enquanto todos os outros entram normalmente.
//
// Entao: so vale appBaseUrl que aponte para o backend do Base44. Qualquer
// outra coisa e descartada E apagada do aparelho, para o celular se
// destravar sozinho no proximo carregamento, sem pedir pro usuario limpar
// dados do navegador.
function appBaseUrlConfiavel(valor) {
  if (!valor) return null;
  try {
    const host = new URL(valor).hostname;
    if (host === 'base44.app' || host.endsWith('.base44.app')) return valor;
  } catch {
    // URL malformada guardada no aparelho — tratada como ausente.
  }
  return null;
}

const appBaseUrlValido = appBaseUrlConfiavel(appBaseUrl);
if (appBaseUrl && !appBaseUrlValido && typeof window !== 'undefined') {
  console.warn(
    '[base44] app_base_url invalido no aparelho (' + appBaseUrl + '). ' +
    'Ignorado e removido — o login voltaria para um endereco que nao existe.'
  );
  try { window.localStorage.removeItem('base44_app_base_url'); } catch { /* modo privado */ }
}

const onlineClient = IS_OFFLINE ? null : createClient({
  appId: appId || FALLBACK_APP_ID,
  token,
  functionsVersion,
  serverUrl: BASE44_APP_BASE_URL,
  requiresAuth: false,
  appBaseUrl: appBaseUrlValido || BASE44_APP_BASE_URL,
});

export const base44 = IS_OFFLINE ? getOfflineClient() : onlineClient;
