import React, { useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Loader2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ServicoForm from '../components/servicos/ServicoForm';
import ServicoCard from '../components/servicos/ServicoCard';
import ReagendarModal from '../components/servicos/ReagendarModal';
import CompartilharModal from '../components/servicos/CompartilharModal';
import ConclusaoModal from '../components/servicos/ConclusaoModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { isApenasTiposIgnorados } from '@/lib/utils/tipoServico';
import { matchClienteSearch } from '@/lib/utils/buscaCliente';
import { calcularComissao } from '@/lib/comissao';

export default function ServicosPage() {
  const { hasPermission, isAdmin, user: currentUser, loading: loadingUser } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editingServico, setEditingServico] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [equipeFilter, setEquipeFilter] = useState('todas');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReagendarModal, setShowReagendarModal] = useState(false);
  const [servicoParaReagendar, setServicoParaReagendar] = useState(null);
  const [showCompartilharModal, setShowCompartilharModal] = useState(false);
  const [servicoConcluido, setServicoConcluido] = useState(null);
  const [showConclusaoModal, setShowConclusaoModal] = useState(false);
  const [servicoParaConcluir, setServicoParaConcluir] = useState(null);
  const [expandedDias, setExpandedDias] = useState({});
  const [servicoParaDeletar, setServicoParaDeletar] = useState(null);
  const [currentPageSemData, setCurrentPageSemData] = useState(1);
  // Por padrao mostra so a semana atual; toggle abre semanas futuras
  // (evita confusao do tecnico com servicos agendados pra proxima semana).
  const [verFuturos, setVerFuturos] = useState(false);
  const SERVICOS_POR_DIA = 5;
  const SERVICOS_POR_PAGINA = 20;

  const queryClient = useQueryClient();

  const { data: servicos = [], isLoading } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list('-created_date'),
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { sem_registro_cliente, ...servicoData } = data;
      const servico = await base44.entities.Servico.create(servicoData);

      // Trabalhos secundarios em BACKGROUND — nao bloqueia o "Salvo!".
      // O modal fecha imediatamente apos o create. Cliente automatico e
      // notificacoes aparecem em segundo plano via toast adicional.
      (async () => {
        // 1) Cadastro automatico de cliente (se nao for "sem_registro_cliente")
        if (!sem_registro_cliente) {
          try {
            const telefoneLimpo = data.telefone?.replace(/\D/g, '') || '';
            const nomeLower = data.cliente_nome?.trim().toLowerCase() || '';
            const [porTelefone, porNome] = await Promise.all([
              telefoneLimpo ? base44.entities.Cliente.filter({ telefone: data.telefone }) : Promise.resolve([]),
              base44.entities.Cliente.list(),
            ]);
            const jaExistePorTelefone = porTelefone.length > 0;
            const jaExistePorNome = porNome.some(c => c.nome?.trim().toLowerCase() === nomeLower);
            if (!jaExistePorTelefone && !jaExistePorNome) {
              await base44.entities.Cliente.create({
                nome: data.cliente_nome,
                telefone: data.telefone,
                endereco: data.endereco || '',
                latitude: data.latitude || null,
                longitude: data.longitude || null,
              });
              toast.success('Cliente cadastrado automaticamente!');
              queryClient.invalidateQueries({ queryKey: ['clientes'] });
            }
          } catch (err) {
            console.error('[Servicos] cadastro automatico cliente falhou:', err);
          }
        }

        // 2) Notificar membros da equipe (em paralelo)
        if (data.equipe_id) {
          try {
            const todosUsuarios = await base44.entities.User.list();
            const membrosDaEquipe = todosUsuarios.filter(u => u.equipe_id === data.equipe_id && u.email);
            await Promise.all(
              membrosDaEquipe.map(u =>
                base44.entities.Notificacao.create({
                  usuario_email: u.email,
                  tipo: 'atendimento_criado',
                  titulo: '🔧 Novo serviço atribuído',
                  mensagem: `${data.tipo_servico || 'Serviço'} para ${data.cliente_nome || 'cliente'}${data.data_programada ? ` em ${data.data_programada}` : ''}${data.horario ? ` às ${data.horario}` : ''}.`,
                  cliente_nome: data.cliente_nome || '',
                  atendimento_id: servico?.id || '',
                  lida: false,
                })
              )
            );
          } catch (err) {
            console.error('[Servicos] notificar equipe falhou:', err);
          }
        }
      })().catch(err => console.error('[Servicos] tarefa secundaria falhou:', err));

      return servico;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setShowForm(false);
      setEditingServico(null);
      toast.success('Serviço cadastrado com sucesso!');
    },
    onError: () => toast.error('Erro ao cadastrar serviço'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, servicoAnterior }) => {
      const result = await base44.entities.Servico.update(id, data);
      // Registrar no histórico de alterações
      try {
        const me = await base44.auth.me();
        const campos = Object.keys(data).filter(k => k !== 'usuario_atualizacao_status' && k !== 'data_atualizacao_status');
        if (campos.length > 0) {
          await base44.entities.LogAuditoria.create({
            usuario_email: me?.email || '',
            usuario_nome: me?.full_name || me?.email || '',
            acao: 'atualizar',
            entidade: 'Servico',
            entidade_id: id,
            dados_depois: JSON.stringify(data),
            observacao: campos.map(k => {
              const antes = servicoAnterior?.[k];
              const depois = data[k];
              return antes !== undefined && antes !== depois ? `${k}: "${antes}" → "${depois}"` : `${k}: "${depois}"`;
            }).join('; '),
            sucesso: true,
          });
        }
      } catch (_) {
        // Log failure must not block the update
      }
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['log_auditoria_servico', variables.id] });
      if (!variables.silencioso) {
        setShowForm(false);
        setEditingServico(null);
        toast.success('Serviço atualizado!');
      }
    },
    onError: () => toast.error('Erro ao atualizar serviço'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Servico.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Serviço excluído!');
    },
    onError: () => toast.error('Erro ao excluir serviço'),
  });

  const handleSave = async (data) => {
    try {
      if (editingServico) {
        await updateMutation.mutateAsync({ id: editingServico.id, data });
      } else {
        // Gerar número de OS automaticamente para novos serviços
        const maxOs = servicos
          .map(s => parseInt((s.os_numero || '').replace(/\D/g, '') || '0'))
          .reduce((max, n) => Math.max(max, n), 0);
        const os_numero = `OS-${String(maxOs + 1).padStart(4, '0')}`;
        await createMutation.mutateAsync({ ...data, os_numero });
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar serviço: ' + (error.message || 'Tente novamente'));
    }
  };

  const handleEdit = (servico) => {
    setEditingServico(servico);
    setShowForm(true);
  };

  const handleDelete = (servico) => {
    setServicoParaDeletar(servico);
  };

  const confirmarDelete = async () => {
    if (!servicoParaDeletar) return;
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(servicoParaDeletar.id);
    } finally {
      setIsDeleting(false);
      setServicoParaDeletar(null);
    }
  };

  const handleStatusChange = async (servico, novoStatus) => {
    const currentUser = await base44.auth.me();
    const statusAnterior = servico.status || 'aberto';
    
    if (novoStatus === 'agendado') {
      setServicoParaReagendar(servico);
      setShowReagendarModal(true);
    } else if (novoStatus === 'concluido') {
      setServicoParaConcluir(servico);
      setShowConclusaoModal(true);
    } else {
      await base44.entities.AlteracaoStatus.create({
        servico_id: servico.id,
        status_anterior: statusAnterior,
        status_novo: novoStatus,
        usuario: currentUser?.email,
        data_alteracao: new Date().toISOString(),
        tipo_registro: 'servico'
      });
      
      updateMutation.mutate({ 
        id: servico.id, 
        data: {
          status: novoStatus,
          usuario_atualizacao_status: currentUser?.email,
          data_atualizacao_status: new Date().toISOString()
        }
      });
      toast.success(`Status alterado para ${novoStatus}`);
    }
  };

  const handleConfirmarConclusao = async (observacoes, pagouDinheiro = false) => {
    if (!servicoParaConcluir) return;

    const servicoSnapshot = { ...servicoParaConcluir };

    // Helper: tenta uma operacao ate N vezes com delay entre tentativas.
    // Lanca erro se TODAS as tentativas falharem.
    const comRetry = async (label, fn, max = 3) => {
      for (let i = 1; i <= max; i++) {
        try { return await fn(); }
        catch (err) {
          if (i === max) {
            console.error(`[conclusao] ${label} falhou apos ${max} tentativas:`, err);
            throw err;
          }
          console.warn(`[conclusao] ${label} tentativa ${i} falhou, retry em 800ms...`, err?.message);
          await new Promise(r => setTimeout(r, 800));
        }
      }
    };

    try {
      const user = await base44.auth.me();
      const statusAnterior = servicoSnapshot.status || 'aberto';
      const agora = new Date().toISOString();

      // Servico que SO contem tipos ignorados (ex: "Ver defeito" sozinho) nao gera
      // atendimento, comissoes, historico nem preventiva. Mas se o tecnico editar
      // e adicionar outro servico (ex: "Ver defeito + Limpeza 9k"), gera tudo normal.
      const isVerDefeito = isApenasTiposIgnorados(servicoSnapshot.tipo_servico);

      // ===== PASSO 1: Atualizar Servico para concluido (BLOQUEANTE com retry) =====
      toast.info('⏳ Concluindo serviço...', { id: 'conclusao-progresso', duration: 30000 });
      await comRetry('servico-update', () => updateMutation.mutateAsync({
        id: servicoSnapshot.id,
        silencioso: true,
        data: {
          ...servicoSnapshot,
          status: 'concluido',
          observacoes_conclusao: observacoes,
          usuario_atualizacao_status: user?.email,
          data_atualizacao_status: agora,
        }
      }));
      queryClient.invalidateQueries({ queryKey: ['servicos'] });

      // ===== FLUXO VER-DEFEITO: cria Atendimento + deleta Servico (BLOQUEANTE) =====
      if (isVerDefeito) {
        toast.info('⏳ Registrando visita de verificação...', { id: 'conclusao-progresso', duration: 30000 });
        await comRetry('atendimento-verdefeito', () => base44.entities.Atendimento.create({
          servico_id: servicoSnapshot.id,
          os_numero: servicoSnapshot.os_numero || '',
          cliente_nome: servicoSnapshot.cliente_nome,
          cpf: servicoSnapshot.cpf || '',
          telefone: servicoSnapshot.telefone || '',
          endereco: servicoSnapshot.endereco || '',
          latitude: servicoSnapshot.latitude || null,
          longitude: servicoSnapshot.longitude || null,
          data_atendimento: servicoSnapshot.data_programada,
          horario: servicoSnapshot.horario || '',
          dia_semana: servicoSnapshot.dia_semana || '',
          tipo_servico: servicoSnapshot.tipo_servico,
          descricao: servicoSnapshot.descricao || '',
          valor: servicoSnapshot.valor || 0,
          observacoes_conclusao: observacoes || '',
          equipe_id: servicoSnapshot.equipe_id || '',
          equipe_nome: servicoSnapshot.equipe_nome || '',
          usuario_conclusao: user?.email,
          data_conclusao: agora,
          google_maps_link: servicoSnapshot.google_maps_link || '',
          detalhes: JSON.stringify({
            tipo_visita: 'verificacao_apenas',
            observacoes_conclusao: observacoes || null,
            usuario_conclusao: user?.email,
            data_conclusao: agora,
          }),
        }));
        await comRetry('servico-delete', () => base44.entities.Servico.delete(servicoSnapshot.id));
        queryClient.invalidateQueries({ queryKey: ['servicos'] });
        queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
        toast.dismiss('conclusao-progresso');
        toast.success('✅ Visita de verificação registrada (sem comissão).');
        setShowConclusaoModal(false);
        setServicoParaConcluir(null);
        return;
      }

      // ===== PASSO 2: Criar Atendimento (BLOQUEANTE com retry) =====
      toast.info('⏳ Criando atendimento...', { id: 'conclusao-progresso', duration: 30000 });
      const historicoStatus = await base44.entities.AlteracaoStatus
        .filter({ servico_id: servicoSnapshot.id }, 'data_alteracao').catch(() => []);
      const detalhesCompletos = {
        dados_ordem_servico: {
          id: servicoSnapshot.id,
          cliente_nome: servicoSnapshot.cliente_nome,
          cpf: servicoSnapshot.cpf || null,
          telefone: servicoSnapshot.telefone || null,
          endereco: servicoSnapshot.endereco || null,
          latitude: servicoSnapshot.latitude || null,
          longitude: servicoSnapshot.longitude || null,
          tipo_servico: servicoSnapshot.tipo_servico,
          descricao: servicoSnapshot.descricao || null,
          valor: servicoSnapshot.valor || 0,
          data_programada: servicoSnapshot.data_programada || null,
          horario: servicoSnapshot.horario || null,
          dia_semana: servicoSnapshot.dia_semana || null,
          equipe_id: servicoSnapshot.equipe_id || null,
          equipe_nome: servicoSnapshot.equipe_nome || null,
          google_maps_link: servicoSnapshot.google_maps_link || null,
          data_criacao: servicoSnapshot.created_date || null,
        },
        observacoes_conclusao: observacoes || null,
        usuario_conclusao: user?.email,
        data_conclusao: agora,
        historico_status: (historicoStatus || []).map(h => ({
          status_anterior: h.status_anterior,
          status_novo: h.status_novo,
          usuario: h.usuario,
          data_alteracao: h.data_alteracao,
        })),
      };
      const atendimentoCriado = await comRetry('atendimento-create', () =>
        base44.entities.Atendimento.create({
          servico_id: servicoSnapshot.id,
          os_numero: servicoSnapshot.os_numero || '',
          cliente_nome: servicoSnapshot.cliente_nome,
          cpf: servicoSnapshot.cpf || '',
          telefone: servicoSnapshot.telefone || '',
          endereco: servicoSnapshot.endereco || '',
          latitude: servicoSnapshot.latitude || null,
          longitude: servicoSnapshot.longitude || null,
          data_atendimento: servicoSnapshot.data_programada,
          horario: servicoSnapshot.horario || '',
          dia_semana: servicoSnapshot.dia_semana || '',
          tipo_servico: servicoSnapshot.tipo_servico,
          descricao: servicoSnapshot.descricao || '',
          valor: servicoSnapshot.valor || 0,
          observacoes_conclusao: observacoes || '',
          equipe_id: servicoSnapshot.equipe_id || '',
          equipe_nome: servicoSnapshot.equipe_nome || '',
          usuario_conclusao: user?.email,
          data_conclusao: agora,
          google_maps_link: servicoSnapshot.google_maps_link || '',
          detalhes: JSON.stringify(detalhesCompletos),
        })
      );

      // ===== PASSO 3: Gerar Comissao (BLOQUEANTE com retry) =====
      const comissaoHabilitada = servicoSnapshot.gerar_comissao !== false;
      let tecnicosComissionados = 0;
      if (comissaoHabilitada && servicoSnapshot.equipe_id && servicoSnapshot.valor && !servicoSnapshot.comissao_gerada) {
        toast.info('⏳ Lançando comissões dos técnicos...', { id: 'conclusao-progresso', duration: 30000 });
        const tecnicos = await base44.entities.TecnicoFinanceiro.filter({ equipe_id: servicoSnapshot.equipe_id });
        if (!tecnicos || tecnicos.length === 0) {
          toast.error(`⚠️ Comissão não gerada: nenhum técnico na equipe "${servicoSnapshot.equipe_nome || servicoSnapshot.equipe_id}"`);
        } else {
          const valorTotal = servicoSnapshot.valor;
          const comissao = await calcularComissao(servicoSnapshot.tipo_servico, valorTotal, queryClient);
          const valorComissaoTecnico = comissao.valor_comissao_tecnico;
          for (const tec of tecnicos) {
            // Dedup
            const ja = await base44.entities.LancamentoFinanceiro
              .filter({ servico_id: servicoSnapshot.id, tecnico_id: tec.tecnico_id })
              .catch(() => []);
            if (ja && ja.length > 0) continue;
            await comRetry(`lancamento-${tec.tecnico_id}`, () =>
              base44.entities.LancamentoFinanceiro.create({
                servico_id: servicoSnapshot.id,
                equipe_id: servicoSnapshot.equipe_id,
                equipe_nome: servicoSnapshot.equipe_nome || '',
                tecnico_id: tec.tecnico_id,
                tecnico_nome: tec.tecnico_nome,
                cliente_nome: servicoSnapshot.cliente_nome,
                tipo_servico: servicoSnapshot.tipo_servico,
                valor_total_servico: valorTotal,
                percentual_equipe: comissao.percentual_equipe,
                valor_comissao_equipe: comissao.valor_comissao_equipe,
                percentual_tecnico: comissao.percentual_tecnico,
                valor_comissao_tecnico: valorComissaoTecnico,
                status: 'pendente',
                data_geracao: agora,
                usuario_geracao: user?.email,
              })
            );
            await comRetry(`tecnico-fin-${tec.tecnico_id}`, () =>
              base44.entities.TecnicoFinanceiro.update(tec.id, {
                credito_pendente: (tec.credito_pendente || 0) + valorComissaoTecnico,
                total_ganho: (tec.total_ganho || 0) + valorComissaoTecnico,
                data_ultima_atualizacao: agora,
              })
            );
            tecnicosComissionados++;
          }
          await base44.entities.Servico.update(servicoSnapshot.id, { comissao_gerada: true }).catch(() => {});
        }
      }

      // ===== PASSO 4: Criar PagamentoCliente (BLOQUEANTE com retry) =====
      toast.info('⏳ Registrando pagamento do cliente...', { id: 'conclusao-progresso', duration: 30000 });
      const jaExistePag = await base44.entities.PagamentoCliente
        .filter({ atendimento_id: atendimentoCriado?.id })
        .catch(() => []);
      if (!jaExistePag || jaExistePag.length === 0) {
        // 5.55 = valor sinalizador de "aguardando precificacao do ADM"
        const valorPag = (servicoSnapshot.valor && servicoSnapshot.valor > 1) ? servicoSnapshot.valor : 5.55;
        await comRetry('pagamento-create', () =>
          base44.entities.PagamentoCliente.create({
            atendimento_id: atendimentoCriado?.id || '',
            servico_id: servicoSnapshot.id,
            cliente_nome: servicoSnapshot.cliente_nome || '',
            telefone: servicoSnapshot.telefone || '',
            tipo_servico: servicoSnapshot.tipo_servico || '',
            data_conclusao: agora,
            valor_total: valorPag,
            valor_pago: 0,
            status: 'pendente',
            equipe_nome: servicoSnapshot.equipe_nome || '',
            historico_pagamentos: [],
          })
        );
      }

      // ===== PASSO 5: Atualizar Preventiva do Cliente (BLOQUEANTE) =====
      if (!servicoSnapshot.sem_registro_cliente) {
        toast.info('⏳ Atualizando preventiva...', { id: 'conclusao-progresso', duration: 30000 });
        try {
          const todosClientes = await base44.entities.Cliente.list();
          const telefoneLimpo = (servicoSnapshot.telefone || '').replace(/\D/g, '');
          const nomeNormalizado = (servicoSnapshot.cliente_nome || '').trim().toLowerCase();
          let clienteMatch = null;
          if (telefoneLimpo) {
            clienteMatch = todosClientes.find(c => (c.telefone || '').replace(/\D/g, '') === telefoneLimpo);
          }
          if (!clienteMatch && nomeNormalizado) {
            clienteMatch = todosClientes.find(c => (c.nome || '').trim().toLowerCase() === nomeNormalizado);
          }
          if (clienteMatch) {
            const dataConc = servicoSnapshot.data_programada || new Date().toISOString().split('T')[0];
            const proxima = new Date(dataConc);
            proxima.setMonth(proxima.getMonth() + 6);
            await base44.entities.Cliente.update(clienteMatch.id, {
              ultima_manutencao: dataConc,
              proxima_manutencao: proxima.toISOString().split('T')[0],
            });
          }
        } catch (err) {
          console.warn('[conclusao] preventiva nao atualizada (nao bloqueia):', err?.message);
        }
      }

      // ===== TUDO CRITICO OK — fecha modal e mostra sucesso =====
      toast.dismiss('conclusao-progresso');
      setShowConclusaoModal(false);
      setServicoParaConcluir(null);
      setServicoConcluido({ ...servicoSnapshot, observacoes_conclusao: observacoes, isConclusao: true });
      setShowCompartilharModal(true);
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
      queryClient.invalidateQueries({ queryKey: ['pagamentos-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentosFinanceiros'] });
      queryClient.invalidateQueries({ queryKey: ['tecnicosFinanceiros'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      const detalhesSucesso = [`✅ Serviço concluído`];
      if (tecnicosComissionados > 0) detalhesSucesso.push(`💰 ${tecnicosComissionados} comissão(ões)`);
      detalhesSucesso.push('💳 Pagamento registrado');
      toast.success(detalhesSucesso.join(' · '));

      // ===== BACKGROUND: operacoes nao-criticas (nao bloqueiam UI) =====
      // AlteracaoStatus, Notificacao para ADMs, Notificacao de pagamento em dinheiro
      Promise.all([
        base44.entities.AlteracaoStatus.create({
          servico_id: servicoSnapshot.id,
          status_anterior: statusAnterior,
          status_novo: 'concluido',
          usuario: user?.email,
          data_alteracao: agora,
          tipo_registro: 'servico'
        }).catch(err => console.error('Erro AlteracaoStatus:', err)),
        (async () => {
          try {
            const admins = (usuarios || []).filter(u => u?.role === 'admin' && u?.email);
            if (admins.length === 0) return;
            await Promise.all(admins.map(adm =>
              base44.entities.Notificacao.create({
                usuario_email: adm.email,
                titulo: '💲 Definir preço do serviço',
                mensagem: `Serviço de "${servicoSnapshot.tipo_servico || 'tipo nao informado'}" para ${servicoSnapshot.cliente_nome || 'cliente'} concluído. Defina o preço em Pagamentos de Clientes.`,
                tipo: 'pagamento_agendado',
                atendimento_id: servicoSnapshot.id,
                cliente_nome: servicoSnapshot.cliente_nome || '',
                lida: false,
              })
            ));
            queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
          } catch (err) { console.error('Erro ao notificar ADMs:', err); }
        })(),
        (pagouDinheiro ? base44.functions.invoke('notificarPagamentoDinheiro', {
          cliente_nome: servicoSnapshot.cliente_nome,
          tipo_servico: servicoSnapshot.tipo_servico,
          valor: servicoSnapshot.valor,
          atendimento_id: servicoSnapshot.id,
        }).catch(err => console.error('Erro notificar dinheiro:', err)) : Promise.resolve()),
      ]).catch(err => console.error('Erro em background:', err));

    } catch (error) {
      toast.dismiss('conclusao-progresso');
      console.error('Erro ao concluir serviço:', error);
      toast.error(`⚠️ Falha ao concluir: ${error?.message || 'tente novamente'}. Use o botão "Verificar faltantes" em Pagamentos.`, { duration: 12000 });
    }
  };

  const handleReagendar = async (novaData, horario) => {
    if (!servicoParaReagendar) return;
    
    try {
      const currentUser = await base44.auth.me();
      const statusAnterior = servicoParaReagendar.status || 'aberto';
      const novoStatus = (statusAnterior === 'agendado' || statusAnterior === 'reagendado') ? 'reagendado' : 'agendado';
      
      const dataObj = parseISO(novaData);
      const diaSemanaFormatado = format(dataObj, 'EEEE', { locale: ptBR });
      const diaSemana = diaSemanaFormatado.charAt(0).toUpperCase() + diaSemanaFormatado.slice(1);
      
      // Registrar alteração de status em background
      base44.entities.AlteracaoStatus.create({
        servico_id: servicoParaReagendar.id,
        status_anterior: statusAnterior,
        status_novo: novoStatus,
        usuario: currentUser?.email,
        data_alteracao: new Date().toISOString(),
        tipo_registro: 'servico'
      }).catch(err => console.error('Erro ao registrar alteração:', err));
      
      // Atualizar serviço
      await updateMutation.mutateAsync({ 
        id: servicoParaReagendar.id, 
        data: { 
          data_programada: novaData,
          horario: horario,
          dia_semana: diaSemana,
          status: novoStatus,
          usuario_atualizacao_status: currentUser?.email,
          data_atualizacao_status: new Date().toISOString()
        } 
      });
      
      setShowReagendarModal(false);
      setServicoParaReagendar(null);
      toast.success(`Serviço ${novoStatus} com sucesso! 📅`);
    } catch (error) {
      console.error('Erro ao reagendar:', error);
      toast.error('Erro ao reagendar serviço: ' + (error.message || 'Tente novamente'));
    }
  };

  // equipe_id vem direto do auth.me() — sem depender da lista de usuários
  const equipeIdUsuario = currentUser?.equipe_id || null;

  const filteredServicos = servicos.filter(s => {
    if (loadingUser) return false;
    if (!isAdmin) {
      if (equipeIdUsuario) {
        if (s.equipe_id !== equipeIdUsuario) return false;
      } else {
        if (s.equipe_id) return false;
      }
    }

    // Filtro de equipe para admin
    if (isAdmin && equipeFilter !== 'todas') {
      if (s.equipe_id !== equipeFilter) return false;
    }

    // Serviços concluídos nunca aparecem na agenda
    if (s.status === 'concluido') return false;

    // Serviços abertos ou em andamento ficam SEMPRE na agenda, independente da data
    if (s.status === 'aberto' || s.status === 'andamento') {
      return matchClienteSearch(s.cliente_nome, s.telefone, debouncedSearch);
    }

    // Serviços agendados/reagendados: mostrar os de hoje em diante E os em atraso (ainda não concluídos)
    // Serviços em atraso ficam visíveis até serem concluídos ou reagendados
    return matchClienteSearch(s.cliente_nome, s.telefone, debouncedSearch);
  });

  // Separa por semana: semana atual (default), futuros (toggle) e atrasados (sempre visiveis)
  const inicioSemanaAtual = startOfWeek(new Date(), { weekStartsOn: 1 });
  const fimSemanaAtual = endOfWeek(new Date(), { weekStartsOn: 1 });

  const servicosTodos = filteredServicos.filter(s => s.data_programada);
  const servicosSemData = filteredServicos.filter(s => !s.data_programada);

  // Atrasados (data passada, nao concluido) sempre aparecem na semana atual
  // para nao serem esquecidos. Futuros so aparecem quando o toggle esta ativo.
  const servicosSemanaAtual = servicosTodos.filter(s => {
    try {
      const d = parseISO(s.data_programada);
      // Inclui semana atual + qualquer servico atrasado (data < inicio da semana)
      return isWithinInterval(d, { start: inicioSemanaAtual, end: fimSemanaAtual })
        || d < inicioSemanaAtual;
    } catch { return false; }
  });
  const servicosFuturos = servicosTodos.filter(s => {
    try {
      const d = parseISO(s.data_programada);
      return isAfter(d, fimSemanaAtual);
    } catch { return false; }
  });

  // Lista renderizada nos cards de dia depende do toggle
  const servicosComData = verFuturos ? servicosFuturos : servicosSemanaAtual;

  // Reset page when filter changes
  React.useEffect(() => { setCurrentPageSemData(1); setExpandedDias({}); }, [debouncedSearch, equipeFilter]);

  const totalPagesSemData = Math.ceil(servicosSemData.length / SERVICOS_POR_PAGINA);
  const paginatedSemData = servicosSemData.slice(
    (currentPageSemData - 1) * SERVICOS_POR_PAGINA,
    currentPageSemData * SERVICOS_POR_PAGINA
  );

  const servicosPorDia = servicosComData.reduce((acc, servico) => {
    const diaSemana = servico.dia_semana || 'Sem dia';
    
    if (!acc[diaSemana]) {
      acc[diaSemana] = [];
    }
    
    acc[diaSemana].push(servico);
    return acc;
  }, {});

  const parseHorario = (h) => {
    if (!h || !h.trim() || !h.includes(':')) return Infinity;
    const [hh, mm] = h.trim().split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  };

  Object.keys(servicosPorDia).forEach(dia => {
    servicosPorDia[dia].sort((a, b) => parseHorario(a.horario) - parseHorario(b.horario));
  });

  const diasDaSemana = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Domingo'
  ];

  const diaColors = {
    'Segunda-feira': 'from-blue-500 to-blue-600',
    'Terça-feira': 'from-green-500 to-green-600',
    'Quarta-feira': 'from-yellow-500 to-yellow-600',
    'Quinta-feira': 'from-orange-500 to-orange-600',
    'Sexta-feira': 'from-purple-500 to-purple-600',
    'Sábado': 'from-pink-500 to-pink-600',
    'Domingo': 'from-red-500 to-red-600'
  };

  return (
    <div className="space-y-6">


      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-200">Serviços</h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">
            {verFuturos
              ? `Mostrando serviços agendados para semanas futuras (${servicosFuturos.length})`
              : `Mostrando semana atual: ${format(inicioSemanaAtual, "dd/MM", { locale: ptBR })} – ${format(fimSemanaAtual, "dd/MM", { locale: ptBR })}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            onClick={() => setVerFuturos(v => !v)}
            variant="outline"
            className={`h-10 text-xs font-semibold rounded-xl border ${
              verFuturos
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                : 'bg-[#0f1a2b] border-white/10 text-gray-300 hover:bg-white/5'
            }`}
            title={verFuturos ? 'Voltar para a semana atual' : 'Ver serviços agendados para próximas semanas'}
          >
            <Calendar className="w-4 h-4 mr-1.5" />
            {verFuturos
              ? '← Semana Atual'
              : `Próximas semanas${servicosFuturos.length > 0 ? ` (${servicosFuturos.length})` : ''}`}
          </Button>
          <Button
            onClick={() => {
              setEditingServico(null);
              setShowForm(true);
            }}
            className="text-white font-bold" style={{background: 'linear-gradient(135deg, #1e40af, #f59e0b)'}}
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Serviço
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 bg-[#0f1a2b] border-white/10 text-gray-200 placeholder:text-gray-500"
          />
        </div>
        {isAdmin && (
          <Select value={equipeFilter} onValueChange={setEquipeFilter}>
            <SelectTrigger className="w-full sm:w-48 h-11 bg-[#0f1a2b] border-white/10 text-gray-200">
              <SelectValue placeholder="Todas as Equipes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Equipes</SelectItem>
              {equipes.map(equipe => (
                <SelectItem key={equipe.id} value={equipe.id}>
                  {equipe.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading || (loadingUser && !isAdmin) ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredServicos.length === 0 ? (
        <div className="text-center py-12 rounded-xl border-2 border-dashed border-white/10 bg-[#152236]">
          <p className="text-gray-400">
            {searchTerm || (isAdmin && equipeFilter !== 'todas')
              ? 'Nenhum serviço encontrado com esses filtros'
              : 'Nenhum serviço cadastrado ainda'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
            {diasDaSemana.map(dia => {
              const servicosDoDia = servicosPorDia[dia] || [];
              const isExpanded = !!expandedDias[dia];
              const visiveis = isExpanded ? servicosDoDia : servicosDoDia.slice(0, SERVICOS_POR_DIA);
              const extras = servicosDoDia.length - SERVICOS_POR_DIA;

              return (
                <div key={dia} className="rounded-xl shadow-sm border border-white/5 overflow-hidden flex flex-col h-full bg-[#152236]">
                  <div className={`bg-gradient-to-r ${diaColors[dia]} px-4 py-3 sticky top-0 z-10`}>
                    <h3 className="font-bold text-white text-center text-sm lg:text-base">
                      {dia}
                    </h3>
                    <p className="text-white/90 text-center text-xs mt-1">
                      {servicosDoDia.length} {servicosDoDia.length === 1 ? 'serviço' : 'serviços'}
                    </p>
                  </div>

                  <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                    {servicosDoDia.length === 0 ? (
                      <p className="text-gray-500 text-center text-sm py-4">
                        Nenhum serviço
                      </p>
                    ) : (
                      <>
                        {visiveis.map(servico => (
                          <div key={servico.id} className="rounded-lg shadow-sm border border-white/5 overflow-hidden bg-[#0f1a2b]">
                            <div className="p-3">
                              <ServicoCard
                                servico={servico}
                                onEdit={handleEdit}
                                onDelete={(isAdmin || hasPermission('servicos_deletar')) ? handleDelete : undefined}
                                onStatusChange={handleStatusChange}
                                onShare={(servico) => {
                                  setServicoConcluido({ ...servico, isConclusao: false });
                                  setShowCompartilharModal(true);
                                }}
                                equipes={equipes}
                                compact
                              />
                            </div>
                          </div>
                        ))}
                        {extras > 0 && (
                          <button
                            onClick={() => setExpandedDias(prev => ({ ...prev, [dia]: !isExpanded }))}
                            className="w-full text-xs font-semibold text-center py-2 rounded-lg border border-dashed border-white/15 text-gray-400 hover:border-blue-500/50 hover:text-blue-300 transition-colors"
                          >
                            {isExpanded ? 'Ver menos' : `Ver mais ${extras}`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {servicosSemData.length > 0 && (
            <div className="rounded-xl shadow-sm border border-white/5 overflow-hidden bg-[#152236]">
              <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#1e3a8a' }}>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-white" />
                  <h3 className="font-bold text-white">Sem Data Programada</h3>
                </div>
                <Badge className="bg-white/20 text-white border-white/30">
                  {servicosSemData.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {paginatedSemData.map(servico => (
                  <ServicoCard
                    key={servico.id}
                    servico={servico}
                    onEdit={handleEdit}
                    onDelete={(isAdmin || hasPermission('servicos_deletar')) ? handleDelete : undefined}
                    onStatusChange={handleStatusChange}
                    onShare={(s) => {
                      setServicoConcluido({ ...s, isConclusao: false });
                      setShowCompartilharModal(true);
                    }}
                    equipes={equipes}
                  />
                ))}
              </div>
              {totalPagesSemData > 1 && (
                <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-white/5">
                  <button
                    onClick={() => setCurrentPageSemData(p => Math.max(1, p - 1))}
                    disabled={currentPageSemData === 1}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/10 text-gray-300 hover:border-blue-500/50 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-[#0f1a2b]"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-gray-400">
                    {currentPageSemData} / {totalPagesSemData}
                  </span>
                  <button
                    onClick={() => setCurrentPageSemData(p => Math.min(totalPagesSemData, p + 1))}
                    disabled={currentPageSemData === totalPagesSemData}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/10 text-gray-300 hover:border-blue-500/50 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-[#0f1a2b]"
                  >
                    Próxima
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ServicoForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingServico(null);
        }}
        onSave={handleSave}
        servico={editingServico}
        isLoading={createMutation.isPending || updateMutation.isPending}
        equipes={equipes}
        currentUserEquipeId={equipeIdUsuario}
        isAdmin={isAdmin}
      />

      <ReagendarModal
        open={showReagendarModal}
        onClose={() => {
          setShowReagendarModal(false);
          setServicoParaReagendar(null);
        }}
        onSave={handleReagendar}
        servico={servicoParaReagendar}
        isLoading={updateMutation.isPending}
      />

      <CompartilharModal
        open={showCompartilharModal}
        onClose={() => {
          setShowCompartilharModal(false);
          setServicoConcluido(null);
        }}
        servico={servicoConcluido}
        isConclusao={servicoConcluido?.isConclusao}
      />

      <ConclusaoModal
        open={showConclusaoModal}
        onClose={() => {
          setShowConclusaoModal(false);
          setServicoParaConcluir(null);
        }}
        onConfirm={handleConfirmarConclusao}
        servico={servicoParaConcluir}
        isLoading={updateMutation.isPending}
      />

      <ConfirmDialog
        open={!!servicoParaDeletar}
        onClose={() => !isDeleting && setServicoParaDeletar(null)}
        onConfirm={confirmarDelete}
        title="Excluir serviço"
        description={servicoParaDeletar ? `Excluir serviço de ${servicoParaDeletar.cliente_nome}? Esta ação não pode ser desfeita.` : ''}
        confirmText="Excluir"
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}