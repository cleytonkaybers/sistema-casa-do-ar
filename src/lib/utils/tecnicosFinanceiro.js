import { base44 } from '@/api/base44Client';
import { listAll } from '@/lib/utils/listAll';

const norm = (s) => (s || '').trim().toLowerCase();

// Serviço executado pelo próprio ADM: cobra o cliente normalmente (vai para
// Pagamentos dos Clientes), mas NÃO gera comissão para técnico. Usado como
// "equipe" sentinela no cadastro do serviço.
export const EQUIPE_ADM_ID = 'ADM';
export const EQUIPE_ADM_NOME = 'ADM (administrador)';
export const ehEquipeAdm = (equipeId) => norm(equipeId) === norm(EQUIPE_ADM_ID);

// Usuário conta como técnico quando tem equipe e é tipo 'tecnico'
// (ou role 'user' legado sem tipo_usuario definido).
export const ehTecnicoUser = (u) =>
  !!u?.equipe_id && (u.tipo_usuario === 'tecnico' || (!u.tipo_usuario && u.role === 'user'));

// Técnico ASSALARIADO: pago por valor fixo semanal, NÃO por % de comissão.
// Lê top-level e do bag `data` — a tela de Usuários grava dentro de `data`,
// o restante do app lê top-level. Ausente/'comissao' = comportamento normal.
export const REMUNERACAO_FIXA = 'fixo';
export const ehAssalariado = (x) =>
  (x?.remuneracao || x?.data?.remuneracao) === REMUNERACAO_FIXA;

// Chave de identidade de um TecnicoFinanceiro (e-mail normalizado; cai para
// o nome quando o id estiver vazio).
const chaveTecFin = (t) => norm(t?.tecnico_id) || norm(t?.tecnico_nome);

// Localiza o User correspondente a um TecnicoFinanceiro (por e-mail ou nome).
export function acharUsuarioDoTecnico(t, usuarios) {
  return (usuarios || []).find(u =>
    norm(u.email) === norm(t?.tecnico_id) ||
    (u.full_name && t?.tecnico_nome && norm(u.full_name) === norm(t.tecnico_nome))) || null;
}

// Assalariado considerando TAMBÉM o cadastro do usuário — o espelho
// `remuneracao` no TecnicoFinanceiro só existe depois do provisionamento
// rodar, então sozinho ele não é confiável.
export const ehAssalariadoCom = (t, usuarios) =>
  ehAssalariado(t) || ehAssalariado(acharUsuarioDoTecnico(t, usuarios));

// Filtro ESTRITO para GERAR COMISSÃO: só recebe % quem é usuário ativo do app,
// não está oculto e não é assalariado. Diferente de filtrarTecnicosAtivos, aqui
// crédito pendente NÃO mantém ninguém — ex-funcionário pode ter saldo a acertar,
// mas não pode continuar ganhando comissão de serviços novos.
export function filtrarTecnicosParaComissao(tecFins, usuarios) {
  const ids = new Set();
  const nomes = new Set();
  for (const u of usuarios || []) {
    if (u?.email) ids.add(norm(u.email));
    if (u?.full_name) nomes.add(norm(u.full_name));
  }
  // Sem lista de usuários confiável, mantém o comportamento antigo (não
  // arrisca deixar técnico legítimo sem comissão por falha de rede).
  const semReferencia = ids.size === 0;
  return (tecFins || []).filter(t => {
    if (t?.oculto === true) return false;
    if (ehAssalariadoCom(t, usuarios)) return false;
    if (semReferencia) return true;
    return ids.has(norm(t.tecnico_id)) ||
      (t.tecnico_nome && nomes.has(norm(t.tecnico_nome)));
  });
}

