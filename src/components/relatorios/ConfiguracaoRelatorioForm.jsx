import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguracaoRelatorioForm({ open, onClose, configuracao }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    nome: '',
    periodicidade: 'diaria',
    dia_envio: 1,
    filtro_tipo_servico: '',
    filtro_cliente: '',
    filtro_status: '',
    destinatarios_admins: [],
    enviar_para_clientes: false,
    ativo: true,
  });
  const [novoEmail, setNovoEmail] = useState('');

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  useEffect(() => {
    if (configuracao) {
      setFormData({
        nome: configuracao.nome || '',
        periodicidade: configuracao.periodicidade || 'diaria',
        dia_envio: configuracao.dia_envio || 1,
        filtro_tipo_servico: configuracao.filtro_tipo_servico || '',
        filtro_cliente: configuracao.filtro_cliente || '',
        filtro_status: configuracao.filtro_status || '',
        destinatarios_admins: configuracao.destinatarios_admins || [],
        enviar_para_clientes: configuracao.enviar_para_clientes || false,
        ativo: configuracao.ativo !== undefined ? configuracao.ativo : true,
      });
    } else {
      setFormData({
        nome: '',
        periodicidade: 'diaria',
        dia_envio: 1,
        filtro_tipo_servico: '',
        filtro_cliente: '',
        filtro_status: '',
        destinatarios_admins: [],
        enviar_para_clientes: false,
        ativo: true,
      });
    }
  }, [configuracao, open]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (configuracao) {
        return base44.entities.ConfiguracaoRelatorio.update(configuracao.id, data);
      }
      return base44.entities.ConfiguracaoRelatorio.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-relatorio'] });
      toast.success(configuracao ? 'Configuração atualizada!' : 'Configuração criada!');
      onClose();
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nome) {
      toast.error('Nome é obrigatório');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleAddEmail = () => {
    if (novoEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)) {
      if (!formData.destinatarios_admins.includes(novoEmail)) {
        setFormData({
          ...formData,
          destinatarios_admins: [...formData.destinatarios_admins, novoEmail]
        });
        setNovoEmail('');
      } else {
        toast.error('E-mail já adicionado');
      }
    } else {
      toast.error('E-mail inválido');
    }
  };

  const handleRemoveEmail = (email) => {
    setFormData({
      ...formData,
      destinatarios_admins: formData.destinatarios_admins.filter(e => e !== email)
    });
  };

  const admins = usuarios.filter(u => u.role === 'admin');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {configuracao ? 'Editar Configuração' : 'Nova Configuração de Relatório'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Configuração *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Relatório Semanal de Limpezas"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodicidade">Periodicidade *</Label>
              <Select
                value={formData.periodicidade}
                onValueChange={(value) => setFormData({ ...formData, periodicidade: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.periodicidade === 'semanal' && (
              <div className="space-y-2">
                <Label htmlFor="dia_envio">Dia da Semana</Label>
                <Select
                  value={String(formData.dia_envio)}
                  onValueChange={(value) => setFormData({ ...formData, dia_envio: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Domingo</SelectItem>
                    <SelectItem value="1">Segunda-feira</SelectItem>
                    <SelectItem value="2">Terça-feira</SelectItem>
                    <SelectItem value="3">Quarta-feira</SelectItem>
                    <SelectItem value="4">Quinta-feira</SelectItem>
                    <SelectItem value="5">Sexta-feira</SelectItem>
                    <SelectItem value="6">Sábado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.periodicidade === 'mensal' && (
              <div className="space-y-2">
                <Label htmlFor="dia_envio">Dia do Mês</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={formData.dia_envio}
                  onChange={(e) => setFormData({ ...formData, dia_envio: parseInt(e.target.value) || 1 })}
                />
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Filtros (opcional)</h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="filtro_tipo_servico">Tipo de Serviço</Label>
                <Select
                  value={formData.filtro_tipo_servico}
                  onValueChange={(value) => setFormData({ ...formData, filtro_tipo_servico: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos os tipos</SelectItem>
                    <SelectItem value="Limpeza de 9k">Limpeza de 9k</SelectItem>
                    <SelectItem value="Limpeza de 12k">Limpeza de 12k</SelectItem>
                    <SelectItem value="Instalação de 9k">Instalação de 9k</SelectItem>
                    <SelectItem value="Instalação de 12k">Instalação de 12k</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filtro_status">Status</Label>
                <Select
                  value={formData.filtro_status}
                  onValueChange={(value) => setFormData({ ...formData, filtro_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos os status</SelectItem>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="andamento">Em Andamento</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Destinatários</h3>
            
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Digite um e-mail"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmail())}
                />
                <Button type="button" onClick={handleAddEmail}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {admins.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-gray-500">Ou selecione administradores:</Label>
                  <div className="flex flex-wrap gap-2">
                    {admins.map(admin => (
                      <Button
                        key={admin.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!formData.destinatarios_admins.includes(admin.email)) {
                            setFormData({
                              ...formData,
                              destinatarios_admins: [...formData.destinatarios_admins, admin.email]
                            });
                          }
                        }}
                        className="text-xs"
                      >
                        {admin.full_name || admin.email}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {formData.destinatarios_admins.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">E-mails selecionados:</Label>
                  <div className="flex flex-wrap gap-2">
                    {formData.destinatarios_admins.map((email, idx) => (
                      <Badge key={idx} variant="secondary" className="pr-1">
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="ml-2 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={formData.enviar_para_clientes}
                  onCheckedChange={(checked) => setFormData({ ...formData, enviar_para_clientes: checked })}
                />
                <Label>Enviar também para os clientes dos serviços</Label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t pt-4">
            <Switch
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
            />
            <Label>Configuração ativa</Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : configuracao ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}