// Versão REAL do gate — usada apenas no build offline (via alias em
// vite.config.offline.js). Reúne todo o código do modo offline aqui, de modo
// que o build de produção (que usa gate.js) nunca o inclua.
import { localClient } from './localClient.js';

export const OFFLINE_ENABLED = true;
export function getOfflineClient() { return localClient; }
export { isHydrated, getDataDate } from './localClient.js';
export { default as OfflineImport } from './OfflineImport.jsx';
