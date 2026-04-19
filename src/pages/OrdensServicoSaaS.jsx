import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Truck, Clock, Check, DollarSign } from 'lucide-react';
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
import { formatTipoServicoCompact } from '@/utils';

export default function OrdensServicoSaaS() {
  const { empresa } = useSaaSAuth();
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: ordensServico = [], isLoading } = useQuery({
    queryKey: ['ordens-saas', empresa?.company_id],
    queryFn: () => 
      empresa?.company_id 
        ? base44.entities.OrdemServicoSaaS.filter({ company_id: empresa.company_id })
        : [],
    enabled: !!empresa?.company_id
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-saas-os', empresa?.company_id],
    queryFn: () => 
      empresa?.company_id 
        ? base44.entities.ClienteSaaS.filter({ company_id: empresa.company_id })
        : [],
    enabled: !!empresa?.company_id
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.OrdemServicoSaaS.create({
      ...data,
      company_id: empresa.company_id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-saas'] });
      toast.success('Ordem de serviço criada');
      setShowForm(false);
    }
  });

  const statusCores = {
    pendente: 'bg-gray-100 text-gray-700',
    confirmada: 'bg-blue-100 text-blue-700',
    andamento: 'bg-yellow-100 text-yellow-700',
    concluida: 'bg-green-100 text-green-700',
    cancelada: 'bg-red-100 text-red-700'
  };

  const ordensAberta = ordensServico.filter(o => ['pendente', 'confirmada'].includes(o.status));
  const ordensAndamento = ordensServico.filter(o => o.status === 'andamento');
  const ordensConcluidas = ordensServico.filter(o => o.status === 'concluida');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ordens de Serviço</h1>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-5 h-5 mr-2" />
              Nova Ordem
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Ordem de Serviço</DialogTitle>
            </DialogHeader>
            <OrdemForm
              clientes={clientes}
              onSubmit={(data) => createMutation.mutate(data)}
              loading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{ordensAberta.length}</p>
              <p className="text-sm text-gray-600">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Truck className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{ordensAndamento.length}</p>
              <p className="text-sm text-gray-600">Em Andamento</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{ordensConcluidas.length}</p>
              <p className="text-sm text-gray-600">Concluídas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                R$ {ordensConcluidas.reduce((sum, o) => sum + (o.valor_servico || 0), 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-gray-600">Faturado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Ordens */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Ordens</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : ordensServico.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nenhuma ordem cadastrada</p>
          ) : (
            <div className="space-y-3">
              {ordensServico.map((ordem) => (
                <div key={ordem.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold">{ordem.cliente_nome}</h3>
                      <p className="text-sm text-gray-600">{formatTipoServicoCompact(ordem.tipo_servico)}</p>
                      {ordem.data_agendada && (
                        <p className="text-xs text-gray-500 mt-1">
                          📅 {new Date(ordem.data_agendada).toLocaleDateString('pt-BR')} às {ordem.hora_agendada}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold">R$ {ordem.valor_servico?.toLocaleString('pt-BR') || '0'}</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-2 ${statusCores[ordem.status]}`}>
                        {ordem.status}
                      </span>
                    </div>
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

function OrdemForm({ clientes, onSubmit, loading }) {
  const [form, setForm] = useState({
    cliente_id: '',
    cliente_nome: '',
    tipo_servico: 'manutencao',
    data_agendada: '',
    hora_agendada: '',
    valor_servico: '',
    descricao: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const handleClienteChange = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    setForm({
      ...form,
      cliente_id: clienteId,
      cliente_nome: cliente?.nome || ''
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Cliente *</label>
        <select
          value={form.cliente_id}
          onChange={(e) => handleClienteChange(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        >
          <option value="">Selecione um cliente</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Tipo de Serviço *</label>
        <select
          value={form.tipo_servico}
          onChange={(e) => setForm({...form, tipo_servico: e.target.value})}
          className="w-full border rounded px-3 py-2"
          required
        >
          <option value="instalacao">Instalação</option>
          <option value="manutencao">Manutenção</option>
          <option value="limpeza">Limpeza</option>
          <option value="reparo">Reparo</option>
          <option value="diagnostico">Diagnóstico</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Data *</label>
          <input
            type="date"
            value={form.data_agendada}
            onChange={(e) => setForm({...form, data_agendada: e.target.value})}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Hora</label>
          <input
            type="time"
            value={form.hora_agendada}
            onChange={(e) => setForm({...form, hora_agendada: e.target.value})}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Valor (R$)</label>
        <input
          type="number"
          step="0.01"
          value={form.valor_servico}
          onChange={(e) => setForm({...form, valor_servico: parseFloat(e.target.value)})}
          className="w-full border rounded px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Descrição</label>
        <textarea
          value={form.descricao}
          onChange={(e) => setForm({...form, descricao: e.target.value})}
          className="w-full border rounded px-3 py-2 h-20"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Criar Ordem
      </Button>
    </form>
  );
}