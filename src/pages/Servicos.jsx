import React, { useState } from 'react';
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
import AlertaAtraso from '../components/servicos/AlertaAtraso';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, isSameMonth, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePermissions } from '@/components/auth/PermissionGuard';

export default function ServicosPage() {
  const { hasPermission, isAdmin } = usePermissions();
  const [currentUser, setCurrentUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingServico, setEditingServico] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReagendarModal, setShowReagendarModal] = useState(false);
  const [servicoParaReagendar, setServicoParaReagendar] = useState(null);
  const [showCompartilharModal, setShowCompartilharModal] = useState(false);
  const [servicoConcluido, setServicoConcluido] = useState(null);
  const [showConclusaoModal, setShowConclusaoModal] = useState(false);
  const [servicoParaConcluir, setServicoParaConcluir] = useState(null);

  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

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
      const servico = await base44.entities.Servico.create(data);
      
      // Verificar duplicata por telefone OU por nome (normalizado)
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
      }
      
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
    mutationFn: ({ id, data }) => base44.entities.Servico.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      setShowForm(false);
      setEditingServico(null);
      toast.success('Serviço atualizado!');
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
        await createMutation.mutateAsync(data);
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

  const handleDelete = async (servico) => {
    if (confirm(`Excluir serviço de ${servico.cliente_nome}?`)) {
      setIsDeleting(true);
      await deleteMutation.mutateAsync(servico.id);
      setIsDeleting(false);
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

  const handleConfirmarConclusao = async (observacoes) => {
    if (!servicoParaConcluir) return;
    
    const currentUser = await base44.auth.me();
    const statusAnterior = servicoParaConcluir.status || 'aberto';
    
    const updateData = {
      ...servicoParaConcluir,
      status: 'concluido',
      observacoes_conclusao: observacoes,
      usuario_atualizacao_status: currentUser?.email,
      data_atualizacao_status: new Date().toISOString()
    };

    await base44.entities.AlteracaoStatus.create({
      servico_id: servicoParaConcluir.id,
      status_anterior: statusAnterior,
      status_novo: 'concluido',
      usuario: currentUser?.email,
      data_alteracao: new Date().toISOString(),
      tipo_registro: 'servico'
    });

    updateMutation.mutate({ 
      id: servicoParaConcluir.id, 
      data: updateData
    }, {
      onSuccess: async () => {
        await base44.entities.Atendimento.create({
          cliente_nome: servicoParaConcluir.cliente_nome,
          data_atendimento: servicoParaConcluir.data_programada,
          tipo_servico: servicoParaConcluir.tipo_servico,
          descricao: servicoParaConcluir.descricao || '',
          valor: servicoParaConcluir.valor || 0,
          status: 'Concluído',
          observacoes: observacoes || '',
          usuario_atualizacao_status: currentUser?.email,
          data_atualizacao_status: new Date().toISOString()
        });

        // Gerar preventiva futura: atualiza última manutenção e define próxima 6 meses à frente
        const dataConc = servicoParaConcluir.data_programada || new Date().toISOString().split('T')[0];
        const proxima = new Date(dataConc);
        proxima.setMonth(proxima.getMonth() + 6);
        const proximaStr = proxima.toISOString().split('T')[0];

        const clientesMatch = await base44.entities.Cliente.filter({ telefone: servicoParaConcluir.telefone });
        if (clientesMatch.length > 0) {
          await base44.entities.Cliente.update(clientesMatch[0].id, {
            ultima_manutencao: dataConc,
            proxima_manutencao: proximaStr
          });
          queryClient.invalidateQueries({ queryKey: ['clientes'] });
        }

        // Remover notificações de atraso relacionadas a este serviço
        const notifRelacionadas = await base44.entities.Notificacao.filter({ atendimento_id: servicoParaConcluir.id });
        for (const notif of notifRelacionadas) {
          await base44.entities.Notificacao.delete(notif.id);
        }

        queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
        queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
        
        setShowConclusaoModal(false);
        setServicoConcluido({ ...servicoParaConcluir, observacoes_conclusao: observacoes, isConclusao: true });
        setShowCompartilharModal(true);
        setServicoParaConcluir(null);
        toast.success('Serviço concluído! Preventiva gerada para 6 meses. 🎉');
      }
    });
  };

  const handleReagendar = async (novaData, horario) => {
    if (!servicoParaReagendar) return;
    
    const currentUser = await base44.auth.me();
    const statusAnterior = servicoParaReagendar.status || 'aberto';
    const novoStatus = (statusAnterior === 'agendado' || statusAnterior === 'reagendado') ? 'reagendado' : 'agendado';
    
    const dataObj = parseISO(novaData);
    const diaSemanaFormatado = format(dataObj, 'EEEE', { locale: ptBR });
    const diaSemana = diaSemanaFormatado.charAt(0).toUpperCase() + diaSemanaFormatado.slice(1);
    
    await base44.entities.AlteracaoStatus.create({
      servico_id: servicoParaReagendar.id,
      status_anterior: statusAnterior,
      status_novo: novoStatus,
      usuario: currentUser?.email,
      data_alteracao: new Date().toISOString(),
      tipo_registro: 'servico'
    });
    
    updateMutation.mutate({ 
      id: servicoParaReagendar.id, 
      data: { 
        ...servicoParaReagendar, 
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
  };

  const today = startOfDay(new Date());

  // Determina a equipe do usuário logado
  const usuarioLogado = usuarios.find(u => u.email === currentUser?.email);
  const equipeIdUsuario = usuarioLogado?.equipe_id || null;

  const filteredServicos = servicos.filter(s => {
    // Filtro por equipe: admin vê tudo, não-admin só vê da sua equipe (ou sem equipe se não tem equipe)
    if (!isAdmin) {
      if (equipeIdUsuario) {
        // Usuário tem equipe: só vê serviços da sua equipe
        if (s.equipe_id && s.equipe_id !== equipeIdUsuario) return false;
      }
    }
    // Serviços concluídos nunca aparecem na agenda
    if (s.status === 'concluido') return false;

    // Serviços abertos ou em andamento ficam SEMPRE na agenda, independente da data
    if (s.status === 'aberto' || s.status === 'andamento') {
      const matchSearch = s.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         s.telefone?.includes(searchTerm);
      const matchTipo = tipoFilter === 'todos' || s.tipo_servico === tipoFilter;
      return matchSearch && matchTipo;
    }

    // Serviços agendados/reagendados: mostrar apenas os de hoje em diante
    if (s.data_programada) {
      const dataServico = startOfDay(parseISO(s.data_programada));
      if (isBefore(dataServico, today)) return false;
    }

    const matchSearch = s.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       s.telefone?.includes(searchTerm);
    const matchTipo = tipoFilter === 'todos' || s.tipo_servico === tipoFilter;
    
    return matchSearch && matchTipo;
  });

  const servicosComData = filteredServicos.filter(s => s.data_programada);
  const servicosSemData = filteredServicos.filter(s => !s.data_programada);

  const servicosPorDia = servicosComData.reduce((acc, servico) => {
    const diaSemana = servico.dia_semana || 'Sem dia';
    
    if (!acc[diaSemana]) {
      acc[diaSemana] = [];
    }
    
    acc[diaSemana].push(servico);
    return acc;
  }, {});

  Object.keys(servicosPorDia).forEach(dia => {
    servicosPorDia[dia].sort((a, b) => {
      const dateA = new Date(a.data_programada);
      const dateB = new Date(b.data_programada);
      
      if (dateA < dateB) return -1;
      if (dateA > dateB) return 1;
      
      if (a.horario && !b.horario) return -1;
      if (!a.horario && b.horario) return 1;
      
      if (a.horario && b.horario) {
        return a.horario.localeCompare(b.horario);
      }
      
      return 0;
    });
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
      <AlertaAtraso />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Serviços</h1>
          <p className="text-gray-500 mt-1">Gerencie serviços diários e semanais</p>
        </div>
        {(isAdmin || hasPermission('servicos_criar')) && (
          <Button
            onClick={() => {
              setEditingServico(null);
              setShowForm(true);
            }}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Serviço
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-full sm:w-48 h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tipos</SelectItem>
            <SelectItem value="Limpeza de 9k">Limpeza de 9k</SelectItem>
            <SelectItem value="Limpeza de 12k">Limpeza de 12k</SelectItem>
            <SelectItem value="Limpeza de 18k">Limpeza de 18k</SelectItem>
            <SelectItem value="Limpeza de 22 a 24k">Limpeza de 22 a 24k</SelectItem>
            <SelectItem value="Limpeza de 24k">Limpeza de 24k</SelectItem>
            <SelectItem value="Limpeza de 30 a 32k">Limpeza de 30 a 32k</SelectItem>
            <SelectItem value="Limpeza piso e teto">Limpeza piso e teto</SelectItem>
            <SelectItem value="Instalação de 9k">Instalação de 9k</SelectItem>
            <SelectItem value="Instalação de 12k">Instalação de 12k</SelectItem>
            <SelectItem value="Instalação de 18k">Instalação de 18k</SelectItem>
            <SelectItem value="Instalação de 22 a 24k">Instalação de 22 a 24k</SelectItem>
            <SelectItem value="Instalação de 24k">Instalação de 24k</SelectItem>
            <SelectItem value="Instalação de 30 a 32k">Instalação de 30 a 32k</SelectItem>
            <SelectItem value="Instalação piso e teto">Instalação piso e teto</SelectItem>
            <SelectItem value="Troca de capacitor">Troca de capacitor</SelectItem>
            <SelectItem value="Recarga de gás">Recarga de gás</SelectItem>
            <SelectItem value="Carga de gás completa">Carga de gás completa</SelectItem>
            <SelectItem value="Serviço de solda">Serviço de solda</SelectItem>
            <SelectItem value="Troca de relé da placa">Troca de relé da placa</SelectItem>
            <SelectItem value="Troca de sensor">Troca de sensor</SelectItem>
            <SelectItem value="Troca de chave contadora">Troca de chave contadora</SelectItem>
            <SelectItem value="Conserto de placa eletrônica">Conserto de placa eletrônica</SelectItem>
            <SelectItem value="Retirada de ar condicionado">Retirada de ar condicionado</SelectItem>
            <SelectItem value="Serviço de passar tubulação de infra">Serviço de passar tubulação de infra</SelectItem>
            <SelectItem value="Ver defeito">Ver defeito</SelectItem>
            <SelectItem value="Troca de local">Troca de local</SelectItem>
            <SelectItem value="Outro tipo de serviço">Outro tipo de serviço</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredServicos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500">
            {searchTerm || tipoFilter !== 'todos' 
              ? 'Nenhum serviço encontrado com esses filtros'
              : 'Nenhum serviço cadastrado ainda'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
            {diasDaSemana.map(dia => {
              const servicosDoDia = servicosPorDia[dia] || [];
              
              return (
                <div key={dia} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col h-full">
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
                      <p className="text-gray-400 text-center text-sm py-4">
                        Nenhum serviço
                      </p>
                    ) : (
                      servicosDoDia.map(servico => (
                        <div key={servico.id} className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                          <div className="p-3">
                            <ServicoCard
                              servico={servico}
                              onEdit={(isAdmin || hasPermission('servicos_editar')) ? handleEdit : undefined}
                              onDelete={(isAdmin || hasPermission('servicos_deletar')) ? handleDelete : undefined}
                              onStatusChange={handleStatusChange}
                              onShare={(servico) => {
                                setServicoConcluido({ ...servico, isConclusao: false });
                                setShowCompartilharModal(true);
                              }}
                              compact
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {servicosSemData.length > 0 && (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-500 to-gray-600 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-white" />
                  <h3 className="font-bold text-white">Sem Data Programada</h3>
                </div>
                <Badge className="bg-white/20 text-white border-white/30">
                  {servicosSemData.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {servicosSemData.map(servico => (
                  <ServicoCard
                    key={servico.id}
                    servico={servico}
                    onEdit={(isAdmin || hasPermission('servicos_editar')) ? handleEdit : undefined}
                    onDelete={(isAdmin || hasPermission('servicos_deletar')) ? handleDelete : undefined}
                    onStatusChange={handleStatusChange}
                    onShare={(servico) => {
                      setServicoConcluido({ ...servico, isConclusao: false });
                      setShowCompartilharModal(true);
                    }}
                  />
                ))}
              </div>
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
    </div>
  );
}