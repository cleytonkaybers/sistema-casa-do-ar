// STUB DE PRODUÇÃO — modo offline desligado.
// No build offline (vite.config.offline.js), este arquivo é substituído por
// gate.offline.js via alias. Como aqui NÃO importamos localClient/OfflineImport,
// nenhum código do modo offline entra no bundle de produção.
export const OFFLINE_ENABLED = false;
export function getOfflineClient() { return null; }
export function isHydrated() { return true; }
export function getDataDate() { return null; }
export const OfflineImport = () => null;
