import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Trash2, Edit2, Phone, MapPin, Wrench } from 'lucide-react';
import { useSaaSAuth } from '@/components/saas/SaaSAuthGuard';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ClientesSaaS() {
  const { empresa } = useSaaSAuth();
  const [search, setSearch] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);
  const queryClient = useQueryClient();

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes-saas', empresa?.company_id],
    queryFn: () => 
      empresa?.company_id 
        ? base44.entities.ClienteSaaS.filter({ company_id: empresa.company_id })
        : [],
    enabled: !!empresa?.company_id
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ClienteSaaS.create({
      ...data,
      company_id: empresa.company_id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-saas'] });
      toast.success('Cliente criado com sucesso');
      setSelectedCliente(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ClienteSaaS.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-saas'] });
      toast.success('Cliente removido');
    }
  });

  const filteredClientes = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Clientes</h1>
        <Dialog open={!!selectedCliente} onOpenChange={(open) => !open && setSelectedCliente(null)}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-5 h-5 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
            </DialogHeader>
            <ClienteForm
              onSubmit={(data) => createMutation.mutate(data)}
              loading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar cliente por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredClientes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>Nenhum cliente cadastrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClientes.map((cliente) => (
                <div key={cliente.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{cliente.nome}</h3>
                      <div className="space-y-1 text-sm text-gray-600 mt-2">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {cliente.telefone}
                        </div>
                        {cliente.endereco && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {cliente.endereco}
                          </div>
                        )}
                        {cliente.tipo_equipamento && (
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4" />
                            {cliente.tipo_equipamento} - {cliente.capacidade_btu || 'N/A'} BTU
                          </div>
                        )}
                      </div>
                      {cliente.proxima_manutencao && (
                        <p className="text-xs text-orange-600 mt-2">
                          ⚠️ Próx. manutenção: {new Date(cliente.proxima_manutencao).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button variant="outline" size="icon">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteMutation.mutate(cliente.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 text-xs text-gray-500">
                    <span>💰 Gasto total: R$ {cliente.total_gasto?.toLocaleString('pt-BR') || '0'}</span>
                    <span>📋 {cliente.quantidade_servicos || 0} serviço(s)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClienteForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    endereco: '',
    tipo_equipamento: 'split',
    capacidade_btu: '12000'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nome *</label>
        <Input
          value={form.nome}
          onChange={(e) => setForm({...form, nome: e.target.value})}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Telefone *</label>
        <Input
          value={form.telefone}
          onChange={(e) => setForm({...form, telefone: e.target.value})}
          placeholder="(11) 99999-9999"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({...form, email: e.target.value})}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Endereço</label>
        <Input
          value={form.endereco}
          onChange={(e) => setForm({...form, endereco: e.target.value})}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Tipo de Equipamento</label>
        <select
          value={form.tipo_equipamento}
          onChange={(e) => setForm({...form, tipo_equipamento: e.target.value})}
          className="w-full border rounded px-3 py-2"
        >
          <option value="split">Split</option>
          <option value="inverter">Inverter</option>
          <option value="cassete">Cassete</option>
          <option value="piso_teto">Piso/Teto</option>
          <option value="janela">Janela</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Capacidade (BTU)</label>
        <Input
          value={form.capacidade_btu}
          onChange={(e) => setForm({...form, capacidade_btu: e.target.value})}
          placeholder="12000"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Salvar Cliente
      </Button>
    </form>
  );
}