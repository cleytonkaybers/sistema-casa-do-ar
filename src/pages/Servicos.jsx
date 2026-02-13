import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Loader2 } from 'lucide-react';
import ServicoForm from '../components/servicos/ServicoForm';
import ServicoCard from '../components/servicos/ServicoCard';
import { toast } from 'sonner';

export default function ServicosPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingServico, setEditingServico] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [isDeleting, setIsDeleting] = useState(false);

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

  const filteredServicos = servicos.filter(s => {
    const matchSearch = s.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       s.telefone?.includes(searchTerm);
    const matchTipo = tipoFilter === 'todos' || s.tipo_servico === tipoFilter;
    return matchSearch && matchTipo;
  });

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServicos.map((servico) => (
            <ServicoCard
              key={servico.id}
              servico={servico}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
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
    </div>
  );
}