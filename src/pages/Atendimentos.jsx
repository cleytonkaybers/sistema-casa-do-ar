import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/components/auth/PermissionGuard';
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
import { TableSkeleton } from '@/components/LoadingSkeleton';
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
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import DeleteConfirmDialog from '@/components/clientes/DeleteConfirmDialog';
import DetalhesModal from '@/components/atendimentos/DetalhesModal';
import CompartilharModal from '@/components/servicos/CompartilharModal';

const formatDate = (date) => {
  if (!date) return '-';
  try { return format(new Date(date), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return '-'; }
};

export default function Atendimentos() {
  const queryClient = useQueryClient();
  const { user: currentUser, loading: loadingUser, isAdmin } = usePermissions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(30);
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

  const { data: usuarios = [], isLoading: isLoadingUsuarios } = useQuery({
    queryKey: ['usuarios-atendimentos'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos-atendimentos'],
    queryFn: () => base44.entities.Servico.list(),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-atendimentos'],
    queryFn: () => base44.entities.Cliente.list(),
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

  // equipe_id vem direto do auth.me() — sem depender da lista de usuários
  const equipeIdUsuario = currentUser?.equipe_id || null;

  const filteredAtendimentos = useMemo(() => {
    if (loadingUser) return [];

    const filtered = atendimentos.filter(atendimento => {
      if (!isAdmin) {
        if (equipeIdUsuario) {
          if (atendimento.equipe_id !== equipeIdUsuario) return false;
        } else {
          if (atendimento.equipe_id) return false;
        }
      }

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
  }, [atendimentos, searchTerm, filterTipo, isAdmin, equipeIdUsuario, loadingUser]);

  const handleDelete = (atendimento) => {
    setDeletingAtendimento(atendimento);
    setDeleteDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterTipo('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || filterTipo !== 'all';

  // Paginação
  const totalPages = Math.ceil(filteredAtendimentos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAtendimentos = filteredAtendimentos.slice(startIndex, endIndex);

  // Reset para página 1 quando filtros mudarem
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTipo]);

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
    // Tenta buscar telefone: 1) direto, 2) do campo detalhes JSON, 3) do serviço original
    let telefone = atendimento.telefone;
    if (!telefone && atendimento.detalhes) {
      try {
        const det = typeof atendimento.detalhes === 'string' ? JSON.parse(atendimento.detalhes) : atendimento.detalhes;
        telefone = det?.dados_ordem_servico?.telefone || '';
      } catch {}
    }
    if (!telefone && atendimento.servico_id) {
      const servicoOrigem = servicos.find(s => s.id === atendimento.servico_id);
      telefone = servicoOrigem?.telefone || '';
    }
    // Fallback final: buscar pelo nome do cliente na entidade Cliente
    if (!telefone && atendimento.cliente_nome) {
      const clienteMatch = clientes.find(c => 
        c.nome?.trim().toLowerCase() === atendimento.cliente_nome?.trim().toLowerCase()
      );
      telefone = clienteMatch?.telefone || '';
    }

    // Buscar dados extras de fallback (detalhes JSON ou serviço original)
    let det = null;
    if (atendimento.detalhes) {
      try { det = typeof atendimento.detalhes === 'string' ? JSON.parse(atendimento.detalhes) : atendimento.detalhes; } catch {}
    }
    const servicoOrigem = atendimento.servico_id ? servicos.find(s => s.id === atendimento.servico_id) : null;

    const get = (field) =>
      atendimento[field] ||
      det?.dados_ordem_servico?.[field] ||
      servicoOrigem?.[field] ||
      '';

    setAtendimentoCompartilhar({
      cliente_nome: atendimento.cliente_nome,
      telefone: telefone || '',
      tipo_servico: atendimento.tipo_servico,
      data_programada: atendimento.data_atendimento || get('data_programada'),
      horario: get('horario'),
      endereco: get('endereco'),
      valor: atendimento.valor || get('valor'),
      descricao: get('descricao'),
      observacoes_conclusao: get('observacoes_conclusao'),
      equipe_nome: get('equipe_nome'),
      status: 'concluido',
    });
    setCompartilharOpen(true);
  };



  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Atendimentos</h1>
          <p className="text-gray-500 mt-1">{atendimentos.length} atendimentos concluídos</p>
        </div>
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
        <TableSkeleton rows={8} />
      ) : (
        <>
          <div className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Mostrando <span className="font-medium">{startIndex + 1}</span> a <span className="font-medium">{Math.min(endIndex, filteredAtendimentos.length)}</span> de <span className="font-medium">{filteredAtendimentos.length}</span> atendimentos
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="border-gray-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="border-gray-200"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {paginatedAtendimentos.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            {hasActiveFilters ? 'Nenhum atendimento encontrado' : 'Nenhum atendimento registrado'}
          </h3>
          <p className="text-gray-500">
            {hasActiveFilters
              ? 'Tente ajustar os filtros de busca'
              : 'Os atendimentos são gerados automaticamente ao concluir um serviço'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden lg:block border border-gray-200 shadow-sm overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: '#1e3a8a' }}>
                  <TableHead className="text-white">Cliente</TableHead>
                  <TableHead className="text-white">Data Conclusão</TableHead>
                  <TableHead className="text-white">Tipo de Serviço</TableHead>
                  <TableHead className="text-white">Valor</TableHead>
                  <TableHead className="text-white">Concluído por</TableHead>
                  <TableHead className="text-right text-white">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAtendimentos.map((atendimento) => (
                  <TableRow key={atendimento.id} className="border-gray-100 hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center text-white text-sm font-medium">
                          {atendimento.cliente_nome?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{atendimento.cliente_nome || '-'}</p>
                          {atendimento.telefone && <p className="text-xs text-gray-400">{atendimento.telefone}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Calendar className="w-4 h-4 text-green-400" />
                        {formatDate(atendimento.data_conclusao || atendimento.data_atendimento)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Wrench className="w-4 h-4 text-blue-400" />
                        {atendimento.tipo_servico}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">
                        {formatCurrency(atendimento.valor)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-600">
                        {(() => {
                          const equipe = atendimento.equipe_nome || 
                            servicos.find(s => s.id === atendimento.servico_id)?.equipe_nome || '';
                          return equipe ? <p className="font-medium text-blue-700">👷 {equipe}</p> : null;
                        })()}
                        <p className="text-gray-400">{atendimento.usuario_conclusao || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleCompartilhar(atendimento)} className="text-gray-400 hover:text-green-600" title="Compartilhar">
                          <Share2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleVerDetalhes(atendimento)} className="text-gray-400 hover:text-blue-600" title="Ver Detalhes">
                          <Info className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(atendimento)} className="text-gray-400 hover:text-red-500" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {paginatedAtendimentos.map((atendimento) => (
              <Card key={atendimento.id} className="border border-gray-200 shadow-sm bg-white">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center text-white font-medium">
                        {atendimento.cliente_nome?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{atendimento.cliente_nome || '-'}</p>
                        <p className="text-sm text-gray-500">{atendimento.tipo_servico}</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Concluído
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-green-400" />
                      {formatDate(atendimento.data_conclusao || atendimento.data_atendimento)}
                    </div>
                    <span className="font-medium text-green-600">{formatCurrency(atendimento.valor)}</span>
                  </div>
                  {atendimento.observacoes_conclusao && (
                    <p className="text-sm text-gray-500 border border-gray-100 p-2 rounded-lg mb-3 line-clamp-2 bg-gray-50">
                      {atendimento.observacoes_conclusao}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <Button variant="outline" size="sm" onClick={() => handleCompartilhar(atendimento)} className="border-gray-200 text-gray-500 hover:text-green-600">
                      <Share2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleVerDetalhes(atendimento)} className="flex-1 border-gray-200 text-gray-600 hover:text-blue-600">
                      <Info className="w-4 h-4 mr-1.5" /> Ver Detalhes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(atendimento)} className="border-gray-200 text-gray-500 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          </>
        )}
      </>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingAtendimento(null); }}
        onConfirm={() => deleteMutation.mutate(deletingAtendimento?.id)}
        clienteName={`atendimento de ${deletingAtendimento?.cliente_nome}`}
        isLoading={deleteMutation.isPending}
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
        isConclusao={true}
      />
    </div>
  );
}