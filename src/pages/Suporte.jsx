import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MessageSquare, User, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { usePermissions } from '../components/auth/PermissionGuard';

const statusColors = {
  open: 'bg-blue-100 text-blue-800',
  waiting_agent: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-purple-100 text-purple-800',
  closed: 'bg-green-100 text-green-800'
};

export default function SuportePage() {
  const { isAdmin } = usePermissions();
  const [selectedChat, setSelectedChat] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  // Buscar conversas
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => base44.entities.ChatConversation.list('-last_message_at'),
    refetchInterval: 3000
  });

  // Buscar mensagens da conversa selecionada
  const { data: messages = [] } = useQuery({
    queryKey: ['chat_messages', selectedChat?.id],
    queryFn: () => selectedChat ? base44.entities.ChatMessage.filter({ conversation_id: selectedChat.id }) : [],
    enabled: !!selectedChat,
    refetchInterval: 2000
  });

  // Enviar resposta de agente
  const sendReplyMutation = useMutation({
    mutationFn: async (content) => {
      if (!selectedChat || !currentUser) return;

      await base44.entities.ChatMessage.create({
        conversation_id: selectedChat.id,
        sender_type: 'agent',
        sender_email: currentUser.email,
        sender_name: currentUser.full_name || currentUser.email,
        content
      });

      await base44.entities.ChatConversation.update(selectedChat.id, {
        status: 'assigned',
        assigned_agent: currentUser.email,
        last_message_at: new Date().toISOString()
      });

      queryClient.invalidateQueries({ queryKey: ['chat_messages', selectedChat.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onSuccess: () => {
      setReplyMessage('');
      toast.success('Mensagem enviada');
    },
    onError: () => toast.error('Erro ao enviar mensagem')
  });

  // Marcar como resolvido
  const resolveChat = useMutation({
    mutationFn: (chatId) =>
      base44.entities.ChatConversation.update(chatId, {
        status: 'closed',
        resolved: true,
        last_message_at: new Date().toISOString()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setSelectedChat(null);
      toast.success('Conversa fechada');
    }
  });

  const filteredChats = conversations.filter(chat =>
    chat.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusLabels = {
    open: 'Aberto',
    waiting_agent: 'Aguardando Agente',
    assigned: 'Atribuído',
    closed: 'Fechado'
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
          Centro de Suporte
        </h1>
        <p className="text-gray-400 mt-1">Gerencie conversas com clientes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Conversas */}
        <div className="lg:col-span-1 space-y-4">
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-700 border-purple-700/50 text-white placeholder:text-gray-400"
          />

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            ) : filteredChats.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Nenhuma conversa</p>
            ) : (
              filteredChats.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedChat?.id === chat.id
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 border border-blue-400'
                      : 'bg-slate-800 hover:bg-slate-700 border border-purple-700/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-medium text-white">{chat.user_name}</p>
                    <Badge className={statusColors[chat.status]}>
                      {statusLabels[chat.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-300">{chat.user_email}</p>
                  {chat.last_message_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(chat.last_message_at), 'HH:mm', { locale: ptBR })}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detalhes da Conversa */}
        <div className="lg:col-span-2">
          {selectedChat ? (
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30 h-[600px] flex flex-col">
              <CardHeader className="border-b border-purple-700/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <User className="w-5 h-5 text-cyan-400" />
                      {selectedChat.user_name}
                    </CardTitle>
                    <p className="text-sm text-gray-400 mt-1">{selectedChat.user_email}</p>
                  </div>
                  <Badge className={statusColors[selectedChat.status]}>
                    {statusLabels[selectedChat.status]}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xs rounded-lg px-4 py-2 ${
                        msg.sender_type === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : msg.sender_type === 'ai'
                          ? 'bg-purple-700/40 border border-purple-600/50 text-gray-100'
                          : 'bg-green-700/40 border border-green-600/50 text-gray-100'
                      }`}
                    >
                      {msg.sender_type !== 'user' && (
                        <p className="text-xs font-semibold mb-1 text-purple-300">
                          {msg.sender_type === 'ai' ? 'Suporte IA' : 'Agente'}
                        </p>
                      )}
                      <p className="text-sm break-words">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </CardContent>

              <div className="border-t border-purple-700/30 p-3 space-y-2">
                {selectedChat.status !== 'closed' && (
                  <>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Sua resposta..."
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === 'Enter' &&
                          replyMessage.trim() &&
                          sendReplyMutation.mutate(replyMessage)
                        }
                        className="bg-slate-700 border-purple-700/50 text-white"
                      />
                      <Button
                        onClick={() => sendReplyMutation.mutate(replyMessage)}
                        disabled={sendReplyMutation.isPending || !replyMessage.trim()}
                        className="bg-gradient-to-r from-cyan-500 to-blue-500"
                      >
                        {sendReplyMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Enviar'
                        )}
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resolveChat.mutate(selectedChat.id)}
                      disabled={resolveChat.isPending}
                      className="w-full"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Marcar como Resolvido
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ) : (
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30 h-[600px] flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400">Selecione uma conversa para começar</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}