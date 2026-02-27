import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Users, 
  Filter,
  X
} from 'lucide-react';

import ClienteForm from '@/components/clientes/ClienteForm';
import ClientesTable from '@/components/clientes/ClientesTable';
import DeleteConfirmDialog from '@/components/clientes/DeleteConfirmDialog';
import HistoricoModal from '@/components/atendimentos/HistoricoModal';
import AtendimentoForm from '@/components/atendimentos/AtendimentoForm';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { useEmpresa } from '@/components/auth/EmpresaGuard';

export default function Clientes() {
  const queryClient = useQueryClient();
  const { hasPermission, isAdmin } = usePermissions();
  const { filterByEmpresa, currentEmpresa } = useEmpresa();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCliente, setDeletingCliente] = useState(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [atendimentoFormOpen, setAtendimentoFormOpen] = useState(false);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const allClientes = await base44.entities.Cliente.list('-created_date');
      return filterByEmpresa(allClientes);
    },
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Cliente.create(data),
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
    mutationFn: (id) => base44.entities.Cliente.delete(id),
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
    return clientes.filter(cliente => {
      const matchesSearch = 
        cliente.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.telefone?.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''));
      
      return matchesSearch;
    });
  }, [clientes, searchTerm]);

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
  };

  const hasActiveFilters = searchTerm !== '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Clientes</h1>
          <p className="text-blue-300/70 mt-1">{clientes.length} clientes cadastrados</p>
        </div>
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

      <div className="rounded-2xl shadow-lg p-4 sm:p-6 space-y-4 border border-blue-800/40" style={{backgroundColor: '#243447'}}>
        <div className="flex items-center gap-2 text-blue-200 mb-2">
          <Filter className="w-5 h-5" />
          <span className="font-medium">Filtros</span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="ml-auto text-blue-300 hover:text-white"
            >
              <X className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 border-blue-800/50 text-white placeholder:text-blue-400/60"
            style={{backgroundColor: 'rgba(30,64,175,0.2)'}}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Carregando clientes..." />
      ) : filteredClientes.length === 0 ? (
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
          clientes={filteredClientes}
          onEdit={(isAdmin || hasPermission('clientes_editar')) ? handleEdit : undefined}
          onDelete={(isAdmin || hasPermission('clientes_deletar')) ? handleDelete : undefined}
          onViewHistory={handleViewHistory}
          isAdmin={isAdmin}
        />
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