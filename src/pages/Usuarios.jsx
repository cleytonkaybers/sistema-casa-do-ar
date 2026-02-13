import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, UserPlus, Users, Shield, Mail, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '../components/auth/PermissionGuard';

const perfisPreDefinidos = {
  admin: {
    label: 'Administrador',
    color: 'bg-red-500',
    permissoes: {
      clientes_criar: true,
      clientes_editar: true,
      clientes_deletar: true,
      servicos_criar: true,
      servicos_editar: true,
      servicos_deletar: true,
      atendimentos_criar: true,
      atendimentos_editar: true,
      atendimentos_deletar: true
    }
  },
  gerente: {
    label: 'Gerente',
    color: 'bg-blue-500',
    permissoes: {
      clientes_criar: true,
      clientes_editar: true,
      clientes_deletar: false,
      servicos_criar: true,
      servicos_editar: true,
      servicos_deletar: false,
      atendimentos_criar: true,
      atendimentos_editar: true,
      atendimentos_deletar: false
    }
  },
  tecnico: {
    label: 'Técnico',
    color: 'bg-green-500',
    permissoes: {
      clientes_criar: false,
      clientes_editar: true,
      clientes_deletar: false,
      servicos_criar: false,
      servicos_editar: true,
      servicos_deletar: false,
      atendimentos_criar: true,
      atendimentos_editar: true,
      atendimentos_deletar: false
    }
  },
  atendente: {
    label: 'Atendente',
    color: 'bg-purple-500',
    permissoes: {
      clientes_criar: true,
      clientes_editar: false,
      clientes_deletar: false,
      servicos_criar: true,
      servicos_editar: false,
      servicos_deletar: false,
      atendimentos_criar: true,
      atendimentos_editar: false,
      atendimentos_deletar: false
    }
  }
};

