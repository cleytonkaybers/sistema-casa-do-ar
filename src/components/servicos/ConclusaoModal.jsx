import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, Loader2, DollarSign } from 'lucide-react';
import { formatTipoServicoCompact } from '@/utils';

export default function ConclusaoModal({ open, onClose, onConfirm, servico, isLoading }) {
  const [observacoes, setObservacoes] = useState('');
  const [pagouDinheiro, setPagouDinheiro] = useState(false);

  // Resetar estado sempre que o modal abrir
  useEffect(() => {
    if (open) {
      setObservacoes('');
      setPagouDinheiro(false);
    }
  }, [open]);

  const handleConfirm = () => {
    // Capturar os valores atuais antes de qualquer reset
    const obs = observacoes;
    const pag = pagouDinheiro;
    onConfirm(obs, pag);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CheckCircle className="w-6 h-6 text-green-600" />
            Concluir Serviço
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>Cliente:</strong> {servico?.cliente_nome}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Serviço:</strong> {formatTipoServicoCompact(servico?.tipo_servico)}
            </p>
          </div>

          <div>
            <Label htmlFor="observacoes" className="text-sm font-semibold text-gray-700">
              Observações da Conclusão (opcional)
            </Label>
            <Textarea
              id="observacoes"
              placeholder="Ex: Serviço realizado com sucesso. Aparelho funcionando normalmente..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={4}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Estas informações serão salvas no serviço e incluídas no compartilhamento.
            </p>
          </div>

          {/* Checkbox sem htmlFor para evitar duplo disparo */}
          <div
            className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3 cursor-pointer select-none"
            onClick={() => setPagouDinheiro(prev => !prev)}
          >
            <Checkbox
              checked={pagouDinheiro}
              className="border-green-500 data-[state=checked]:bg-green-600 pointer-events-none"
            />
            <span className="flex items-center gap-2 text-sm font-semibold text-green-800">
              <DollarSign className="w-4 h-4 text-green-600" />
              Cliente pagou em dinheiro
            </span>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Concluindo...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Concluir Serviço
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}