import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ReagendarModal({ open, onClose, onSave, servico, isLoading }) {
  const [novaData, setNovaData] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!novaData) return;
    
    // Validar que a data não seja anterior à data atual
    const dataAtual = new Date();
    dataAtual.setHours(0, 0, 0, 0);
    const novaDataObj = new Date(novaData);
    novaDataObj.setHours(0, 0, 0, 0);
    
    if (novaDataObj < dataAtual) {
      return; // O input já previne datas anteriores, mas adiciona validação extra
    }
    
    onSave(novaData);
    setNovaData('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-yellow-600">
            ⏸️ Serviço Pausado - Reagendar Obrigatório
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Cliente:</span> {servico?.cliente_nome}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Serviço:</span> {servico?.tipo_servico}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova-data" className="text-base font-medium">
                Nova Data de Conclusão *
              </Label>
              <Input
                id="nova-data"
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                required
                className="h-11"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                type="submit" 
                disabled={isLoading || !novaData}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    Reagendar Serviço
                  </>
                )}
              </Button>
            </div>
          </form>

          <p className="text-xs text-gray-500 text-center">
            Este serviço ficará pausado até a nova data programada
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}