// Filtra a lista de TecnicoFinanceiro deixando só quem deve aparecer.
// Remove: marcados como ocultos pelo ADM e ex-usuários (acesso removido).
// Ex-usuário com crédito pendente PERMANECE — o ADM precisa poder quitar.
// options.excluirAssalariados: também tira quem recebe salário fixo (Dashboard).
export function filtrarTecnicosAtivos(tecFins, usuarios, options = {}) {
  const { excluirAssalariados = false } = options;
  const lista = (tecFins || []).filter(t => t?.oculto !== true);

  const ids = new Set();
  const nomes = new Set();
  for (const u of usuarios || []) {
    if (u?.email) ids.add(norm(u.email));
    if (u?.full_name) nomes.add(norm(u.full_name));
  }
  const semReferencia = ids.size === 0; // query de User falhou → não filtra por vínculo

  return lista.filter(t => {
    if (excluirAssalariados && ehAssalariadoCom(t, usuarios)) return false;
    if (semReferencia) return true;
    const temUsuario = ids.has(norm(t.tecnico_id)) ||
      (t.tecnico_nome && nomes.has(norm(t.tecnico_nome)));
    if (temUsuario) return true;
    return (t.credito_pendente || 0) > 0.01;
  });
}

// Remove registros DUPLICADOS do mesmo técnico (mesma chave). Mantém o de
// maior movimento financeiro (crédito pago + total ganho + pendente) e, em
// empate, o mais antigo — os zerados extras são apagados.
// Duplicatas surgiam de chamadas simultâneas do provisionamento (ex.: página
// Financeiro e modal de pagamento montando juntos).
async function removerDuplicatas(tecFins) {
  const porChave = new Map();
  for (const t of tecFins || []) {
    const k = chaveTecFin(t);
    if (!k) continue;
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(t);
  }
  const peso = (t) => (t.credito_pago || 0) + (t.total_ganho || 0) + (t.credito_pendente || 0);
  let removidos = 0;
  const sobreviventes = [];
  for (const [, grupo] of porChave) {
    if (grupo.length === 1) { sobreviventes.push(grupo[0]); continue; }
    const ordenado = [...grupo].sort((a, b) => {
      const d = peso(b) - peso(a);
      if (Math.abs(d) > 0.001) return d;
      return new Date(a.created_date || 0) - new Date(b.created_date || 0);
    });
    sobreviventes.push(ordenado[0]);
    for (const extra of ordenado.slice(1)) {
      // Segurança: nunca apaga registro com movimento financeiro
      if (peso(extra) > 0.001) { sobreviventes.push(extra); continue; }
      try {
        await base44.entities.TecnicoFinanceiro.delete(extra.id);
        removidos++;
      } catch (e) {
        console.error('[tecnicosFinanceiro] falha ao remover duplicata', extra.id, e);
        sobreviventes.push(extra);
      }
    }
  }
  return { sobreviventes, removidos };
}

// Remove/marca cadastros de técnico que NÃO têm mais usuário no app (acesso
// removido). Regra de segurança: só APAGA quem está zerado; quem tem histórico
// financeiro é preservado no banco e apenas marcado como ex-usuário
// (_semUsuario), para as telas ocultarem sem perder o histórico de pagamentos.
async function tratarOrfaos(tecFins, users) {
  const idsUsuarios = new Set();
  const nomesUsuarios = new Set();
  for (const u of users || []) {
    if (u?.email) idsUsuarios.add(norm(u.email));
    if (u?.full_name) nomesUsuarios.add(norm(u.full_name));
  }
  // Sem lista de usuários confiável, não mexe em nada (evita falso positivo)
  if (idsUsuarios.size === 0) return { ativos: tecFins, removidos: 0 };

  const peso = (t) => (t.credito_pago || 0) + (t.total_ganho || 0) + (t.credito_pendente || 0);
  const ativos = [];
  let removidos = 0;
  for (const t of tecFins || []) {
    const temUsuario = idsUsuarios.has(norm(t.tecnico_id)) ||
      (t.tecnico_nome && nomesUsuarios.has(norm(t.tecnico_nome)));
    if (temUsuario) { ativos.push(t); continue; }

    if (peso(t) > 0.001) {
      // Tem histórico financeiro: NÃO apaga — só marca para as telas ocultarem
      ativos.push({ ...t, _semUsuario: true });
      continue;
    }
    try {
      await base44.entities.TecnicoFinanceiro.delete(t.id);
      removidos++;
    } catch (e) {
      console.error('[tecnicosFinanceiro] falha ao remover órfão', t.id, e);
      ativos.push({ ...t, _semUsuario: true });
    }
  }
  return { ativos, removidos };
}

// Trava de concorrência: as 3 chamadas do app podem disparar juntas (página
// Financeiro + modal de pagamento no mesmo mount). Sem isto, ambas liam
// "não existe" e criavam o MESMO técnico duas vezes.
let execucaoEmAndamento = null;

