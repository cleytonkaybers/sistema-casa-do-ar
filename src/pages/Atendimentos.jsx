import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, 
  Search, 
  ClipboardList, 
  Filter,
  Loader2,
  Calendar,
  Wrench,
  DollarSign,
  Pencil,
  Trash2,
  X,
  User,
  History,
  Info
} from 'lucide-react';

import AtendimentoForm from '@/components/atendimentos/AtendimentoForm';
import DeleteConfirmDialog from '@/components/clientes/DeleteConfirmDialog';
import HistoricoStatusModal from '@/components/atendimentos/HistoricoStatusModal';
import DetalhesModal from '@/components/atendimentos/DetalhesModal';

const statusColors = {
  'Aberto': 'bg-gray-100 text-gray-700 border-gray-200',
  'Em Andamento': 'bg-blue-100 text-blue-700 border-blue-200',
  'Agendado': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Reagendado': 'bg-orange-100 text-orange-700 border-orange-200',
  'Concluído': 'bg-green-100 text-green-700 border-green-200'
};

export default function Atendimentos() {
  const queryClient = useQueryClient();
  
  // Estados
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTipo, setFilterTipo] = useState('all');
  
  // Modais
  const [formOpen, setFormOpen] = useState(false);
  const [editingAtendimento, setEditingAtendimento] = useState(null);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAtendimento, setDeletingAtendimento] = useState(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [selectedServicoId, setSelectedServicoId] = useState(null);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [selectedAtendimento, setSelectedAtendimento] = useState(null);

  // Queries
  const { data: atendimentos = [], isLoading } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list('-data_atendimento'),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Atendimento.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
      setFormOpen(false);
      toast.success('Atendimento registrado com sucesso!');
    },
    onError: () => toast.error('Erro ao registrar atendimento'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Atendimento.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
      setFormOpen(false);
      setEditingAtendimento(null);
      toast.success('Atendimento atualizado com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar atendimento'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Atendimento.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
      setDeleteDialogOpen(false);
      setDeletingAtendimento(null);
      toast.success('Atendimento excluído com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir atendimento'),
  });

  // Filtros
  const tiposServico = useMemo(() => {
    const tiposSet = new Set(atendimentos.map(a => a.tipo_servico).filter(Boolean));
    return Array.from(tiposSet).sort();
  }, [atendimentos]);

  // Combinar atendimentos e serviços
  const atendimentosComServicos = useMemo(() => {
    // Converter serviços para formato de atendimento
    const servicosComoAtendimentos = servicos.map(servico => ({
      id: servico.id,
      cliente_nome: servico.cliente_nome,
      data_atendimento: servico.data_programada,
      tipo_servico: servico.tipo_servico,
      descricao: servico.descricao || '',
      valor: servico.valor || 0,
      status: servico.status === 'aberto' ? 'Aberto' :
              servico.status === 'andamento' ? 'Em Andamento' :
              servico.status === 'agendado' ? 'Agendado' :
              servico.status === 'reagendado' ? 'Reagendado' :
              servico.status === 'concluido' ? 'Concluído' : 'Aberto',
      observacoes: servico.observacoes_conclusao || '',
      origem: 'servico',
      servico_id: servico.id,
      horario: servico.horario,
      dia_semana: servico.dia_semana
    }));

    // Atendimentos reais marcados como origem
    const atendimentosReais = atendimentos.map(a => ({
      ...a,
      origem: 'atendimento'
    }));

    // Combinar todos
    return [...servicosComoAtendimentos, ...atendimentosReais];
  }, [servicos, atendimentos]);

  const filteredAtendimentos = useMemo(() => {
    const filtered = atendimentosComServicos.filter(atendimento => {
      const matchesSearch = 
        atendimento.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        atendimento.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || atendimento.status === filterStatus;
      const matchesTipo = filterTipo === 'all' || atendimento.tipo_servico === filterTipo;
      
      return matchesSearch && matchesStatus && matchesTipo;
    });

    // Ordenar por prioridade de status
    const statusPrioridade = {
      'Agendado': 1,
      'Reagendado': 2,
      'Aberto': 3,
      'Em Andamento': 4,
      'Concluído': 5
    };

    return filtered.sort((a, b) => {
      const prioA = statusPrioridade[a.status] || 999;
      const prioB = statusPrioridade[b.status] || 999;
      
      if (prioA !== prioB) {
        return prioA - prioB;
      }
      
      // Se mesma prioridade, ordenar por data
      const dataA = new Date(a.data_atendimento);
      const dataB = new Date(b.data_atendimento);
      return dataB - dataA;
    });
  }, [atendimentosComServicos, searchTerm, filterStatus, filterTipo]);

  // Handlers
  const handleSave = async (data) => {
    const currentUser = await base44.auth.me();
    const dataWithUser = {
      ...data,
      usuario_atualizacao_status: currentUser?.email,
      data_atualizacao_status: new Date().toISOString()
    };

    if (editingAtendimento) {
      updateMutation.mutate({ id: editingAtendimento.id, data: dataWithUser });
    } else {
      createMutation.mutate(dataWithUser);
    }
  };

  const handleEdit = (atendimento) => {
    setEditingAtendimento(atendimento);
    const cliente = clientes.find(c => c.id === atendimento.cliente_id);
    setSelectedCliente(cliente);
    setFormOpen(true);
  };

  const handleDelete = (atendimento) => {
    setDeletingAtendimento(atendimento);
    setDeleteDialogOpen(true);
  };

  const handleNewAtendimento = () => {
    setEditingAtendimento(null);
    setSelectedCliente(null);
    setFormOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterTipo('all');
  };

  const hasActiveFilters = searchTerm || filterStatus !== 'all' || filterTipo !== 'all';

  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleVerDetalhes = (atendimento) => {
    setSelectedAtendimento(atendimento);
    setDetalhesOpen(true);
  };

  const handleVerHistorico = (atendimento) => {
    // Se veio de serviço, usar o servico_id diretamente
    if (atendimento.origem === 'servico') {
      setSelectedServicoId(atendimento.servico_id);
      setHistoricoOpen(true);
    } else {
      // Buscar serviço relacionado ao atendimento
      const servicoRelacionado = servicos.find(s => 
        s.cliente_nome?.trim().toLowerCase() === atendimento.cliente_nome?.trim().toLowerCase() &&
        s.status === 'concluido'
      );
      
      if (servicoRelacionado) {
        setSelectedServicoId(servicoRelacionado.id);
        setHistoricoOpen(true);
      } else {
        toast.info('Nenhum histórico de status disponível para este atendimento');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Atendimentos</h1>
          <p className="text-gray-500 mt-1">{atendimentos.length} atendimentos registrados</p>
        </div>
        <Button 
          onClick={handleNewAtendimento}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/30"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Atendimento
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-700 mb-2">
          <Filter className="w-5 h-5" />
          <span className="font-medium">Filtros</span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="ml-auto text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Busca */}
          <div className="sm:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Buscar por cliente ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-gray-50 border-gray-200 focus:bg-white"
              />
            </div>
          </div>

          {/* Filtro Status */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-11 bg-gray-50 border-gray-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Reagendado">Reagendado</SelectItem>
              <SelectItem value="Aberto">Aberto</SelectItem>
              <SelectItem value="Em Andamento">Em Andamento</SelectItem>
              <SelectItem value="Agendado">Agendado</SelectItem>
              <SelectItem value="Concluído">Concluído</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro Tipo */}
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="h-11 bg-gray-50 border-gray-200">
              <SelectValue placeholder="Tipo de Serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {tiposServico.map(tipo => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de Atendimentos */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredAtendimentos.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            {hasActiveFilters ? 'Nenhum atendimento encontrado' : 'Nenhum atendimento registrado'}
          </h3>
          <p className="text-gray-500 mb-6">
            {hasActiveFilters 
              ? 'Tente ajustar os filtros de busca'
              : 'Comece registrando seu primeiro atendimento'
            }
          </p>
          {!hasActiveFilters && (
            <Button 
              onClick={handleNewAtendimento}
              className="bg-gradient-to-r from-blue-500 to-cyan-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Registrar Atendimento
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden lg:block bg-white border-0 shadow-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo de Serviço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAtendimentos.map((atendimento) => {
                  return (
                    <TableRow key={`${atendimento.origem}-${atendimento.id}`} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white text-sm font-medium">
                            {atendimento.cliente_nome?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <span className="font-medium">{atendimento.cliente_nome || 'Cliente não identificado'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {format(new Date(atendimento.data_atendimento), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Wrench className="w-4 h-4 text-gray-400" />
                          {atendimento.tipo_servico}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[atendimento.status]} border`}>
                          {atendimento.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={atendimento.origem === 'servico' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-cyan-100 text-cyan-700 border-cyan-200'}>
                          {atendimento.origem === 'servico' ? 'Serviço' : 'Atendimento'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-green-600">
                          {formatCurrency(atendimento.valor)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleVerDetalhes(atendimento)}
                            className="text-gray-500 hover:text-blue-600"
                            title="Ver Detalhes"
                          >
                            <Info className="w-4 h-4" />
                          </Button>
                          {atendimento.origem === 'servico' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleVerHistorico(atendimento)}
                              className="text-gray-500 hover:text-purple-600"
                              title="Ver Histórico"
                            >
                              <History className="w-4 h-4" />
                            </Button>
                          )}
                          {atendimento.origem === 'atendimento' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(atendimento)}
                                className="text-gray-500 hover:text-blue-600"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(atendimento)}
                                className="text-gray-500 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {filteredAtendimentos.map((atendimento) => {
              return (
                <Card key={`${atendimento.origem}-${atendimento.id}`} className="bg-white border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-medium">
                          {atendimento.cliente_nome?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{atendimento.cliente_nome || 'Cliente não identificado'}</p>
                          <p className="text-sm text-gray-500">{atendimento.tipo_servico}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge className={`${statusColors[atendimento.status]} border text-xs`}>
                          {atendimento.status}
                        </Badge>
                        <Badge className={atendimento.origem === 'servico' ? 'bg-purple-100 text-purple-700 border-purple-200 text-xs' : 'bg-cyan-100 text-cyan-700 border-cyan-200 text-xs'}>
                          {atendimento.origem === 'servico' ? 'Serviço' : 'Atendimento'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {format(new Date(atendimento.data_atendimento), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                      <span className="font-medium text-green-600">
                        {formatCurrency(atendimento.valor)}
                      </span>
                    </div>

                    {atendimento.descricao && (
                      <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded-lg mb-3 line-clamp-2">
                        {atendimento.descricao}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerDetalhes(atendimento)}
                        className="flex-1"
                      >
                        <Info className="w-4 h-4 mr-1.5" />
                        Ver Detalhes
                      </Button>
                      {atendimento.origem === 'servico' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerHistorico(atendimento)}
                          className="flex-1"
                        >
                          <History className="w-4 h-4 mr-1.5" />
                          Histórico
                        </Button>
                      )}
                      {atendimento.origem === 'atendimento' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(atendimento)}
                            className="flex-1"
                          >
                            <Pencil className="w-4 h-4 mr-1.5" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(atendimento)}
                            className="text-red-600 hover:text-red-700 hover:border-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Modais */}
      <AtendimentoForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingAtendimento(null); setSelectedCliente(null); }}
        onSave={handleSave}
        atendimento={editingAtendimento}
        cliente={selectedCliente}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingAtendimento(null); }}
        onConfirm={() => deleteMutation.mutate(deletingAtendimento?.id)}
        clienteName={`atendimento de ${deletingAtendimento?.cliente_nome}`}
        isLoading={deleteMutation.isPending}
      />

      <HistoricoStatusModal
        open={historicoOpen}
        onClose={() => { setHistoricoOpen(false); setSelectedServicoId(null); }}
        servicoId={selectedServicoId}
      />

      <DetalhesModal
        open={detalhesOpen}
        onClose={() => { setDetalhesOpen(false); setSelectedAtendimento(null); }}
        atendimento={selectedAtendimento}
      />
    </div>
  );
}