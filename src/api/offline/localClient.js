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

// Aceita TODOS os formatos de backup do sistema, de forma robusta:
//   - v3.0 (export manual):      { data: { clientes, pagamentosClientes, ... } }   (camelCase)
//   - v2.0/semanal:              { dados: { clientes, pagamentos_clientes, ... } } (snake_case)
//   - incremental (Drive):       { dados: { Cliente, PagamentoCliente, ... } }     (PascalCase = nome da entidade)
// O lookup é case-insensitive e cobre as 3 convenções. Se varias chaves
// mapearem pra mesma entidade, os registros sao concatenados (nao sobrescritos).
export function hydrate(backupJson) {
  store.clear();
  const src = backupJson.data ?? backupJson.dados ?? {};
  _dataDate = backupJson.exported_at ?? backupJson.data_backup ?? null;

  // lookup: chave normalizada (minuscula) -> nome da entidade
  const lookup = new Map();
  const add = (k, entity) => { if (k) lookup.set(String(k).toLowerCase(), entity); };
  ENTITY_MAP.forEach(({ key, entity }) => { add(key, entity); add(entity, entity); });
  Object.entries(SNAKE_ALIAS).forEach(([k, entity]) => { add(k, entity); add(entity, entity); });

  const ignoradas = [];
  for (const [key, records] of Object.entries(src)) {
    if (!Array.isArray(records) || records.length === 0) continue;
    const entity = lookup.get(key.toLowerCase());
    if (entity) {
      const existente = store.get(entity) || [];
      store.set(entity, existente.concat(records));
    } else {
      ignoradas.push(key);
    }
  }

  const total = [...store.values()].reduce((s, a) => s + a.length, 0);
  return { entities: [...store.keys()], total, ignoradas };
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
