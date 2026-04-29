import React, { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Users, 
  Filter,
  X,
  CloudUpload,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import ClienteForm from '@/components/clientes/ClienteForm';
import ClientesTable from '@/components/clientes/ClientesTable';
import DeleteConfirmDialog from '@/components/clientes/DeleteConfirmDialog';
import HistoricoModal from '@/components/atendimentos/HistoricoModal';
import AtendimentoForm from '@/components/atendimentos/AtendimentoForm';
import EmptyState from '@/components/EmptyState';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { useEmpresa } from '@/components/auth/EmpresaGuard';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import NoPermission from '@/components/NoPermission';
import { useNavigate } from 'react-router-dom';

export default function Clientes() {
  const queryClient = useQueryClient();
  const { hasPermission, isAdmin } = usePermissions();
  const { filterByEmpresa, currentEmpresa } = useEmpresa();
  const navigate = useNavigate();
  
  const [user, setUser] = React.useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCliente, setDeletingCliente] = useState(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [atendimentoFormOpen, setAtendimentoFormOpen] = useState(false);
  const [exportandoDrive, setExportandoDrive] = useState(false);
  
  React.useEffect(() => {
    const checkUser = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        if (u?.role !== 'admin') {
          navigate('/Dashboard');
        }
      } catch {
        navigate('/Dashboard');
      }
    };
    checkUser();
  }, [navigate]);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const allClientes = await base44.entities.Cliente.list('-created_date');
      const filtered = filterByEmpresa(allClientes);
      return filtered;
    },
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const cliente = await base44.entities.Cliente.create(data);
      
      // Log de auditoria
      try {
        const user = await base44.auth.me();
        await base44.entities.LogAuditoria.create({
          usuario_email: user.email,
          usuario_nome: user.full_name,
          acao: 'criar_cliente',
          entidade: 'Cliente',
          entidade_id: cliente.id,
          dados_depois: JSON.stringify(cliente),
          observacao: `Cliente ${data.nome} cadastrado`,
          sucesso: true
        });
      } catch (auditError) {
        console.error('Erro ao registrar log de auditoria (criar cliente):', auditError);
      }

      return cliente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setFormOpen(false);
      toast.success('Cliente cadastrado com sucesso!');
    },
    onError: () => toast.error('Erro ao cadastrar cliente'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setFormOpen(false);
      setEditingCliente(null);
      toast.success('Cliente atualizado com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar cliente'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const cliente = clientes.find(c => c.id === id);
      await base44.entities.Cliente.delete(id);
      
      // Log de auditoria
      try {
        const user = await base44.auth.me();
        await base44.entities.LogAuditoria.create({
          usuario_email: user.email,
          usuario_nome: user.full_name,
          acao: 'excluir_cliente',
          entidade: 'Cliente',
          entidade_id: id,
          dados_antes: JSON.stringify(cliente),
          observacao: `Cliente ${cliente?.nome} excluído`,
          sucesso: true
        });
      } catch (auditError) {
        console.error('Erro ao registrar log de auditoria (excluir cliente):', auditError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setDeleteDialogOpen(false);
      setDeletingCliente(null);
      toast.success('Cliente excluído com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir cliente'),
  });

  const createAtendimentoMutation = useMutation({
    mutationFn: (data) => base44.entities.Atendimento.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
      setAtendimentoFormOpen(false);
      toast.success('Atendimento registrado com sucesso!');
    },
    onError: () => toast.error('Erro ao registrar atendimento'),
  });

  const filteredClientes = useMemo(() => {
    if (!debouncedSearch.trim()) return clientes;

    const searchTerms = debouncedSearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const searchNumeros = debouncedSearch.replace(/\D/g, '');

    const results = clientes.filter(cliente => {
      const nomeLower = (cliente.nome || '').toLowerCase();
      const telefoneLimpo = (cliente.telefone || '').replace(/\D/g, '');

      // Match se contém a busca completa OU se contém qualquer uma das palavras
      const matchNome = nomeLower.includes(debouncedSearch.toLowerCase()) ||
                        searchTerms.some(term => nomeLower.includes(term));
      const matchTelefone = searchNumeros && telefoneLimpo.includes(searchNumeros);

      return matchNome || matchTelefone;
    });

    return results;
  }, [clientes, debouncedSearch]);

  const handleSave = (data) => {
    if (editingCliente) {
      updateMutation.mutate({ id: editingCliente.id, data });
    } else {
      const clienteData = { ...data };
      if (currentEmpresa?.id) {
        clienteData.empresa_id = currentEmpresa.id;
      }
      createMutation.mutate(clienteData);
    }
  };

  const handleEdit = (cliente) => {
    setEditingCliente(cliente);
    setFormOpen(true);
  };

  const handleDelete = (cliente) => {
    setDeletingCliente(cliente);
    setDeleteDialogOpen(true);
  };

  const handleViewHistory = (cliente) => {
    setSelectedCliente(cliente);
    setHistoricoOpen(true);
  };

  const handleNewAtendimento = () => {
    setAtendimentoFormOpen(true);
  };

  const handleSaveAtendimento = (data) => {
    createAtendimentoMutation.mutate(data);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm !== '';

  // Paginação
  const totalPages = Math.ceil(filteredClientes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedClientes = filteredClientes.slice(startIndex, endIndex);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleExportarDrive = async () => {
    setExportandoDrive(true);
    try {
      const response = await base44.functions.invoke('exportarClientesDrive');
      const { success, fileName, total, driveLink } = response.data;
      if (success) {
        toast.success(`${total} clientes exportados para o Google Drive!`, {
          description: fileName,
          action: { label: 'Abrir Drive', onClick: () => window.open(driveLink, '_blank') },
          duration: 8000,
        });
      }
    } catch {
      toast.error('Erro ao exportar para o Google Drive');
    } finally {
      setExportandoDrive(false);
    }
  };
  
  if (!user) {
    return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;
  }
  
  if (user.role !== 'admin') return <NoPermission />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-200">Clientes</h1>
          <p className="text-gray-400 mt-1">{clientes.length} clientes cadastrados</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={handleExportarDrive}
              disabled={exportandoDrive}
              className="bg-[#152236] border-white/10 text-gray-300 hover:bg-white/5 hover:text-emerald-400 hover:border-emerald-500/40"
            >
              <CloudUpload className="w-4 h-4 mr-2" />
              {exportandoDrive ? 'Exportando...' : 'Exportar Drive'}
            </Button>
          )}
          {(isAdmin || hasPermission('clientes_criar')) && (
            <Button 
              onClick={() => { setEditingCliente(null); setFormOpen(true); }}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Cliente
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl shadow-sm p-4 sm:p-6 space-y-4 border border-white/5 bg-[#152236]">
        <div className="flex items-center gap-2 text-gray-300 mb-2">
          <Filter className="w-5 h-5" />
          <span className="font-medium">Filtros</span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="ml-auto text-gray-400 hover:text-gray-200 hover:bg-white/5"
            >
              <X className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 border-white/10 text-gray-200 placeholder:text-gray-500 bg-[#0f1a2b]"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : (
        <>
          {filteredClientes.length > 0 && (
            <div className="bg-[#152236] rounded-lg p-4 border border-white/5 flex items-center justify-between">
              <p className="text-sm text-gray-300">
                Mostrando <span className="font-medium text-gray-100">{startIndex + 1}</span> a <span className="font-medium text-gray-100">{Math.min(endIndex, filteredClientes.length)}</span> de <span className="font-medium text-gray-100">{filteredClientes.length}</span> clientes
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="bg-[#0f1a2b] border-white/10 text-gray-300 hover:bg-white/5 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-300">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="bg-[#0f1a2b] border-white/10 text-gray-300 hover:bg-white/5 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          {filteredClientes.length === 0 ? (
        <EmptyState 
          title={hasActiveFilters ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          description={hasActiveFilters 
            ? 'Tente ajustar os filtros de busca' 
            : 'Comece cadastrando seu primeiro cliente'
          }
          icon={Users}
          action={!hasActiveFilters ? () => { setEditingCliente(null); setFormOpen(true); } : null}
          actionLabel="Cadastrar Cliente"
        />
          ) : (
            <ClientesTable
              clientes={paginatedClientes}
          onEdit={(isAdmin || hasPermission('clientes_editar')) ? handleEdit : undefined}
          onDelete={(isAdmin || hasPermission('clientes_deletar')) ? handleDelete : undefined}
          onViewHistory={handleViewHistory}
          isAdmin={isAdmin}
        />
          )}
        </>
      )}

      <ClienteForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingCliente(null); }}
        onSave={handleSave}
        cliente={editingCliente}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingCliente(null); }}
        onConfirm={() => deleteMutation.mutate(deletingCliente?.id)}
        clienteName={deletingCliente?.nome}
        isLoading={deleteMutation.isPending}
      />

      <HistoricoModal
        open={historicoOpen}
        onClose={() => { setHistoricoOpen(false); setSelectedCliente(null); }}
        cliente={selectedCliente}
        atendimentos={atendimentos}
        onNewAtendimento={handleNewAtendimento}
      />

      <AtendimentoForm
        open={atendimentoFormOpen}
        onClose={() => setAtendimentoFormOpen(false)}
        onSave={handleSaveAtendimento}
        cliente={selectedCliente}
        isLoading={createAtendimentoMutation.isPending}
      />
    </div>
  );
}