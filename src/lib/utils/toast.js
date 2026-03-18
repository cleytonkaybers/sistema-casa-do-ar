import { toast } from 'sonner';

/**
 * Notificações padronizadas
 */
export const showToast = {
  success: (message) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
    });
  },
  
  error: (message) => {
    toast.error(message || 'Ocorreu um erro. Tente novamente.', {
      duration: 4000,
      position: 'top-right',
    });
  },
  
  info: (message) => {
    toast.info(message, {
      duration: 3000,
      position: 'top-right',
    });
  },
  
  loading: (message) => {
    return toast.loading(message, {
      position: 'top-right',
    });
  },
  
  promise: (promise, messages) => {
    return toast.promise(promise, {
      loading: messages.loading || 'Carregando...',
      success: messages.success || 'Sucesso!',
      error: messages.error || 'Erro ao processar',
      position: 'top-right',
    });
  },
};

// Mensagens padronizadas comuns
export const toastMessages = {
  // CRUD
  created: (entity) => `${entity} criado com sucesso!`,
  updated: (entity) => `${entity} atualizado com sucesso!`,
  deleted: (entity) => `${entity} excluído com sucesso!`,
  
  // Erros
  error: {
    create: (entity) => `Erro ao criar ${entity}`,
    update: (entity) => `Erro ao atualizar ${entity}`,
    delete: (entity) => `Erro ao excluir ${entity}`,
    load: (entity) => `Erro ao carregar ${entity}`,
    network: 'Erro de conexão. Verifique sua internet.',
    permission: 'Você não tem permissão para esta ação',
  },
  
  // Específicos
  servico: {
    concluido: 'Serviço concluído com sucesso!',
    agendado: 'Serviço agendado!',
    cancelado: 'Serviço cancelado',
  },
  
  pagamento: {
    registrado: 'Pagamento registrado com sucesso!',
    estornado: 'Pagamento estornado',
  },
  
  comissao: {
    gerada: 'Comissão gerada com sucesso!',
    recalculada: 'Comissões recalculadas',
  },
};