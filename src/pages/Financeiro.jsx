import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, Edit, Save, X, TrendingUp, Percent } from 'lucide-react';
import { toast } from 'sonner';

const tiposServico = [
  "Limpeza de 9k",
  "Limpeza de 12k",
  "Limpeza de 18k",
  "Limpeza de 22 a 24k",
  "Limpeza de 24k",
  "Limpeza de 30 a 32k",
  "Limpeza piso e teto",
  "Instalação de 9k",
  "Instalação de 12k",
  "Instalação de 18k",
  "Instalação de 22 a 24k",
  "Instalação de 24k",
  "Instalação de 30 a 32k",
  "Instalação piso e teto",
  "Instalação de cortina de ar",
  "Mudança + limpeza ar 9/12/18",
  "Mudança + limpeza 22/24/30",
  "Retirada cortina de ar",
  "Troca de compressor",
  "Troca de capacitor",
  "Recarga de gás",
  "Carga de gás completa",
  "Serviço de solda",
  "Troca de relé da placa",
  "Troca de sensor",
  "Troca de chave contadora",
  "Conserto de placa eletrônica",
  "Retirada de ar condicionado",
  "Serviço de passar tubulação de infra",
  "Ver defeito",
  "Troca de local",
  "Outro tipo de serviço"
];

export default function Financeiro() {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ preco_padrao: '', comissao_tecnico_percentual: 50 });
  const queryClient = useQueryClient();

  const { data: precificacoes = [], isLoading } = useQuery({
    queryKey: ['precificacoes'],
    queryFn: () => base44.entities.PrecificacaoServico.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PrecificacaoServico.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precificacoes'] });
      toast.success('Precificação criada com sucesso!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PrecificacaoServico.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precificacoes'] });
      setEditingId(null);
      toast.success('Precificação atualizada!');
    },
  });

  const handleEdit = (prec) => {
    setEditingId(prec.id);
    setEditForm({
      preco_padrao: prec.preco_padrao || '',
      comissao_tecnico_percentual: prec.comissao_tecnico_percentual || 50
    });
  };

  const handleSave = (id) => {
    updateMutation.mutate({
      id,
      data: {
        preco_padrao: parseFloat(editForm.preco_padrao),
        comissao_tecnico_percentual: parseFloat(editForm.comissao_tecnico_percentual)
      }
    });
  };

  const handleCreateMissing = async () => {
    const existingTipos = precificacoes.map(p => p.tipo_servico);
    const missing = tiposServico.filter(t => !existingTipos.includes(t));
    
    for (const tipo of missing) {
      await createMutation.mutateAsync({
        tipo_servico: tipo,
        preco_padrao: 0,
        comissao_tecnico_percentual: 50,
        ativo: true
      });
    }
  };

  React.useEffect(() => {
    if (precificacoes.length === 0 && !isLoading) {
      handleCreateMissing();
    }
  }, [precificacoes.length, isLoading]);

  const sortedPrecificacoes = [...precificacoes].sort((a, b) => 
    a.tipo_servico.localeCompare(b.tipo_servico)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-600 mt-1">Gerencie os preços dos serviços e comissões</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg">
          <DollarSign className="w-5 h-5" />
          <span className="font-semibold">Precificação de Serviços</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Tabela de Preços e Comissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedPrecificacoes.map((prec) => (
              <div
                key={prec.id}
                className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{prec.tipo_servico}</p>
                </div>

                {editingId === prec.id ? (
                  <>
                    <div className="w-40">
                      <Label className="text-xs text-gray-600">Preço (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.preco_padrao}
                        onChange={(e) => setEditForm({ ...editForm, preco_padrao: e.target.value })}
                        className="mt-1"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs text-gray-600">Comissão (%)</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={editForm.comissao_tecnico_percentual}
                        onChange={(e) => setEditForm({ ...editForm, comissao_tecnico_percentual: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(prec.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-right w-32">
                      <p className="text-xs text-gray-500">Preço</p>
                      <p className="text-lg font-bold text-green-600">
                        R$ {(prec.preco_padrao || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right w-28">
                      <p className="text-xs text-gray-500">Comissão</p>
                      <p className="text-sm font-semibold text-blue-600 flex items-center justify-end gap-1">
                        {prec.comissao_tecnico_percentual || 50}%
                        <Percent className="w-3 h-3" />
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(prec)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}