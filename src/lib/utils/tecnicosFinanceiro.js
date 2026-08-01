import { base44 } from '@/api/base44Client';
import { listAll } from '@/lib/utils/listAll';

const norm = (s) => (s || '').trim().toLowerCase();

// Usuário conta como técnico quando tem equipe e é tipo 'tecnico'
// (ou role 'user' legado sem tipo_usuario definido).
export const ehTecnicoUser = (u) =>
  !!u?.equipe_id && (u.tipo_usuario === 'tecnico' || (!u.tipo_usuario && u.role === 'user'));

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
          data_ultima_atualizacao: new Date().toISOString(),
        });
        criados++;
      } else if (existente.equipe_id !== u.equipe_id) {
        // Técnico mudou de equipe — sem isto a conclusão (filter por equipe)
        // não o encontraria e ele ficaria sem comissão na equipe nova.
        await base44.entities.TecnicoFinanceiro.update(existente.id, {
          equipe_id: u.equipe_id,
          equipe_nome: u.equipe_nome || existente.equipe_nome || '',
          data_ultima_atualizacao: new Date().toISOString(),
        });
        atualizados++;
      }
    } catch (e) {
      console.error('[tecnicosFinanceiro] falha ao provisionar', u.email, e);
    }
  }
  return { criados, atualizados };
}
