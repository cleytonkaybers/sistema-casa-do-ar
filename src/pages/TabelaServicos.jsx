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
import NoPermission from '@/components/NoPermission';
import { useNavigate } from 'react-router-dom';

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
    </div>
  );
}