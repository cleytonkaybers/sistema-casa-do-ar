import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, Facebook, Instagram, Twitter, Link2, Check, Share2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { formatTipoServicoCompact } from '@/utils';

export default function CompartilharModal({ open, onClose, servico, isConclusao = false }) {
  const [copied, setCopied] = useState(false);

  if (!servico) return null;

  const getStatusEmoji = (status) => {
    switch(status) {
      case 'concluido': return '✅';
      case 'andamento': return '🔄';
      case 'pausado': return '⏸️';
      default: return '📋';
    }
  };

  const getStatusTexto = (status) => {
    switch(status) {
      case 'concluido': return 'Concluído';
      case 'andamento': return 'Em Andamento';
      case 'pausado': return 'Pausado';
      default: return 'Aberto';
    }
  };

  const statusEmoji = getStatusEmoji(servico.status);
  const statusTexto = getStatusTexto(servico.status);

  const titulo = isConclusao ? '✅ Serviço Concluído!' : `${statusEmoji} Serviço - ${statusTexto}`;

  const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
    if (cleaned.length === 10) return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
    return phone;
  };

  const mensagem = isConclusao
    ? [
        `✅ *Serviço Concluído!*`,
        servico.os_numero ? `🔢 *OS:* ${servico.os_numero}` : null,
        servico.equipe_nome ? `👷 *Equipe:* ${servico.equipe_nome}` : null,
        ``,
        `👤 *Cliente:* ${servico.cliente_nome}`,
        servico.telefone ? `📞 *Telefone:* ${formatPhone(servico.telefone)}` : null,
        `🔧 *Tipo de Serviço:* ${formatTipoServicoCompact(servico.tipo_servico)}`,
        servico.data_programada ? `📅 *Data:* ${new Date(servico.data_programada).toLocaleDateString('pt-BR')}` : null,
        servico.horario ? `🕐 *Horário:* ${servico.horario}` : null,
        servico.endereco ? `📍 *Endereço:* ${servico.endereco}` : null,
        servico.valor ? `💰 *Valor:* R$ ${servico.valor.toFixed(2)}` : null,
        servico.descricao ? `📝 *Descrição:* ${servico.descricao}` : null,
        servico.observacoes_conclusao ? `📋 *Observações:* ${servico.observacoes_conclusao}` : null,
      ].filter(l => l !== null).join('\n')
    : [
        `${statusEmoji} *${statusTexto}*`,
        servico.os_numero ? `🔢 *OS:* ${servico.os_numero}` : null,
        ``,
        `👤 *Cliente:* ${servico.cliente_nome}`,
        servico.telefone ? `📞 *Telefone:* ${formatPhone(servico.telefone)}` : null,
        `🔧 *Tipo de Serviço:* ${formatTipoServicoCompact(servico.tipo_servico)}`,
        servico.data_programada ? `📅 *Data:* ${new Date(servico.data_programada).toLocaleDateString('pt-BR')}` : null,
        servico.horario ? `🕐 *Horário:* ${servico.horario}` : null,
        servico.endereco ? `📍 *Endereço:* ${servico.endereco}` : null,
        servico.valor ? `💰 *Valor:* R$ ${servico.valor.toFixed(2)}` : null,
        servico.descricao ? `📝 *Descrição:* ${servico.descricao}` : null,
        servico.observacoes_conclusao ? `📋 *Observações:* ${servico.observacoes_conclusao}` : null,
        servico.equipe_nome ? `👷 *Equipe:* ${servico.equipe_nome}` : null,
      ].filter(l => l !== null).join('\n');

  const linkCompartilhamento = encodeURIComponent(mensagem);

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${linkCompartilhamento}`, '_blank');
  };

  const handleFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?quote=${linkCompartilhamento}`, '_blank');
  };

  const handleTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${linkCompartilhamento}`, '_blank');
  };

  const handleInstagram = () => {
    toast.info('Copie a mensagem e cole no Instagram Stories!');
    handleCopiar();
  };

  const handleTelegram = () => {
    window.open(`https://t.me/share/url?text=${linkCompartilhamento}`, '_blank');
  };

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopied(true);
      toast.success('Texto copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleCompartilharNativo = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Serviço Concluído',
          text: mensagem
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          handleCopiar();
        }
      }
    } else {
      handleCopiar();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Share2 className="w-6 h-6 text-blue-600" />
            {isConclusao ? 'Serviço Concluído! 🎉' : 'Compartilhar Serviço'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 whitespace-pre-line">{mensagem}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-800 mb-3">Compartilhar em:</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleWhatsApp}
                className="bg-green-500 hover:bg-green-600 text-white h-14 shadow-lg hover:shadow-xl transition-all"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                WhatsApp
              </Button>

              <Button
                onClick={handleTelegram}
                className="bg-sky-400 hover:bg-sky-500 text-white h-14 shadow-lg hover:shadow-xl transition-all"
              >
                <Send className="w-5 h-5 mr-2" />
                Telegram
              </Button>

              <Button
                onClick={handleFacebook}
                className="bg-blue-600 hover:bg-blue-700 text-white h-14 shadow-lg hover:shadow-xl transition-all"
              >
                <Facebook className="w-5 h-5 mr-2" />
                Facebook
              </Button>

              <Button
                onClick={handleTwitter}
                className="bg-black hover:bg-gray-800 text-white h-14 shadow-lg hover:shadow-xl transition-all"
              >
                <Twitter className="w-5 h-5 mr-2" />
                X (Twitter)
              </Button>

              <Button
                onClick={handleInstagram}
                className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:from-purple-600 hover:via-pink-600 hover:to-orange-500 text-white h-14 shadow-lg hover:shadow-xl transition-all col-span-2"
              >
                <Instagram className="w-5 h-5 mr-2" />
                Instagram (copiar texto)
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-semibold text-gray-700 mb-2">Outras opções:</p>
            <Button
              onClick={handleCopiar}
              variant="outline"
              className="w-full h-12 border-2 hover:bg-gray-50 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 mr-2 text-green-600" />
                  <span className="text-green-600 font-semibold">Texto Copiado!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-5 h-5 mr-2" />
                  Copiar Texto
                </>
              )}
            </Button>

            {navigator.share && (
              <Button
                onClick={handleCompartilharNativo}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 h-12"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Mais Opções
              </Button>
            )}
          </div>

          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}