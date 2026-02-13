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
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ServicosPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingServico, setEditingServico] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReagendarModal, setShowReagendarModal] = useState(false);
  const [servicoParaReagendar, setServicoParaReagendar] = useState(null);

  const queryClient = useQueryClient();

  const { data: servicos = [], isLoading } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Servico.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
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

  const handleSave = (data) => {
    if (editingServico) {
      updateMutation.mutate({ id: editingServico.id, data });
    } else {
      createMutation.mutate(data);
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

  const handleStatusChange = (servico, novoStatus) => {
    if (novoStatus === 'pausado') {
      // Abrir modal de reagendamento obrigatório
      setServicoParaReagendar(servico);
      setShowReagendarModal(true);
      // Atualizar o status para pausado
      updateMutation.mutate({ 
        id: servico.id, 
        data: { ...servico, status: novoStatus } 
      });
    } else {
      updateMutation.mutate({ 
        id: servico.id, 
        data: { ...servico, status: novoStatus } 
      });
      toast.success(`Status alterado para ${novoStatus}`);
    }
  };

  const handleReagendar = (novaData) => {
    if (!servicoParaReagendar) return;
    
    const dataObj = parseISO(novaData);
    const diaSemanaFormatado = format(dataObj, 'EEEE', { locale: ptBR });
    const diaSemana = diaSemanaFormatado.charAt(0).toUpperCase() + diaSemanaFormatado.slice(1);
    
    updateMutation.mutate({ 
      id: servicoParaReagendar.id, 
      data: { 
        ...servicoParaReagendar, 
        data_programada: novaData,
        dia_semana: diaSemana,
        status: 'pausado'
      } 
    });
    
    setShowReagendarModal(false);
    setServicoParaReagendar(null);
    toast.success('Serviço reagendado com sucesso!');
  };

  const filteredServicos = servicos.filter(s => {
    const matchSearch = s.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       s.telefone?.includes(searchTerm);
    const matchTipo = tipoFilter === 'todos' || s.tipo_servico === tipoFilter;
    return matchSearch && matchTipo;
  });

  // Organizar serviços por dia da semana
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

  // Ordenar serviços dentro de cada dia por horário (mais cedo no topo)
  Object.keys(servicosPorDia).forEach(dia => {
    servicosPorDia[dia].sort((a, b) => {
      // Serviços com horário primeiro, sem horário depois
      if (a.horario && !b.horario) return -1;
      if (!a.horario && b.horario) return 1;
      
      // Se ambos têm horário, ordenar por horário
      if (a.horario && b.horario) {
        return a.horario.localeCompare(b.horario);
      }
      
      // Se nenhum tem horário, ordenar por data
      return new Date(a.data_programada) - new Date(b.data_programada);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Serviços</h1>
          <p className="text-gray-500 mt-1">Gerencie serviços diários e semanais</p>
        </div>
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
            <SelectItem value="Carga de gás">Carga de gás</SelectItem>
            <SelectItem value="Recarga de gás">Recarga de gás</SelectItem>
            <SelectItem value="Ver defeito">Ver defeito</SelectItem>
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
          {/* Serviços organizados em colunas por dia da semana */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
            {diasDaSemana.map(dia => {
              const servicosDoDia = servicosPorDia[dia] || [];
              
              return (
                <div key={dia} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col h-full">
                  {/* Cabeçalho do dia */}
                  <div className={`bg-gradient-to-r ${diaColors[dia]} px-4 py-3 sticky top-0 z-10`}>
                    <h3 className="font-bold text-white text-center text-sm lg:text-base">
                      {dia}
                    </h3>
                    <p className="text-white/90 text-center text-xs mt-1">
                      {servicosDoDia.length} {servicosDoDia.length === 1 ? 'serviço' : 'serviços'}
                    </p>
                  </div>

                  {/* Lista de serviços do dia */}
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
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              onStatusChange={handleStatusChange}
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

          {/* Serviços sem data programada */}
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
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
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
    </div>
  );
}