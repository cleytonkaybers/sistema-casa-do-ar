import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, Facebook, Instagram, Twitter, Link2, Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CompartilharModal({ open, onClose, servico }) {
  const [copied, setCopied] = useState(false);

  if (!servico) return null;

  const mensagem = `✅ Serviço Concluído!\n\n👤 Cliente: ${servico.cliente_nome}\n🔧 Serviço: ${servico.tipo_servico}\n📅 Data: ${new Date(servico.data_programada).toLocaleDateString('pt-BR')}\n${servico.valor ? `💰 Valor: R$ ${servico.valor.toFixed(2)}` : ''}\n\n🏢 Casa do Ar Climatização`;

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

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopied(true);
      toast.success('Texto copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
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
            <Share2 className="w-6 h-6 text-green-600" />
            Serviço Concluído! 🎉
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 whitespace-pre-line">{mensagem}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Compartilhar em:</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleWhatsApp}
                className="bg-green-500 hover:bg-green-600 text-white h-12"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                WhatsApp
              </Button>

              <Button
                onClick={handleFacebook}
                className="bg-blue-600 hover:bg-blue-700 text-white h-12"
              >
                <Facebook className="w-5 h-5 mr-2" />
                Facebook
              </Button>

              <Button
                onClick={handleTwitter}
                className="bg-sky-500 hover:bg-sky-600 text-white h-12"
              >
                <Twitter className="w-5 h-5 mr-2" />
                Twitter
              </Button>

              <Button
                onClick={handleInstagram}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white h-12"
              >
                <Instagram className="w-5 h-5 mr-2" />
                Instagram
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleCopiar}
              variant="outline"
              className="w-full h-12 border-2"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 mr-2 text-green-600" />
                  Copiado!
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