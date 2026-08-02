import { base44 } from '@/api/base44Client';
import { listAll } from '@/lib/utils/listAll';

const norm = (s) => (s || '').trim().toLowerCase();

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
  const { sobreviventes: tecFins, removidos } = await removerDuplicatas(tecFinsBrutos);
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
