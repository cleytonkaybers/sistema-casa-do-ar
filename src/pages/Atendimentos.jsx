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
  Search, 
  ClipboardList, 
  Filter,
  Loader2,
  Calendar,
  Wrench,
  DollarSign,
  Trash2,
  X,
  Info,
  Share2,
  CheckCircle2
} from 'lucide-react';

import DeleteConfirmDialog from '@/components/clientes/DeleteConfirmDialog';
import DetalhesModal from '@/components/atendimentos/DetalhesModal';
import CompartilharModal from '@/components/servicos/CompartilharModal';

const statusColors = {
  'Aberto': 'bg-gray-100 text-gray-700 border-gray-200',
  'Em Andamento': 'bg-blue-100 text-blue-700 border-blue-200',
  'Agendado': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Reagendado': 'bg-orange-100 text-orange-700 border-orange-200',
  'Concluído': 'bg-green-100 text-green-700 border-green-200'
};

export default function Atendimentos() {
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAtendimento, setDeletingAtendimento] = useState(null);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [selectedAtendimento, setSelectedAtendimento] = useState(null);
  const [compartilharOpen, setCompartilharOpen] = useState(false);
  const [atendimentoCompartilhar, setAtendimentoCompartilhar] = useState(null);

  const { data: atendimentos = [], isLoading } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list('-data_atendimento'),
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

  const tiposServico = useMemo(() => {
    const tiposSet = new Set(atendimentos.map(a => a.tipo_servico).filter(Boolean));
    return Array.from(tiposSet).sort();
  }, [atendimentos]);

  const filteredAtendimentos = useMemo(() => {
    const filtered = atendimentos.filter(atendimento => {
      const matchesSearch = 
        atendimento.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        atendimento.tipo_servico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        atendimento.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTipo = filterTipo === 'all' || atendimento.tipo_servico === filterTipo;
      
      return matchesSearch && matchesTipo;
    });

    return filtered.sort((a, b) => {
      const dataA = new Date(a.data_conclusao || a.data_atendimento);
      const dataB = new Date(b.data_conclusao || b.data_atendimento);
      return dataB - dataA;
    });
  }, [atendimentos, searchTerm, filterTipo]);

  const handleDelete = (atendimento) => {
    setDeletingAtendimento(atendimento);
    setDeleteDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterTipo('all');
  };

  const hasActiveFilters = searchTerm || filterTipo !== 'all';

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

  const handleCompartilhar = (atendimento) => {
    // Monta objeto compatível com CompartilharModal
    setAtendimentoCompartilhar({
      cliente_nome: atendimento.cliente_nome,
      telefone: atendimento.telefone,
      tipo_servico: atendimento.tipo_servico,
      data_programada: atendimento.data_atendimento,
      horario: atendimento.horario,
      endereco: atendimento.endereco,
      valor: atendimento.valor,
      descricao: atendimento.descricao,
      observacoes_conclusao: atendimento.observacoes,
      status: atendimento.status?.toLowerCase().replace(' ', '_').replace('ú', 'u').replace('í', 'i') || 'aberto',
    });
    setCompartilharOpen(true);
  };

  const handleVerHistorico = (atendimento) => {
    if (atendimento.origem === 'servico') {
      setSelectedServicoId(atendimento.servico_id);
      setHistoricoOpen(true);
    } else {
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

      <div className="rounded-2xl shadow-sm p-4 sm:p-6 space-y-4 border border-gray-200 bg-white">
        <div className="flex items-center gap-2 text-gray-600 mb-2">
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
          <div className="sm:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Buscar por cliente ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 border-gray-200 text-gray-700 placeholder:text-gray-400 bg-white"
              />
            </div>
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-11 border-gray-200 text-gray-700 bg-white">
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

          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="h-11 border-gray-200 text-gray-700 bg-white">
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
          <Card className="hidden lg:block border border-gray-200 shadow-sm overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: '#1e3a8a' }}>
                  <TableHead className="text-white">Cliente</TableHead>
                  <TableHead className="text-white">Data</TableHead>
                  <TableHead className="text-white">Tipo de Serviço</TableHead>
                  <TableHead className="text-white">Status</TableHead>
                  <TableHead className="text-white">Origem</TableHead>
                  <TableHead className="text-white">Valor</TableHead>
                  <TableHead className="text-right text-white">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAtendimentos.map((atendimento) => {
                  return (
                    <TableRow key={`${atendimento.origem}-${atendimento.id}`} className="border-gray-100 hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white text-sm font-medium">
                            {atendimento.cliente_nome?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <span className="font-medium text-gray-800">{atendimento.cliente_nome || 'Cliente não identificado'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          {format(new Date(atendimento.data_atendimento), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Wrench className="w-4 h-4 text-blue-400" />
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
                            onClick={() => handleCompartilhar(atendimento)}
                            className="text-gray-400 hover:text-green-600"
                            title="Compartilhar"
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleVerDetalhes(atendimento)}
                            className="text-gray-400 hover:text-blue-600"
                            title="Ver Detalhes"
                          >
                            <Info className="w-4 h-4" />
                          </Button>
                          {atendimento.origem === 'servico' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleVerHistorico(atendimento)}
                              className="text-gray-400 hover:text-purple-600"
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
                                className="text-gray-400 hover:text-amber-500"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(atendimento)}
                                className="text-gray-400 hover:text-red-500"
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
                <Card key={`${atendimento.origem}-${atendimento.id}`} className="border border-gray-200 shadow-sm bg-white">
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
                        <Calendar className="w-4 h-4 text-blue-400" />
                        {format(new Date(atendimento.data_atendimento), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                      <span className="font-medium text-green-600">
                        {formatCurrency(atendimento.valor)}
                      </span>
                    </div>

                    {atendimento.descricao && (
                      <p className="text-sm text-gray-500 border border-gray-100 p-2 rounded-lg mb-3 line-clamp-2 bg-gray-50">
                        {atendimento.descricao}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCompartilhar(atendimento)}
                        className="border-gray-200 text-gray-500 hover:text-green-600"
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerDetalhes(atendimento)}
                        className="flex-1 border-gray-200 text-gray-600 hover:text-blue-600"
                      >
                        <Info className="w-4 h-4 mr-1.5" />
                        Ver Detalhes
                      </Button>
                      {atendimento.origem === 'servico' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerHistorico(atendimento)}
                          className="flex-1 border-gray-200 text-gray-600 hover:text-purple-600"
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
                            className="flex-1 border-gray-200 text-gray-600 hover:text-amber-500"
                          >
                            <Pencil className="w-4 h-4 mr-1.5" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(atendimento)}
                            className="border-gray-200 text-gray-500 hover:text-red-500"
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

      <CompartilharModal
        open={compartilharOpen}
        onClose={() => { setCompartilharOpen(false); setAtendimentoCompartilhar(null); }}
        servico={atendimentoCompartilhar}
        isConclusao={false}
      />
    </div>
  );
}