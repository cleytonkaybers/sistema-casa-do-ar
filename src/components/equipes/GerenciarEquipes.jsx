import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Users, UserMinus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CORES = [
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Verde', value: '#22c55e' },
  { label: 'Roxo', value: '#a855f7' },
  { label: 'Laranja', value: '#f97316' },
  { label: 'Vermelho', value: '#ef4444' },
  { label: 'Rosa', value: '#ec4899' },
  { label: 'Ciano', value: '#06b6d4' },
  { label: 'Amarelo', value: '#eab308' },
];

export default function GerenciarEquipes() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingEquipe, setEditingEquipe] = useState(null);
  const [formData, setFormData] = useState({ nome: '', descricao: '', cor: '#3b82f6' });

  const { data: equipes = [], isLoading: loadingEquipes } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Equipe.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes'] });
      toast.success('Equipe criada!');
      setShowModal(false);
      setFormData({ nome: '', descricao: '', cor: '#3b82f6' });
    },
    onError: () => toast.error('Erro ao criar equipe'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Equipe.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes'] });
      toast.success('Equipe atualizada!');
      setShowModal(false);
      setEditingEquipe(null);
    },
    onError: () => toast.error('Erro ao atualizar equipe'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (equipe) => {
      // Remove a equipe de todos os usuários que a pertencem
      const membros = usuarios.filter(u => u.equipe_id === equipe.id);
      await Promise.all(membros.map(u =>
        base44.entities.User.update(u.id, { equipe_id: null, equipe_nome: null })
      ));
      return base44.entities.Equipe.delete(equipe.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes'] });
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Equipe excluída!');
    },
    onError: () => toast.error('Erro ao excluir equipe'),
  });

  const removeMembroMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.update(userId, { equipe_id: null, equipe_nome: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Membro removido da equipe!');
    },
  });

  const adicionarMembroMutation = useMutation({
    mutationFn: ({ userId, equipe }) =>
      base44.entities.User.update(userId, { equipe_id: equipe.id, equipe_nome: equipe.nome }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Membro adicionado à equipe!');
    },
  });

  const handleSave = () => {
    if (!formData.nome.trim()) {
      toast.error('Nome da equipe é obrigatório');
      return;
    }
    if (editingEquipe) {
      updateMutation.mutate({ id: editingEquipe.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (equipe) => {
    setEditingEquipe(equipe);
    setFormData({ nome: equipe.nome, descricao: equipe.descricao || '', cor: equipe.cor || '#3b82f6' });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingEquipe(null);
    setFormData({ nome: '', descricao: '', cor: '#3b82f6' });
    setShowModal(true);
  };

  const getMembros = (equipeId) => usuarios.filter(u => u.equipe_id === equipeId);
  const getSemEquipe = () => usuarios.filter(u => !u.equipe_id);

  if (loadingEquipes) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" />
          Equipes
        </h2>
        <Button onClick={handleNew} className="bg-gradient-to-r from-cyan-500 to-blue-500" size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nova Equipe
        </Button>
      </div>

      {equipes.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Nenhuma equipe criada ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {equipes.map(equipe => {
            const membros = getMembros(equipe.id);
            const semEquipe = getSemEquipe();
            return (
              <Card key={equipe.id} className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: equipe.cor || '#3b82f6' }} />
                      <CardTitle className="text-white text-base">{equipe.nome}</CardTitle>
                      <Badge className="bg-slate-600 text-slate-200 text-xs">{membros.length} membros</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => handleEdit(equipe)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400" onClick={() => deleteMutation.mutate(equipe)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {equipe.descricao && <p className="text-slate-400 text-xs mt-1">{equipe.descricao}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Membros atuais */}
                  <div className="space-y-1.5">
                    {membros.length === 0 ? (
                      <p className="text-slate-500 text-xs italic">Sem membros ainda</p>
                    ) : (
                      membros.map(u => (
                        <div key={u.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-1.5">
                          <span className="text-slate-200 text-sm">{u.full_name || u.email}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-red-400"
                            onClick={() => removeMembroMutation.mutate(u.id)}
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Adicionar membro */}
                  {semEquipe.length > 0 && (
                    <Select
                      onValueChange={(userId) => adicionarMembroMutation.mutate({ userId, equipe })}
                      value=""
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-300 text-sm h-8">
                        <SelectValue placeholder="+ Adicionar membro..." />
                      </SelectTrigger>
                      <SelectContent>
                        {semEquipe.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Usuários sem equipe */}
      {getSemEquipe().length > 0 && (
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
          <p className="text-slate-400 text-sm font-medium mb-2">Usuários sem equipe ({getSemEquipe().length})</p>
          <div className="flex flex-wrap gap-2">
            {getSemEquipe().map(u => (
              <Badge key={u.id} className="bg-slate-700 text-slate-300">{u.full_name || u.email}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Modal criar/editar equipe */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEquipe ? 'Editar Equipe' : 'Nova Equipe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nome da equipe *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Equipe 1, Equipe Norte..."
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição da equipe..."
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CORES.map(cor => (
                  <button
                    key={cor.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, cor: cor.value })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${formData.cor === cor.value ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: cor.value }}
                    title={cor.label}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-gradient-to-r from-cyan-500 to-blue-500"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                ) : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}