export default function UsuariosPage() {
  const { isAdmin, loading: authLoading } = usePermissions();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePerfil, setInvitePerfil] = useState('atendente');
  const [invitePassword, setInvitePassword] = useState('');

  const queryClient = useQueryClient();

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
    enabled: !authLoading
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Permissões atualizadas!');
      setShowEditModal(false);
      setEditingUser(null);
    },
    onError: () => toast.error('Erro ao atualizar permissões')
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuário deletado com sucesso!');
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    },
    onError: () => toast.error('Erro ao deletar usuário')
  });

  const createUserMutation = useMutation({
    mutationFn: async ({ email, senha, perfil }) => {
      // Implementar criação direta via API ou backend
      // Por enquanto, usando o inviteUser que é o disponível
      const perfil_config = perfisPreDefinidos[perfil];
      
      // Cria usuário via API do auth
      await base44.users.inviteUser(email, 'user');
      
      // Aguarda criação
      let newUser = null;
      for (let i = 0; i < 10; i++) {
        const allUsers = await base44.entities.User.list();
        newUser = allUsers.find(u => u.email === email);
        if (newUser) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (newUser) {
        await base44.entities.User.update(newUser.id, {
          perfil: perfil,
          permissoes: perfil_config.permissoes
        });
      }
      
      return newUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuário criado com sucesso!');
      setShowInviteModal(false);
      setInviteEmail('');
      setInvitePassword('');
      setInvitePerfil('atendente');
    },
    onError: () => toast.error('Erro ao criar usuário')
  });

  const handleInvite = async () => {
    if (!inviteEmail || !invitePassword) {
      toast.error('Preencha email e senha');
      return;
    }

    createUserMutation.mutate({
      email: inviteEmail,
      senha: invitePassword,
      perfil: invitePerfil
    });
  };

  const handleEditPermissions = (user) => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem editar permissões');
      return;
    }
    setEditingUser({
      ...user,
      permissoes: user.permissoes || perfisPreDefinidos.atendente.permissoes
    });
    setShowEditModal(true);
  };

  const handleSavePermissions = () => {
    if (!editingUser) return;
    
    updateUserMutation.mutate({
      id: editingUser.id,
      data: {
        perfil: editingUser.perfil,
        permissoes: editingUser.permissoes
      }
    });
  };

  const handlePerfilChange = (perfil) => {
    if (!editingUser) return;
    setEditingUser({
      ...editingUser,
      perfil,
      permissoes: perfisPreDefinidos[perfil].permissoes
    });
  };

  const togglePermission = (key) => {
    if (!editingUser) return;
    setEditingUser({
      ...editingUser,
      permissoes: {
        ...editingUser.permissoes,
        [key]: !editingUser.permissoes[key]
      }
    });
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h1>
        <p className="text-gray-600">Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
         <div>
           <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">Gerenciar Usuários</h1>
            <p className="text-gray-400 mt-1">Total de usuários ativos: <span className="text-cyan-400 font-bold">{usuarios.length}</span></p>
         </div>
         <Button
           onClick={() => setShowInviteModal(true)}
           className="bg-gradient-to-r from-blue-500 to-cyan-500"
         >
           <UserPlus className="w-5 h-5 mr-2" />
           Novo Usuário
         </Button>
       </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {usuarios.map(usuario => {
            const perfilInfo = perfisPreDefinidos[usuario.perfil || 'atendente'];
            return (
              <Card key={usuario.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{usuario.full_name || usuario.email}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">{usuario.email}</p>
                    </div>
                    <Badge className={`${perfilInfo.color} text-white`}>
                      {perfilInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                 <CardContent>
                   <div className="flex gap-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => handleEditPermissions(usuario)}
                       disabled={!isAdmin}
                       className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       <Edit className="w-4 h-4 mr-2" />
                       Editar
                     </Button>
                     <Button
                       variant="destructive"
                       size="sm"
                       onClick={() => handleDeleteClick(usuario)}
                       disabled={!isAdmin}
                       className="disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       <Trash2 className="w-4 h-4" />
                     </Button>
                   </div>
                 </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Convite */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
       <DialogContent>
         <DialogHeader>
           <DialogTitle>Criar Novo Usuário</DialogTitle>
         </DialogHeader>
         <div className="space-y-4 mt-4">
           <div className="space-y-2">
             <Label>Email</Label>
             <Input
               type="email"
               placeholder="usuario@example.com"
               value={inviteEmail}
               onChange={(e) => setInviteEmail(e.target.value)}
             />
           </div>
           <div className="space-y-2">
             <Label>Senha</Label>
             <Input
               type="password"
               placeholder="••••••••"
               value={invitePassword}
               onChange={(e) => setInvitePassword(e.target.value)}
             />
           </div>
           <div className="space-y-2">
             <Label>Perfil</Label>
             <Select value={invitePerfil} onValueChange={setInvitePerfil}>
               <SelectTrigger>
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="atendente">Atendente</SelectItem>
                 <SelectItem value="tecnico">Técnico</SelectItem>
                 <SelectItem value="gerente">Gerente</SelectItem>
                 <SelectItem value="admin">Administrador</SelectItem>
               </SelectContent>
             </Select>
           </div>
           <div className="flex justify-end gap-3 pt-4">
             <Button variant="outline" onClick={() => setShowInviteModal(false)}>
               Cancelar
             </Button>
             <Button 
               onClick={handleInvite} 
               disabled={createUserMutation.isPending}
               className="bg-gradient-to-r from-blue-500 to-cyan-500"
             >
               {createUserMutation.isPending ? (
                 <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</>
               ) : (
                 'Criar Usuário'
               )}
             </Button>
           </div>
         </div>
       </DialogContent>
      </Dialog>

      {/* Modal de Edição de Permissões */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Permissões - {editingUser?.full_name || editingUser?.email}</DialogTitle>
          </DialogHeader>
          
          {editingUser && (
            <div className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label>Perfil Pré-Definido</Label>
                <Select value={editingUser.perfil || 'atendente'} onValueChange={handlePerfilChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atendente">Atendente</SelectItem>
                    <SelectItem value="tecnico">Técnico</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-gray-700">Permissões Personalizadas</h3>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-600">Clientes</h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex items-center justify-between">
                      <Label>Criar Clientes</Label>
                      <Switch
                        checked={editingUser.permissoes?.clientes_criar || false}
                        onCheckedChange={() => togglePermission('clientes_criar')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Editar Clientes</Label>
                      <Switch
                        checked={editingUser.permissoes?.clientes_editar || false}
                        onCheckedChange={() => togglePermission('clientes_editar')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Deletar Clientes</Label>
                      <Switch
                        checked={editingUser.permissoes?.clientes_deletar || false}
                        onCheckedChange={() => togglePermission('clientes_deletar')}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-600">Serviços</h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex items-center justify-between">
                      <Label>Criar Serviços</Label>
                      <Switch
                        checked={editingUser.permissoes?.servicos_criar || false}
                        onCheckedChange={() => togglePermission('servicos_criar')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Editar Serviços</Label>
                      <Switch
                        checked={editingUser.permissoes?.servicos_editar || false}
                        onCheckedChange={() => togglePermission('servicos_editar')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Deletar Serviços</Label>
                      <Switch
                        checked={editingUser.permissoes?.servicos_deletar || false}
                        onCheckedChange={() => togglePermission('servicos_deletar')}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-600">Atendimentos</h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex items-center justify-between">
                      <Label>Criar Atendimentos</Label>
                      <Switch
                        checked={editingUser.permissoes?.atendimentos_criar || false}
                        onCheckedChange={() => togglePermission('atendimentos_criar')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Editar Atendimentos</Label>
                      <Switch
                        checked={editingUser.permissoes?.atendimentos_editar || false}
                        onCheckedChange={() => togglePermission('atendimentos_editar')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Deletar Atendimentos</Label>
                      <Switch
                        checked={editingUser.permissoes?.atendimentos_deletar || false}
                        onCheckedChange={() => togglePermission('atendimentos_deletar')}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSavePermissions}
                  disabled={updateUserMutation.isPending}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500"
                >
                  {updateUserMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                  ) : (
                    'Salvar Permissões'
                  )}
                </Button>
              </div>
            </div>
          )}
          </DialogContent>
          </Dialog>

          {/* Modal de Confirmação de Exclusão */}
          <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar <strong>{userToDelete?.full_name || userToDelete?.email}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deletando...</>
              ) : (
                'Deletar'
              )}
            </AlertDialogAction>
          </div>
          </AlertDialogContent>
          </AlertDialog>
          </div>
          );
          }