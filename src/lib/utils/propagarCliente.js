// Propaga alteracoes do Cliente para todas as entidades que tem snapshot
// dos dados (cliente_nome, telefone, endereco, etc).
//
// Como funciona: ao editar um cliente, o nome/telefone antigo continua copiado
// nos registros de Servico, Atendimento, PagamentoCliente, Agendamento e
// LancamentoFinanceiro. Sem essa propagacao, o usuario corrige o nome no
// cadastro mas em outras telas ainda aparece o nome antigo.
//
// Estrategia:
// 1. Identifica quais campos mudaram (otimizacao).
// 2. Busca registros relacionados pelo NOME ANTIGO (e filtra por telefone
//    antigo quando disponivel — defesa contra homonimos).
// 3. Atualiza apenas os campos relevantes (mapeando os nomes diferentes
//    em cada entidade — ex: "nome" no Cliente vira "cliente_nome" no Servico).
//
// Tolerante a erros: cada update e isolado em try/catch — falha em uma
// entidade nao bloqueia as outras.

import { base44 } from '@/api/base44Client';

const camposCliente = ['nome', 'telefone', 'endereco', 'latitude', 'longitude', 'cpf', 'google_maps_link'];

const apenasDigitos = (s) => String(s || '').replace(/\D/g, '');

function houveMudanca(antigo, novo) {
  if (!antigo || !novo) return false;
  return camposCliente.some(f => (antigo[f] || '') !== (novo[f] || ''));
}

// Compara registros pelo cliente antigo. Match se nome bater (case-insensitive)
// e (se telefone existir nos dois) os digitos do telefone tambem baterem.
function matchPeloAntigo(reg, antigo, campoNome) {
  const nomeReg = (reg[campoNome] || '').trim().toLowerCase();
  const nomeAntigo = (antigo.nome || '').trim().toLowerCase();
  if (!nomeReg || !nomeAntigo || nomeReg !== nomeAntigo) return false;
  // Se ambos tem telefone, precisa bater (defesa contra homonimo)
  const telReg = apenasDigitos(reg.telefone);
  const telAntigo = apenasDigitos(antigo.telefone);
  if (telReg && telAntigo && telReg !== telAntigo) return false;
  return true;
}

// Constroi o objeto de update para uma entidade, mapeando os campos
// do Cliente para os nomes de campo daquela entidade.
function buildUpdatePayload(novo, mapeamento) {
  const payload = {};
  for (const [clienteField, entityField] of Object.entries(mapeamento)) {
    if (entityField && novo[clienteField] !== undefined) {
      payload[entityField] = novo[clienteField];
    }
  }
  return payload;
}

/**
 * Propaga alteracao de um cliente para todas as entidades relacionadas.
 * @param {Object} antigo - dados do cliente ANTES da edicao
 * @param {Object} novo - dados do cliente DEPOIS da edicao
 * @returns {Promise<{atualizados: number, erros: string[]}>}
 */
export async function propagarAlteracaoCliente(antigo, novo) {
  if (!houveMudanca(antigo, novo)) {
    return { atualizados: 0, erros: [] };
  }

  let atualizados = 0;
  const erros = [];

  // Mapeamento por entidade: { campo_no_cliente: campo_na_entidade }
  // null = nao existe naquela entidade (sera ignorado).
  const entidades = [
    {
      nome: 'Servico',
      api: base44.entities.Servico,
      campoNomeCliente: 'cliente_nome',
      mapeamento: {
        nome: 'cliente_nome',
        telefone: 'telefone',
        endereco: 'endereco',
        latitude: 'latitude',
        longitude: 'longitude',
        cpf: 'cpf',
        google_maps_link: 'google_maps_link',
      },
    },
    {
      nome: 'Atendimento',
      api: base44.entities.Atendimento,
      campoNomeCliente: 'cliente_nome',
      mapeamento: {
        nome: 'cliente_nome',
        telefone: 'telefone',
        endereco: 'endereco',
        latitude: 'latitude',
        longitude: 'longitude',
        cpf: 'cpf',
        google_maps_link: 'google_maps_link',
      },
    },
    {
      nome: 'PagamentoCliente',
      api: base44.entities.PagamentoCliente,
      campoNomeCliente: 'cliente_nome',
      mapeamento: {
        nome: 'cliente_nome',
        telefone: 'telefone',
        // PagamentoCliente nao guarda endereco/cpf/lat/long
      },
    },
    {
      nome: 'Agendamento',
      api: base44.entities.Agendamento,
      campoNomeCliente: 'nome',
      mapeamento: {
        nome: 'nome',
        telefone: 'telefone',
        endereco: 'localizacao', // Agendamento usa "localizacao"
      },
    },
    {
      nome: 'LancamentoFinanceiro',
      api: base44.entities.LancamentoFinanceiro,
      campoNomeCliente: 'cliente_nome',
      mapeamento: {
        nome: 'cliente_nome',
      },
    },
  ];

  // Lista TODAS as entidades em PARALELO (era sequencial). Cada list e
  // independente — paralelizar economiza segundos quando ha varias entidades.
  const fetched = await Promise.all(
    entidades.map(ent =>
      ent.api.list()
        .then(todos => ({ ent, todos, error: null }))
        .catch(err => ({ ent, todos: [], error: err }))
    )
  );

  // Para cada entidade, dispara updates em PARALELO (era sequencial).
  // O backend Base44 lida bem com paralelismo — mais rapido.
  await Promise.all(fetched.map(async ({ ent, todos, error }) => {
    if (error) {
      erros.push(`${ent.nome}: ${error?.message || 'erro desconhecido'}`);
      return;
    }
    const meus = todos.filter(r => matchPeloAntigo(r, antigo, ent.campoNomeCliente));
    if (meus.length === 0) return;

    const payload = buildUpdatePayload(novo, ent.mapeamento);
    if (Object.keys(payload).length === 0) return;

    await Promise.all(meus.map(reg =>
      ent.api.update(reg.id, payload)
        .then(() => { atualizados++; })
        .catch(err => erros.push(`${ent.nome}#${reg.id}: ${err?.message || 'erro desconhecido'}`))
    ));
  }));

  return { atualizados, erros };
}
