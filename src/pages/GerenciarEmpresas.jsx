import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Building2, Plus, Pencil, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useEmpresa } from '@/components/auth/EmpresaGuard';
import NoPermission from '@/components/NoPermission';

export default function GerenciarEmpresas() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useEmpresa();
  const [formOpen, setFormOpen] = useState(false);
  const [adminFormOpen, setAdminFormOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [editingEmpresa, setEditingEmpresa] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    telefone: '',
    email: '',
    endereco: '',
    plano: 'basico',
    ativa: true
  });

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list('-created_date'),
    enabled: isSuperAdmin()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Empresa.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      setFormOpen(false);
      resetForm();
      toast.success('Empresa cadastrada!');
    },
    onError: () => toast.error('Erro ao cadastrar empresa')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Empresa.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      setFormOpen(false);
      resetForm();
      toast.success('Empresa atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar empresa')
  });

  const createAdminMutation = useMutation({
    mutationFn: async ({ email, empresaId }) => {
      await base44.users.inviteUser(email, 'user');
      return { email, empresaId };
    },
    onSuccess: (data) => {
      toast.success(`Convite enviado para ${data.email}! Após aceitar, configure-o como admin_empresa na página de Usuários.`);
      setAdminFormOpen(false);
      setAdminEmail('');
      setSelectedEmpresa(null);
    },
    onError: (error) => {
      toast.error('Erro ao convidar administrador: ' + (error.message || 'Tente novamente'));
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      cnpj: '',
      telefone: '',
      email: '',
      endereco: '',
      plano: 'basico',
      ativa: true
    });
    setEditingEmpresa(null);
  };

  const handleEdit = (empresa) => {
    setEditingEmpresa(empresa);
    setFormData(empresa);
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!formData.nome.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }

    if (editingEmpresa) {
      updateMutation.mutate({ id: editingEmpresa.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleConvidarAdmin = (empresa) => {
    setSelectedEmpresa(empresa);
    setAdminFormOpen(true);
  };

  const handleEnviarConvite = () => {
    if (!adminEmail.trim()) {
      toast.error('Digite um email válido');
      return;
    }
    createAdminMutation.mutate({ email: adminEmail, empresaId: selectedEmpresa.id });
  };

  if (!isSuperAdmin()) {
    return <NoPermission />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gerenciar Empresas</h1>
          <p className="text-gray-500 mt-1">{empresas.length} empresas cadastradas</p>
        </div>
        <Button onClick={() => { resetForm(); setFormOpen(true); }} className="bg-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {empresas.map((empresa) => (
            <Card key={empresa.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{empresa.nome}</CardTitle>
                      <Badge className={empresa.ativa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                        {empresa.ativa ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {empresa.cnpj && <p className="text-sm text-gray-600">CNPJ: {empresa.cnpj}</p>}
                {empresa.email && <p className="text-sm text-gray-600">Email: {empresa.email}</p>}
                {empresa.telefone && <p className="text-sm text-gray-600">Tel: {empresa.telefone}</p>}
                <div className="pt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(empresa)} className="flex-1">
                    <Pencil className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleConvidarAdmin(empresa)} className="flex-1 text-blue-600">
                    <UserPlus className="w-3 h-3 mr-1" />
                    Admin
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEmpresa ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome da Empresa *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Empresa ABC Ltda"
                />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="col-span-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contato@empresa.com"
                />
              </div>
              <div className="col-span-2">
                <Label>Endereço</Label>
                <Input
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>
              <div>
                <Label>Plano</Label>
                <Select value={formData.plano} onValueChange={(v) => setFormData({ ...formData, plano: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basico">Básico</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="empresarial">Empresarial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>Empresa Ativa</Label>
                <Switch
                  checked={formData.ativa}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativa: checked })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 bg-blue-600">
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                ) : (
                  editingEmpresa ? 'Atualizar' : 'Cadastrar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={adminFormOpen} onOpenChange={setAdminFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Administrador - {selectedEmpresa?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email do Administrador</Label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@empresa.com"
              />
              <p className="text-xs text-gray-500 mt-2">
                O usuário receberá um convite por email. Após aceitar, você precisa:
                <br />1. Ir em "Usuários"
                <br />2. Editar o usuário e definir empresa_id: {selectedEmpresa?.id}
                <br />3. Definir tipo_usuario como "admin_empresa"
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAdminFormOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleEnviarConvite} disabled={createAdminMutation.isPending} className="flex-1 bg-blue-600">
                {createAdminMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                ) : (
                  <>Enviar Convite</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}