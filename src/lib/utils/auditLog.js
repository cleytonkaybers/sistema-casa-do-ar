import { base44 } from '@/api/base44Client';
import { formatTipoServicoCompact } from '@/utils';

/**
 * Registra ação de auditoria
 */
export const logAudit = async ({
  acao,
  entidade,
  entidade_id,
  dados_antes,
  dados_depois,
  observacao,
  sucesso = true,
  erro = null,
}) => {
  try {
    const user = await base44.auth.me();
    
    await base44.entities.LogAuditoria.create({
      usuario_email: user.email,
      usuario_nome: user.full_name,
      acao,
      entidade,
      entidade_id,
      dados_antes: dados_antes ? JSON.stringify(dados_antes) : null,
      dados_depois: dados_depois ? JSON.stringify(dados_depois) : null,
      observacao,
      sucesso,
      erro,
    });
  } catch (error) {
    console.error('Erro ao registrar log de auditoria:', error);
  }
};

/**
 * Helper para registrar ações comuns
 */
export const auditActions = {
  criarCliente: (cliente) => 
    logAudit({ 
      acao: 'criar_cliente', 
      entidade: 'Cliente', 
      entidade_id: cliente.id,
      dados_depois: cliente,
    }),
    
  editarCliente: (antes, depois) =>
    logAudit({
      acao: 'editar_cliente',
      entidade: 'Cliente',
      entidade_id: depois.id,
      dados_antes: antes,
      dados_depois: depois,
    }),
    
  excluirCliente: (cliente) =>
    logAudit({
      acao: 'excluir_cliente',
      entidade: 'Cliente',
      entidade_id: cliente.id,
      dados_antes: cliente,
    }),
    
  concluirServico: (servico) =>
    logAudit({
      acao: 'concluir_servico',
      entidade: 'Servico',
      entidade_id: servico.id,
      observacao: `Serviço concluído: ${formatTipoServicoCompact(servico.tipo_servico)} - ${servico.cliente_nome}`,
    }),
    
  registrarPagamento: (pagamento) =>
    logAudit({
      acao: 'registrar_pagamento',
      entidade: 'PagamentoTecnico',
      entidade_id: pagamento.id,
      dados_depois: pagamento,
      observacao: `Pagamento de ${pagamento.valor_pago} para ${pagamento.tecnico_nome}`,
    }),
    
  estornarPagamento: (pagamento, motivo) =>
    logAudit({
      acao: 'estornar_pagamento',
      entidade: 'PagamentoTecnico',
      entidade_id: pagamento.id,
      observacao: `Estorno: ${motivo}`,
    }),
    
  exportarDados: (tipo) =>
    logAudit({
      acao: 'exportar_dados',
      observacao: `Exportação: ${tipo}`,
    }),
    
  backupManual: () =>
    logAudit({
      acao: 'backup_manual',
      observacao: 'Backup manual do sistema',
    }),
};