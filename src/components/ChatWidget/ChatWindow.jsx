import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import MessageBubble from './MessageBubble';

export default function ChatWindow({ isOpen }) {
  const [message, setMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [conversation, setConversation] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me()
      .then(user => setCurrentUser(user))
      .catch(() => setCurrentUser(null));
  }, []);

  // Buscar ou criar conversa
  useEffect(() => {
    if (!currentUser || !isOpen) return;
    let cancelled = false;

    const loadConversation = async () => {
      const conversations = await base44.entities.ChatConversation.filter({
        user_email: currentUser.email
      });
      if (cancelled) return;

      if (conversations.length > 0) {
        setConversation(conversations[0]);
      } else {
        const newConv = await base44.entities.ChatConversation.create({
          user_email: currentUser.email,
          user_name: currentUser.full_name || currentUser.email,
          status: 'open'
        });
        if (!cancelled) setConversation(newConv);
      }
    };

    loadConversation();
    return () => { cancelled = true; };
  }, [currentUser, isOpen]);

  // Buscar mensagens
  const { data: messages = [] } = useQuery({
    queryKey: ['chat_messages', conversation?.id],
    queryFn: () => conversation ? base44.entities.ChatMessage.filter({ conversation_id: conversation.id }) : [],
    enabled: !!conversation,
    refetchInterval: 8000
  });

  // Enviar mensagem
  const sendMutation = useMutation({
    mutationFn: async (content) => {
      if (!conversation || !currentUser) return;

      const userMessage = await base44.entities.ChatMessage.create({
        conversation_id: conversation.id,
        sender_type: 'user',
        sender_email: currentUser.email,
        sender_name: currentUser.full_name || currentUser.email,
        content
      });

      // Chamar IA para resposta
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um agente de suporte amigável para uma empresa de climatização. Responda brevemente em português.\n\nPergunta do cliente: ${content}`,
        add_context_from_internet: false
      });

      await base44.entities.ChatMessage.create({
        conversation_id: conversation.id,
        sender_type: 'ai',
        sender_email: 'support-ai@casa-do-ar.com',
        sender_name: 'Casa do Ar - Suporte',
        content: response
      });

      queryClient.invalidateQueries({ queryKey: ['chat_messages', conversation.id] });
    },
    onError: () => toast.error('Erro ao enviar mensagem')
  });

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message);
    setMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-6 w-96 h-[500px] z-40 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl shadow-purple-500/40 border border-purple-700/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 p-4 text-white">
        <h3 className="font-semibold">Casa do Ar - Suporte</h3>
        <p className="text-xs text-cyan-100">Resposta IA em tempo real</p>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-8">
            <p>Olá! 👋 Como podemos ajudar?</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} currentUserEmail={currentUser?.email} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-purple-700/30 p-3 flex gap-2">
        <Input
          type="text"
          placeholder="Sua mensagem..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          className="bg-slate-700 border-purple-700/50 text-white placeholder:text-gray-400"
        />
        <Button
          onClick={handleSend}
          disabled={sendMutation.isPending || !message.trim()}
          size="icon"
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
        >
          {sendMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}