// Garante que TODO usuário técnico tenha um registro em TecnicoFinanceiro —
// sem ele, o técnico novo não aparece no modal de pagamento e fica DE FORA
// das comissões na conclusão (o fluxo itera TecnicoFinanceiro por equipe).
// - remove duplicatas zeradas do mesmo técnico;
// - cria com saldo zerado os que faltam (match por e-mail OU nome);
// - se o técnico mudou de equipe, atualiza equipe_id/equipe_nome do registro.
// Retorna { criados, atualizados, removidos }.
export function provisionarTecnicosFinanceiro(opts = {}) {
  // Reaproveita a execução em curso em vez de rodar em paralelo
  if (execucaoEmAndamento) return execucaoEmAndamento;
  execucaoEmAndamento = _provisionar(opts).finally(() => { execucaoEmAndamento = null; });
  return execucaoEmAndamento;
}

async function _provisionar({ apenasEquipeId = null, usuarios = null } = {}) {
  const [users, tecFinsBrutos] = await Promise.all([
    usuarios ? Promise.resolve(usuarios) : listAll('User'),
    listAll('TecnicoFinanceiro'),
  ]);
  const { sobreviventes, removidos: removidosDup } = await removerDuplicatas(tecFinsBrutos);
  // Só varre órfãos quando temos a lista COMPLETA de usuários (chamadas com
  // `usuarios` pré-filtrados não servem de referência para "quem não existe").
  const { ativos: tecFins, removidos: removidosOrfaos } = usuarios
    ? { ativos: sobreviventes, removidos: 0 }
    : await tratarOrfaos(sobreviventes, users);
  const removidos = removidosDup + removidosOrfaos;
  const tecnicosUsers = (users || []).filter(u =>
    ehTecnicoUser(u) && (!apenasEquipeId || u.equipe_id === apenasEquipeId));

  let criados = 0;
  let atualizados = 0;
  for (const u of tecnicosUsers) {
    const existente = (tecFins || []).find(t =>
      norm(t.tecnico_id) === norm(u.email) ||
      (t.tecnico_nome && u.full_name && norm(t.tecnico_nome) === norm(u.full_name)));

    // Espelha a forma de pagamento do User no TecnicoFinanceiro: os fluxos de
    // conclusão iteram TecnicoFinanceiro e assim filtram o assalariado sem
    // precisar consultar User de novo.
    const remuneracaoUser = (u.remuneracao || u.data?.remuneracao) === REMUNERACAO_FIXA
      ? REMUNERACAO_FIXA : 'comissao';

    try {
      if (!existente) {
        const novo = await base44.entities.TecnicoFinanceiro.create({
          tecnico_id: u.email,
          tecnico_nome: u.full_name || u.email,
          equipe_id: u.equipe_id,
          equipe_nome: u.equipe_nome || '',
          credito_pendente: 0,
          credito_pago: 0,
          total_ganho: 0,
          remuneracao: remuneracaoUser,
          data_ultima_atualizacao: new Date().toISOString(),
        });
        // Registra na lista local: sem isto, dois usuários que casassem com o
        // mesmo registro (ex.: mesmo nome) criariam duplicata no mesmo laço.
        if (novo) tecFins.push(novo);
        criados++;
      } else {
        // Técnico mudou de equipe — sem isto a conclusão (filter por equipe)
        // não o encontraria e ele ficaria sem comissão na equipe nova.
        const patch = {};
        if (existente.equipe_id !== u.equipe_id) {
          patch.equipe_id = u.equipe_id;
          patch.equipe_nome = u.equipe_nome || existente.equipe_nome || '';
        }
        if ((existente.remuneracao || 'comissao') !== remuneracaoUser) {
          patch.remuneracao = remuneracaoUser;
        }
        if (Object.keys(patch).length > 0) {
          patch.data_ultima_atualizacao = new Date().toISOString();
          await base44.entities.TecnicoFinanceiro.update(existente.id, patch);
          atualizados++;
        }
      }
    } catch (e) {
      console.error('[tecnicosFinanceiro] falha ao provisionar', u.email, e);
    }
  }
  return { criados, atualizados, removidos };
}
