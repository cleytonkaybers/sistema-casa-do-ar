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

// Garante que TODO usuário técnico tenha um registro em TecnicoFinanceiro —
// sem ele, o técnico novo não aparece no modal de pagamento e fica DE FORA
// das comissões na conclusão (o fluxo itera TecnicoFinanceiro por equipe).
// - cria com saldo zerado os que faltam (match por e-mail OU nome);
// - se o técnico mudou de equipe, atualiza equipe_id/equipe_nome do registro.
// Retorna { criados, atualizados }.
export async function provisionarTecnicosFinanceiro({ apenasEquipeId = null, usuarios = null } = {}) {
  const [users, tecFins] = await Promise.all([
    usuarios ? Promise.resolve(usuarios) : listAll('User'),
    listAll('TecnicoFinanceiro'),
  ]);
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
        await base44.entities.TecnicoFinanceiro.create({
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
  return { criados, atualizados };
}
