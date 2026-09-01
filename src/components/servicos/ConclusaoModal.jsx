import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Loader2, DollarSign, AlertTriangle } from 'lucide-react';
import { formatTipoServicoCompact } from '@/utils';
import { MARCAS_AR, isInstalacao, extrairMarca, removerMarca, embutirMarca } from '@/lib/marcasAr';

// Quebra o tipo_servico em partes e identifica as INSTALAÇÕES sem marca.
// A marca é opcional no cadastro, mas OBRIGATÓRIA para concluir: sem ela o
// relatório "Instalações por Marca" fica com buracos ("Não informada").
function analisarPartes(tipoServico) {
  const partes = (tipoServico || '').split(' + ');
  return partes.map((parte, idx) => {
    const m = parte.match(/^(.+?)\s*\[(.+)\]$/);
    const tipoBase = m ? m[1].trim() : parte.trim();
    const equipamento = m ? m[2].trim() : '';
    return {
      idx,
      parte,
      tipoBase,
      equipamento,
      marca: extrairMarca(equipamento),
      ehInstalacao: isInstalacao(tipoBase),
    };
  });
}

export default function ConclusaoModal({ open, onClose, onConfirm, servico, isLoading }) {
  const [observacoes, setObservacoes] = useState('');
  const [pagouDinheiro, setPagouDinheiro] = useState(false);
  // Marcas informadas agora, por índice da parte: { 0: 'Gree' }
  const [marcas, setMarcas] = useState({});
  const [tentouConcluir, setTentouConcluir] = useState(false);

  const partes = useMemo(() => analisarPartes(servico?.tipo_servico), [servico]);
  const instalacoesSemMarca = useMemo(
    () => partes.filter(p => p.ehInstalacao && !p.marca),
    [partes]
  );

  // Resetar estado sempre que o modal abrir
  useEffect(() => {
    if (open) {
      setObservacoes('');
      setPagouDinheiro(false);
      setMarcas({});
      setTentouConcluir(false);
    }
  }, [open]);

  const marcaDe = (idx) => (marcas[idx] || '').trim();
  const faltaAlguma = instalacoesSemMarca.some(p => !marcaDe(p.idx));

  // Reescreve o tipo_servico embutindo as marcas informadas agora, preservando
  // o local/equipamento que já existia em cada parte.
  const montarTipoServicoAtualizado = () => {
    if (instalacoesSemMarca.length === 0) return null;
    const novas = partes.map(p => {
      const escolhida = marcaDe(p.idx);
      if (!p.ehInstalacao || p.marca || !escolhida) return p.parte;
      const local = removerMarca(p.equipamento);
      const equipFinal = embutirMarca(escolhida, local);
      return equipFinal ? `${p.tipoBase} [${equipFinal}]` : p.tipoBase;
    });
    return novas.join(' + ');
  };

  const handleConfirm = () => {
    setTentouConcluir(true);
    if (faltaAlguma) return; // bloqueia: instalação exige marca para concluir
    // Capturar os valores atuais antes de qualquer reset
    const obs = observacoes;
    const pag = pagouDinheiro;
    onConfirm(obs, pag, montarTipoServicoAtualizado());
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

          {/* Instalação SEM marca: obrigatório informar para concluir */}
          {instalacoesSemMarca.length > 0 && (
            <div className="rounded-lg border-2 border-red-400 bg-red-50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-700">
                    Informe a marca do ar-condicionado para concluir
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {instalacoesSemMarca.length === 1
                      ? 'Esta instalação está sem marca cadastrada.'
                      : `${instalacoesSemMarca.length} instalações estão sem marca cadastrada.`}
                  </p>
                </div>
              </div>

              {instalacoesSemMarca.map(p => {
                const local = removerMarca(p.equipamento);
                const vazio = tentouConcluir && !marcaDe(p.idx);
                return (
                  <div key={p.idx} className="space-y-1">
                    <Label className="text-xs font-semibold text-red-800">
                      {p.tipoBase}{local ? ` — ${local}` : ''} *
                    </Label>
                    <Select
                      value={marcas[p.idx] || ''}
                      onValueChange={(v) => setMarcas(prev => ({ ...prev, [p.idx]: v }))}
                    >
                      <SelectTrigger className={`bg-white ${vazio ? 'border-red-500 ring-1 ring-red-400' : 'border-red-300'}`}>
                        <SelectValue placeholder="Selecione a marca..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MARCAS_AR.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="text"
                      placeholder="Ou digite outra marca"
                      value={marcas[p.idx] || ''}
                      onChange={(e) => setMarcas(prev => ({ ...prev, [p.idx]: e.target.value }))}
                      className={`text-sm bg-white ${vazio ? 'border-red-500' : 'border-red-200'}`}
                    />
                    {vazio && (
                      <p className="text-[11px] font-semibold text-red-600">Obrigatório para concluir.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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
            disabled={isLoading || faltaAlguma}
            title={faltaAlguma ? 'Informe a marca do ar-condicionado para concluir' : undefined}
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
