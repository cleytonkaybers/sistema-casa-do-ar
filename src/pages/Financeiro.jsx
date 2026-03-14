import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, Edit, Save, X, TrendingUp, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { TIPOS_SERVICOS } from '@/components/utils/tiposServicos';

export default function Financeiro() {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ preco_padrao: '', comissao_tecnico_percentual: 15 });
  const queryClient = useQueryClient();

  const { data: precificacoes = [], isLoading } = useQuery({
    queryKey: ['precificacoes'],
    queryFn: () => base44.entities.PrecificacaoServico.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PrecificacaoServico.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precificacoes'] });
      toast.success('Serviço duplicado removido!');
    },
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
      comissao_tecnico_percentual: prec.comissao_tecnico_percentual || 15
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
    const missing = TIPOS_SERVICOS.filter(t => !existingTipos.includes(t));
    
    for (const tipo of missing) {
      await createMutation.mutateAsync({
        tipo_servico: tipo,
        preco_padrao: 0,
        comissao_tecnico_percentual: 15,
        ativo: true
      });
    }
  };

  React.useEffect(() => {
    if (!isLoading && precificacoes.length >= 0) {
      const existingTipos = precificacoes.map(p => p.tipo_servico);
      const missing = TIPOS_SERVICOS.filter(t => !existingTipos.includes(t));
      
      if (missing.length > 0) {
        handleCreateMissing();
      }
    }
  }, [precificacoes.length, isLoading]);

  const sortedPrecificacoes = [...precificacoes].sort((a, b) => 
    a.tipo_servico.localeCompare(b.tipo_servico)
  );

  // Detectar duplicatas
  const groupedByTipo = {};
  precificacoes.forEach(prec => {
    if (!groupedByTipo[prec.tipo_servico]) {
      groupedByTipo[prec.tipo_servico] = [];
    }
    groupedByTipo[prec.tipo_servico].push(prec);
  });

  const duplicatas = Object.entries(groupedByTipo)
    .filter(([_, items]) => items.length > 1)
    .flatMap(([_, items]) => items.slice(1)); // Manter o primeiro, marcar os demais como duplicata

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

      {duplicatas.length > 0 && (
        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700 text-sm">
              ⚠️ {duplicatas.length} serviço(s) duplicado(s) encontrado(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {duplicatas.map((prec) => (
                <div key={prec.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200">
                  <p className="font-medium text-gray-900">{prec.tipo_servico}</p>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(prec.id)}
                  >
                    Remover Duplicata
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                        {prec.comissao_tecnico_percentual || 15}%
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