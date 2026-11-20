import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { listAll } from '@/lib/utils/listAll';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { levantarDadosDoTecnico } from '@/lib/dadosDoTecnico';

// Apaga DE VEZ tudo o que pertence a um técnico desligado: lançamentos de
// comissão, pagamentos recebidos, o cadastro financeiro e o acesso ao app.
//
// Isto é diferente do "🚫 Ocultar", que só esconde e preserva tudo. Aqui o
// dado some do banco e NÃO VOLTA. Como os pagamentos alimentam o Dashboard,
// os Ganhos da Semana e o Histórico de 4 Semanas, os números passados da
// empresa mudam depois desta exclusão: o dinheiro que saiu do caixa para
// este técnico deixa de aparecer nos relatórios.
//
// Por isso a tela: mostra exatamente o que será apagado, oferece baixar uma
// cópia antes, e exige digitar o nome para confirmar.

const norm = (s) => (s || '').trim().toLowerCase();
const formatBRL = (v) => `R$ ${(v || 0).toFixed(2)}`;

export default function ExcluirTecnicoModal({ tecnico, open, onOpenChange, onExcluiu }) {
  const [carregando, setCarregando] = useState(false);
  const [achados, setAchados] = useState(null);
  const [confirmacao, setConfirmacao] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [progresso, setProgresso] = useState('');

  const nome = tecnico?.tecnico_nome || '';

  const levantar = useCallback(async () => {
    if (!tecnico) return;
    setCarregando(true);
    setAchados(null);
    setConfirmacao('');
    try {
      const [lancs, pags, tecFins, usuarios] = await Promise.all([
        listAll('LancamentoFinanceiro'),
        listAll('PagamentoTecnico'),
        listAll('TecnicoFinanceiro'),
        listAll('User').catch(() => []),
      ]);

      setAchados(levantarDadosDoTecnico({
        tecnico, lancamentos: lancs, pagamentos: pags, tecFins, usuarios,
      }));
    } catch (err) {
      console.error('[excluir-tecnico] falha ao levantar:', err);
      toast.error('Não consegui levantar os dados dele. Tente de novo.');
    } finally {
      setCarregando(false);
    }
  }, [tecnico]);

  useEffect(() => {
    if (open && tecnico) levantar();
    if (!open) { setAchados(null); setConfirmacao(''); }
  }, [open, tecnico, levantar]);

  const baixarCopia = () => {
    if (!achados) return;
    const copia = {
      tecnico: nome,
      gerado_em: new Date().toISOString(),
      aviso: 'Cópia de segurança gerada antes da exclusão definitiva no app Casa do Ar.',
      cadastros_financeiros: achados.cadastros,
      usuarios: achados.users,
      lancamentos_de_comissao: achados.lancamentos,
      pagamentos_recebidos: achados.pagamentos,
    };
    const blob = new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${nome.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Cópia baixada. Guarde o arquivo antes de excluir.');
  };

  const excluir = async () => {
    if (!achados) return;
    setExcluindo(true);
    let apagados = 0;
    let falhas = 0;

    // Apaga do mais específico para o mais geral. Se parar no meio, o que
    // sobrou ainda aparece na tela e dá para rodar de novo — por isso a
    // contagem de falhas é mostrada no fim em vez de silenciada.
    const apagar = async (entidade, registros, rotulo) => {
      for (let i = 0; i < registros.length; i++) {
        setProgresso(`${rotulo} ${i + 1}/${registros.length}`);
        try {
          await base44.entities[entidade].delete(registros[i].id);
          apagados++;
        } catch (err) {
          falhas++;
          console.error(`[excluir-tecnico] falhou ao apagar ${entidade}`, registros[i].id, err);
        }
      }
    };

    try {
      await apagar('LancamentoFinanceiro', achados.lancamentos, 'Comissões');
      await apagar('PagamentoTecnico', achados.pagamentos, 'Pagamentos');
      await apagar('TecnicoFinanceiro', achados.cadastros, 'Cadastro financeiro');
      // O User por último: enquanto ele existe, o provisionamento recria o
      // cadastro financeiro. Apagar nesta ordem evita que o técnico "volte".
      await apagar('User', achados.users, 'Acesso');

      if (falhas === 0) {
        toast.success(`${nome} removido. ${apagados} registro(s) apagados.`);
      } else {
        toast.error(`${apagados} apagado(s), ${falhas} falhou(ram). Abra de novo para terminar.`);
      }
      onExcluiu?.();
      if (falhas === 0) onOpenChange(false);
      else await levantar();
    } finally {
      setExcluindo(false);
      setProgresso('');
    }
  };

  const total = achados
    ? achados.lancamentos.length + achados.pagamentos.length + achados.cadastros.length + achados.users.length
    : 0;
  const podeExcluir = !!achados && total > 0 && norm(confirmacao) === norm(nome) && !excluindo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Excluir tudo de {nome}
          </DialogTitle>
        </DialogHeader>

        {carregando && (
          <div className="py-8 flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Levantando os dados dele...
          </div>
        )}

        {achados && !carregando && (
          <>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Isto apaga de vez e não tem como desfazer.</p>
              <p className="mt-1 text-xs">
                Os pagamentos feitos a ele alimentam o Dashboard, os Ganhos da Semana e o
                Histórico de 4 Semanas. Depois de apagar, esse dinheiro <strong>some dos
                relatórios</strong> — os números passados da empresa mudam.
              </p>
            </div>

            <div className="space-y-1 text-sm">
              <Linha rotulo="Lançamentos de comissão" n={achados.lancamentos.length}
                     extra={formatBRL(achados.totalComissoes)} />
              <Linha rotulo="Pagamentos recebidos" n={achados.pagamentos.length}
                     extra={formatBRL(achados.totalPago)} />
              <Linha rotulo="Cadastro financeiro" n={achados.cadastros.length} />
              <Linha rotulo="Acesso ao app (usuário)" n={achados.users.length} />
            </div>

            {total === 0 ? (
              <p className="text-sm text-gray-500 py-2">
                Não encontrei nenhum dado dele. Nada a apagar.
              </p>
            ) : (
              <>
                <Button variant="outline" onClick={baixarCopia} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar uma cópia antes (recomendado)
                </Button>

                <div className="space-y-2">
                  <Label className="text-sm">
                    Para confirmar, digite <strong>{nome}</strong>:
                  </Label>
                  <Input
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    placeholder={nome}
                    autoComplete="off"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={excluindo}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={excluir} disabled={!podeExcluir}>
                    {excluindo ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progresso || 'Apagando...'}</>
                    ) : (
                      `Apagar os ${total} registro(s)`
                    )}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Linha({ rotulo, n, extra }) {
  return (
    <div className="flex justify-between border-b py-1">
      <span className="text-gray-600">{rotulo}</span>
      <span className="font-semibold">
        {n}{extra ? <span className="text-gray-500 font-normal"> · {extra}</span> : null}
      </span>
    </div>
  );
}
