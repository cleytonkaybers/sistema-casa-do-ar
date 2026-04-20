import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Save, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';
import ClientHealthSummary from '../components/clientes/ClientHealthSummary';
import ClientHistoryTimeline from '../components/clientes/ClientHistoryTimeline';
import { createPageUrl } from '../utils';
import { useNavigate } from 'react-router-dom';

export default function ClienteDetalhes() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clienteId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});

  const { data: cliente, isLoading: clienteLoading } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: async () => {
      const clientes = await base44.entities.Cliente.filter({ id: clienteId });
      return clientes[0] || null;
    },
    enabled: !!clienteId
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos', clienteId],
    queryFn: async () => {
      if (!cliente) return [];
      return await base44.entities.Servico.filter({ cliente_nome: cliente.nome });
    },
    enabled: !!cliente
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos', clienteId],
    queryFn: async () => {
      if (!cliente) return [];
      return await base44.entities.Atendimento.filter({ cliente_nome: cliente.nome });
    },
    enabled: !!cliente
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Cliente.update(clienteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setEditMode(false);
      toast.success('Cliente atualizado com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar cliente')
  });

  React.useEffect(() => {
    if (cliente) {
      setFormData({
        nome: cliente.nome || '',
        telefone: cliente.telefone || '',
        endereco: cliente.endereco || '',
        segmentacao: cliente.segmentacao || 'Regular',
        notas_internas: cliente.notas_internas || ''
      });
    }
  }, [cliente]);

  const handleSave = () => {
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    updateMutation.mutate(formData);
  };

  const totalGasto = servicos.reduce((sum, s) => sum + (s.valor || 0), 0) +
                     atendimentos.reduce((sum, a) => sum + (a.valor || 0), 0);

  const ultimoServico = [
    ...servicos.map(s => s.data_programada),
    ...atendimentos.map(a => a.data_atendimento)
  ].sort().reverse()[0];

  if (!clienteId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cliente não encontrado</p>
      </div>
    );
  }

  if (clienteLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cliente não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Clientes'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-200">{cliente.nome}</h1>
            <div className="flex items-center gap-2 mt-2 text-gray-400">
              <Phone className="w-4 h-4" />
              <span>{cliente.telefone}</span>
            </div>
          </div>
        </div>
        <Button
          onClick={() => setEditMode(!editMode)}
          className={editMode ? 'bg-white/10 hover:bg-white/15 text-gray-200 border border-white/10' : 'bg-blue-600 hover:bg-blue-700 text-white'}
        >
          {editMode ? 'Cancelar' : 'Editar'}
        </Button>
      </div>

      {/* Health Summary */}
      <ClientHealthSummary
        cliente={cliente}
        ultimoServico={ultimoServico}
        proximaManutencao={cliente.proxima_manutencao}
        totalGasto={totalGasto}
      />

      {/* Edit Mode */}
      {editMode && (
        <Card className="bg-[#152236] border border-white/5 shadow-md">
          <CardHeader>
            <CardTitle className="text-gray-200">Editar Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300">Nome</label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="mt-1 bg-[#0f1a2b] border-white/10 text-gray-200 placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300">Telefone</label>
              <Input
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="mt-1 bg-[#0f1a2b] border-white/10 text-gray-200 placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300">Endereço</label>
              <Input
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                className="mt-1 bg-[#0f1a2b] border-white/10 text-gray-200 placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300">Segmentação</label>
              <Select
                value={formData.segmentacao}
                onValueChange={(value) => setFormData({ ...formData, segmentacao: value })}
              >
                <SelectTrigger className="mt-1 bg-[#0f1a2b] border-white/10 text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Potencial">Potencial</SelectItem>
                  <SelectItem value="Regular">Regular</SelectItem>
                  <SelectItem value="VIP">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300">Notas Internas</label>
              <Textarea
                value={formData.notas_internas}
                onChange={(e) => setFormData({ ...formData, notas_internas: e.target.value })}
                className="mt-1 min-h-24 bg-[#0f1a2b] border-white/10 text-gray-200 placeholder:text-gray-500"
                placeholder="Adicione notas confidenciais sobre o cliente..."
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Location */}
        {cliente.endereco && (
          <Card className="bg-[#152236] border border-white/5 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-400">Endereço</p>
                  <p className="text-gray-200 mt-1">{cliente.endereco}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Internal Notes */}
        {cliente.notas_internas && (
          <Card className="bg-blue-500/10 border border-blue-500/30 shadow-md">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-blue-300 mb-2">📝 Notas Internas</p>
              <p className="text-blue-200 text-sm">{cliente.notas_internas}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* History Timeline */}
      <ClientHistoryTimeline
        servicos={servicos}
        atendimentos={atendimentos}
      />
    </div>
  );
}