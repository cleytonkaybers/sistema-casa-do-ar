import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatTipoServicoCompact } from '@/utils';

export default function ReagendarModal({ open, onClose, onSave, servico, isLoading }) {
  const [novaData, setNovaData] = useState('');
  const [horario, setHorario] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!novaData || !horario) return;
    
    // Validar que a data não seja anterior à data atual (usando strings para evitar problema de fuso horário)
    const hoje = new Date().toISOString().split('T')[0];
    if (novaData < hoje) {
      return;
    }
    
    onSave(novaData, horario);
    setNovaData('');
    setHorario('');
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
              <span className="font-semibold">Serviço:</span> {formatTipoServicoCompact(servico?.tipo_servico)}
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

            <div className="space-y-2">
              <Label htmlFor="horario" className="text-base font-medium">
                Horário *
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="horario"
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  required
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                type="submit" 
                disabled={isLoading || !novaData || !horario}
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