// Adaptador offline de SOMENTE LEITURA.
// Tem o mesmo formato externo do cliente Base44 real:
//   base44.entities.<Nome>.{list, filter, get, create, update, delete, bulkCreate}
//   base44.auth.{me, isAuthenticated, logout, redirectToLogin, updateMe}
//   base44.functions.invoke(...)
//   base44.integrations.Core.*
// Em modo offline, toda escrita rejeita com erro amigável.
// Os dados são carregados via hydrate(backupJson) pelo OfflineImport.

import { ENTITY_MAP, SNAKE_ALIAS } from './entityMap.js';

// Store global em memória: Map<entityName, Record[]>
const store = new Map();
let _dataDate = null; // data_backup do arquivo carregado

// ─── Hidratação ──────────────────────────────────────────────────────────────

// Aceita v3.0 (data camelCase) e v2.0/semanal (dados snake_case)
export function hydrate(backupJson) {
  store.clear();
  const src = backupJson.data ?? backupJson.dados ?? {};
  _dataDate = backupJson.exported_at ?? backupJson.data_backup ?? null;

  // Build a lookup: qualquer key camelCase ou snake_case → entityName
  const lookup = new Map();
  ENTITY_MAP.forEach(({ key, entity }) => lookup.set(key, entity));
  Object.entries(SNAKE_ALIAS).forEach(([k, entity]) => lookup.set(k, entity));

  for (const [key, records] of Object.entries(src)) {
    if (!Array.isArray(records)) continue;
    const entity = lookup.get(key);
    if (entity) {
      store.set(entity, records);
    }
  }

  return { entities: [...store.keys()], total: [...store.values()].reduce((s, a) => s + a.length, 0) };
}

export function getDataDate() { return _dataDate; }
export function isHydrated() { return store.size > 0; }

// ─── Helpers internos ────────────────────────────────────────────────────────

function getRecords(entityName) {
  return store.get(entityName) ?? [];
}

function applySort(records, sortStr) {
  if (!sortStr) return records;
  const desc = sortStr.startsWith('-');
  const field = desc ? sortStr.slice(1) : sortStr;
  return [...records].sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return desc ? -cmp : cmp;
  });
}

function applyFilter(records, query) {
  if (!query || Object.keys(query).length === 0) return records;
  return records.filter(r =>
    Object.entries(query).every(([k, v]) => r[k] === v)
  );
}

const READ_ONLY_ERROR = Promise.reject(
  Object.assign(new Error('Indisponível no modo offline (somente leitura)'), { offline: true })
);

// ─── Proxy por entidade ──────────────────────────────────────────────────────

function makeEntityProxy(entityName) {
  return {
    list(sortStr, limit) {
      let r = applySort(getRecords(entityName), sortStr);
      if (limit) r = r.slice(0, limit);
      return Promise.resolve(r);
    },
    filter(query, sortStr, limit) {
      let r = applyFilter(getRecords(entityName), query);
      r = applySort(r, sortStr);
      if (limit) r = r.slice(0, limit);
      return Promise.resolve(r);
    },
    get(id) {
      const r = getRecords(entityName).find(rec => rec.id === id);
      return Promise.resolve(r ?? null);
    },
    create() { return READ_ONLY_ERROR; },
    update() { return READ_ONLY_ERROR; },
    delete() { return READ_ONLY_ERROR; },
    bulkCreate() { return READ_ONLY_ERROR; },
  };
}

// Cria um Proxy que gera o entityProxy sob demanda para qualquer nome de entidade
const entitiesProxy = new Proxy({}, {
  get(_, entityName) {
    return makeEntityProxy(entityName);
  },
});

// ─── auth ────────────────────────────────────────────────────────────────────

const authProxy = {
  me() {
    return Promise.resolve({
      id: 'offline',
      email: 'offline@casadoar.local',
      full_name: 'Modo Offline',
      role: 'admin',
      // tipo_usuario garante acesso completo de admin no menu (EmpresaGuard
      // gateia itens como "Pagamentos dos Clientes" por isAdminEmpresa()).
      // Sem company_id/empresa_id de propósito → guards pulam consultas remotas.
      tipo_usuario: 'admin_empresa',
    });
  },
  isAuthenticated() { return Promise.resolve(true); },
  logout() {},
  redirectToLogin() {},
  updateMe() { return READ_ONLY_ERROR; },
};

// ─── functions / integrations ─────────────────────────────────────────────────

const functionsProxy = {
  invoke(name) {
    return Promise.reject(
      Object.assign(
        new Error(`Função "${name}" indisponível no modo offline`),
        { offline: true }
      )
    );
  },
};

const integrationsProxy = {
  Core: {
    InvokeLLM() { return Promise.reject(Object.assign(new Error('LLM indisponível no modo offline'), { offline: true })); },
    UploadFile() { return Promise.reject(Object.assign(new Error('Upload indisponível no modo offline'), { offline: true })); },
    SendEmail() { return Promise.reject(Object.assign(new Error('E-mail indisponível no modo offline'), { offline: true })); },
  },
};

// ─── Exportação ───────────────────────────────────────────────────────────────

export const localClient = {
  entities: entitiesProxy,
  auth: authProxy,
  functions: functionsProxy,
  integrations: integrationsProxy,
};
