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
import { Edit2, Trash2, Save, X, Percent } from 'lucide-react';
import { toast } from 'sonner';
import NoPermission from '@/components/NoPermission';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function TabelaServicos() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [editingId, setEditingId] = useState(null);
  
  React.useEffect(() => {
    const checkAdmin = async () => {
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
    checkAdmin();
  }, [navigate]);
  const [editingValor, setEditingValor] = useState('');
  const [editingPercEquipe, setEditingPercEquipe] = useState('');
  const [editingPercTecnico, setEditingPercTecnico] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [novoTipo, setNovoTipo] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [novoPercEquipe, setNovoPercEquipe] = useState('30');
  const [novoPercTecnico, setNovoPercTecnico] = useState('15');
  const [isCustomType, setIsCustomType] = useState(true);
  const [customTipo, setCustomTipo] = useState('');
  const [bulkPercEquipe, setBulkPercEquipe] = useState('');
  const [bulkPercTecnico, setBulkPercTecnico] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState(null); // { campo: 'equipe'|'tecnico', valor: number }
  const queryClient = useQueryClient();

  const { data: valores = [] } = useQuery({
    queryKey: ['tiposServicoValor'],
    queryFn: () => base44.entities.TipoServicoValor.list()
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, valor_tabela, percentual_equipe, percentual_tecnico }) =>
      base44.entities.TipoServicoValor.update(id, { valor_tabela, percentual_equipe, percentual_tecnico }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiposServicoValor'] });
      setEditingId(null);
      toast.success('Valores atualizados');
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

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ campo, valor }) => {
      // Atualiza todos os tipos em paralelo. campo = 'percentual_equipe' ou 'percentual_tecnico'.
      const results = await Promise.allSettled(
        valores.map(v => base44.entities.TipoServicoValor.update(v.id, { [campo]: valor }))
      );
      const ok = results.filter(r => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }) => {
      queryClient.invalidateQueries({ queryKey: ['tiposServicoValor'] });
      setBulkConfirm(null);
      setBulkPercEquipe('');
      setBulkPercTecnico('');
      if (fail === 0) toast.success(`${ok} item(s) atualizado(s)`);
      else toast.error(`${ok} ok, ${fail} falharam`);
    },
    onError: () => toast.error('Erro ao aplicar em massa'),
  });

  const handleAplicarBulk = (campo) => {
    const valorStr = campo === 'percentual_equipe' ? bulkPercEquipe : bulkPercTecnico;
    const valor = parseFloat(String(valorStr).replace(',', '.'));
    if (Number.isNaN(valor) || valor < 0 || valor > 100) {
      toast.error('Informe um percentual entre 0 e 100');
      return;
    }
    if (valores.length === 0) {
      toast.error('Nenhum item na tabela');
      return;
    }
    setBulkConfirm({ campo, valor, label: campo === 'percentual_equipe' ? '% Equipe' : '% Técnico' });
  };

  const createMutation = useMutation({
    mutationFn: ({ tipo_servico, valor_tabela, percentual_equipe, percentual_tecnico }) =>
      base44.entities.TipoServicoValor.create({ tipo_servico, valor_tabela, percentual_equipe, percentual_tecnico, ativo: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiposServicoValor'] });
      setShowModal(false);
      setNovoTipo('');
      setNovoValor('');
      setNovoPercEquipe('30');
      setNovoPercTecnico('15');
      setCustomTipo('');
      setIsCustomType(true);
      toast.success('Tipo de serviço adicionado');
    },
    onError: () => toast.error('Erro ao adicionar')
  });

  if (!user) {
    return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;
  }
  
  if (user.role !== 'admin') return <NoPermission />;

  const handleAddTipo = () => {
    const tipoFinal = isCustomType ? customTipo : novoTipo;
    if (!tipoFinal || !novoValor) {
      toast.error('Preencha tipo e valor');
      return;
    }
    createMutation.mutate({
      tipo_servico: tipoFinal,
      valor_tabela: parseFloat(novoValor),
      percentual_equipe: parseFloat(novoPercEquipe) || 30,
      percentual_tecnico: parseFloat(novoPercTecnico) || 15
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
          {/* Painel de aplicação em massa: muda % de TODOS os itens de uma vez */}
          <div className="mb-4 p-3 sm:p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
            <div className="flex items-center gap-2 mb-3">
              <Percent className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-blue-300">Aplicar percentual em massa</span>
              <span className="text-xs text-gray-400">— altera TODOS os {valores.length} itens da tabela</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">% Equipe (todos)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="ex: 30"
                    value={bulkPercEquipe}
                    onChange={(e) => setBulkPercEquipe(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAplicarBulk('percentual_equipe')}
                  disabled={bulkUpdateMutation.isPending}
                >
                  Aplicar a todos
                </Button>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">% Técnico (todos)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="ex: 15"
                    value={bulkPercTecnico}
                    onChange={(e) => setBulkPercTecnico(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAplicarBulk('percentual_tecnico')}
                  disabled={bulkUpdateMutation.isPending}
                >
                  Aplicar a todos
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de Serviço</TableHead>
                  <TableHead>Valor (R$)</TableHead>
                  <TableHead>% Equipe</TableHead>
                  <TableHead>% Técnico</TableHead>
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
                          className="w-28"
                          autoFocus
                        />
                      ) : (
                        <span className="font-bold">R$ {item.valor_tabela.toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === item.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={editingPercEquipe}
                          onChange={(e) => setEditingPercEquipe(e.target.value)}
                          className="w-20"
                        />
                      ) : (
                        <span className="text-sm">{item.percentual_equipe || 30}%</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === item.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={editingPercTecnico}
                          onChange={(e) => setEditingPercTecnico(e.target.value)}
                          className="w-20"
                        />
                      ) : (
                        <span className="text-sm">{item.percentual_tecnico || 15}%</span>
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
                            onClick={() => updateMutation.mutate({ 
                              id: item.id, 
                              valor_tabela: parseFloat(editingValor),
                              percentual_equipe: parseFloat(editingPercEquipe),
                              percentual_tecnico: parseFloat(editingPercTecnico)
                            })}
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
                              setEditingPercEquipe((item.percentual_equipe || 30).toString());
                              setEditingPercTecnico((item.percentual_tecnico || 15).toString());
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
              <Label>Tipo de Serviço *</Label>
              <Input
                placeholder="Ex: Limpeza de 18k licitação 25/26"
                value={customTipo}
                onChange={(e) => setCustomTipo(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-gray-500">
                Digite o nome do novo tipo de serviço personalizado
              </p>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>% Comissão Equipe</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={novoPercEquipe}
                  onChange={(e) => setNovoPercEquipe(e.target.value)}
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label>% Comissão Técnico</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={novoPercTecnico}
                  onChange={(e) => setNovoPercTecnico(e.target.value)}
                  placeholder="15"
                />
              </div>
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

      <ConfirmDialog
        open={!!bulkConfirm}
        onClose={() => setBulkConfirm(null)}
        onConfirm={() => bulkConfirm && bulkUpdateMutation.mutate({ campo: bulkConfirm.campo, valor: bulkConfirm.valor })}
        title={`Aplicar ${bulkConfirm?.label} em todos`}
        description={`Vai atualizar ${bulkConfirm?.label} para ${bulkConfirm?.valor}% em ${valores.length} item(s) da tabela. Confirma?`}
        confirmText={bulkUpdateMutation.isPending ? 'Aplicando...' : 'Aplicar a todos'}
      />
    </div>
  );
}