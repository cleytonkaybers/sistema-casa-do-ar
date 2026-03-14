import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS_SERVICO = [
  "Limpeza de 9k", "Limpeza de 12k", "Limpeza de 18k", "Limpeza de 22 a 24k", "Limpeza de 24k",
  "Limpeza de 30 a 32k", "Limpeza piso e teto", "Instalação de 9k", "Instalação de 12k",
  "Instalação de 18k", "Instalação de 22 a 24k", "Instalação de 24k", "Instalação de 30 a 32k",
  "Instalação piso e teto", "Instalação de cortina de ar", "Mudança + limpeza ar 9/12/18",
  "Mudança + limpeza 22/24/30", "Retirada cortina de ar", "Troca de compressor", "Troca de capacitor",
  "Recarga de gás", "Carga de gás completa", "Serviço de solda", "Troca de relé da placa",
  "Troca de sensor", "Troca de chave contadora", "Conserto de placa eletrônica", "Retirada de ar condicionado",
  "Serviço de passar tubulação de infra", "Ver defeito", "Troca de local", "Outro tipo de serviço"
];

export default function TabelaServicos() {
  const [editingId, setEditingId] = useState(null);
  const [editingValor, setEditingValor] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [novoTipo, setNovoTipo] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [isCustomType, setIsCustomType] = useState(false);
  const queryClient = useQueryClient();

  const { data: valores = [] } = useQuery({
    queryKey: ['tiposServicoValor'],
    queryFn: () => base44.entities.TipoServicoValor.list()
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, valor_tabela }) =>
      base44.entities.TipoServicoValor.update(id, { valor_tabela }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiposServicoValor'] });
      setEditingId(null);
      toast.success('Valor atualizado');
    },
    onError: () => toast.error('Erro ao atualizar')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TipoServicoValor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiposServicoValor'] });
      toast.success('Valor removido');
    },
    onError: () => toast.error('Erro ao remover')
  });

  const createMutation = useMutation({
    mutationFn: ({ tipo_servico, valor_tabela }) =>
      base44.entities.TipoServicoValor.create({ tipo_servico, valor_tabela, ativo: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiposServicoValor'] });
      setShowModal(false);
      setNovoTipo('');
      setNovoValor('');
      setIsCustomType(false);
      toast.success('Tipo de serviço adicionado');
    },
    onError: () => toast.error('Erro ao adicionar')
  });

  const tiposComValor = valores.map(v => v.tipo_servico);
  const tiposSemValor = TIPOS_SERVICO.filter(t => !tiposComValor.includes(t));

  const handleAddTipo = () => {
    if (!novoTipo || !novoValor) {
      toast.error('Preencha tipo e valor');
      return;
    }
    createMutation.mutate({
      tipo_servico: novoTipo,
      valor_tabela: parseFloat(novoValor)
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tabela de Valores de Serviços</CardTitle>
          <Button onClick={() => setShowModal(true)} size="sm">
            + Adicionar Serviço
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de Serviço</TableHead>
                  <TableHead>Valor (R$)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valores.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.tipo_servico}</TableCell>
                    <TableCell>
                      {editingId === item.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editingValor}
                          onChange={(e) => setEditingValor(e.target.value)}
                          className="w-32"
                          autoFocus
                        />
                      ) : (
                        <span className="font-bold">R$ {item.valor_tabela.toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.ativo ? 'default' : 'secondary'}>
                        {item.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      {editingId === item.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateMutation.mutate({ id: item.id, valor_tabela: parseFloat(editingValor) })}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditingValor(item.valor_tabela.toString());
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Serviço</Label>
              {!isCustomType ? (
                <div className="space-y-2">
                  <select
                    value={novoTipo}
                    onChange={(e) => setNovoTipo(e.target.value)}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="">Selecione...</option>
                    {tiposSemValor.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsCustomType(true);
                      setNovoTipo('');
                    }}
                    className="w-full"
                  >
                    + Criar Tipo Customizado
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Ex: 1/2 carga de gás"
                    value={novoTipo}
                    onChange={(e) => setNovoTipo(e.target.value)}
                    autoFocus
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsCustomType(false);
                      setNovoTipo('');
                    }}
                    className="w-full"
                  >
                    Voltar aos Serviços Pré-definidos
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddTipo} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}