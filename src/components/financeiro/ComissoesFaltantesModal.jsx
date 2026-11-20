import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { listAll } from '@/lib/utils/listAll';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { detectarComissoesFaltantes } from '@/lib/comissoesFaltantes';

// Tela do botão "🔍 Comissões faltantes". A regra de o que conta como
// faltante mora em @/lib/comissoesFaltantes (pura, com teste próprio);
// aqui fica só o carregamento, a conferência e a gravação.

const DIAS_JANELA = 90;

const formatBRL = (v) => `R$ ${(v || 0).toFixed(2)}`;

export default function ComissoesFaltantesModal({ open, onOpenChange, onGerou }) {
  const [itens, setItens] = useState(null); // null = ainda não varreu
  const [varrendo, setVarrendo] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState('');

  const varrer = async () => {
    setVarrendo(true);
    setItens(null);
    try {
      const [servicos, lancs, tecFins, usuarios, tipos] = await Promise.all([
        listAll('Servico'),
        listAll('LancamentoFinanceiro'),
        listAll('TecnicoFinanceiro'),
        listAll('User').catch(() => []),
        listAll('TipoServicoValor').catch(() => []),
      ]);

      const achados = detectarComissoesFaltantes({
        servicos, lancamentos: lancs, tecFins, usuarios, tipos,
        diasJanela: DIAS_JANELA,
      });
      setItens(achados);
      if (achados.length === 0) {
        toast.success('Nenhuma comissão faltando — está tudo lançado.');
      }
    } catch (err) {
      console.error('[comissoes-faltantes] falha ao varrer:', err);
      toast.error('Não consegui verificar agora. Tente de novo em instantes.');
    } finally {
      setVarrendo(false);
    }
  };

  const gerar = async () => {
    if (!itens || itens.length === 0) return;
    setGerando(true);
    let criados = 0;
    let falhas = 0;
    try {
      const user = await base44.auth.me().catch(() => null);

      for (let i = 0; i < itens.length; i++) {
        const { servico, comissao, destinos } = itens[i];
        setProgresso(`${i + 1} de ${itens.length} — ${servico.cliente_nome || 'sem cliente'}`);
        try {
          // Relê AGORA: entre a varredura e o clique, a comissão pode ter sido
          // gerada (outra aba, workflow do Base44). Sem esta conferência o
          // técnico receberia duas vezes pelo mesmo serviço.
          const jaExistem = await base44.entities.LancamentoFinanceiro
            .filter({ servico_id: servico.id })
            .catch(() => null);
          if (jaExistem === null) throw new Error('não consegui conferir os lançamentos');
          if (jaExistem.length > 0) continue;

          const agora = new Date().toISOString();
          for (const d of destinos) {
            await base44.entities.LancamentoFinanceiro.create({
              servico_id: servico.id,
              equipe_id: servico.equipe_id,
              equipe_nome: servico.equipe_nome || '',
              tecnico_id: d.tec.tecnico_id,
              tecnico_nome: d.tec.tecnico_nome,
              cliente_nome: servico.cliente_nome,
              tipo_servico: servico.tipo_servico,
              valor_total_servico: servico.valor,
              percentual_equipe: comissao.percentual_equipe,
              valor_comissao_equipe: comissao.valor_comissao_equipe,
              percentual_tecnico: d.perc,
              valor_comissao_tecnico: d.valor,
              status: 'pendente',
              data_geracao: agora,
              usuario_geracao: user?.email || '',
              observacoes: 'Comissão recuperada — o serviço estava concluído sem lançamento.',
            });

            // Relê o saldo do técnico a cada lançamento: o mesmo técnico pode
            // aparecer em vários serviços desta mesma leva, e somar em cima de
            // uma cópia velha perderia os anteriores.
            const regs = await base44.entities.TecnicoFinanceiro
              .filter({ tecnico_id: d.tec.tecnico_id })
              .catch(() => []);
            if (regs && regs.length > 0) {
              const tr = regs[0];
              await base44.entities.TecnicoFinanceiro.update(tr.id, {
                credito_pendente: (tr.credito_pendente || 0) + d.valor,
                total_ganho: (tr.total_ganho || 0) + d.valor,
                data_ultima_atualizacao: agora,
              });
            }
            criados++;
          }

          await base44.entities.Servico.update(servico.id, { comissao_gerada: true });
        } catch (err) {
          falhas++;
          console.error('[comissoes-faltantes] falhou no serviço', servico.id, err);
        }
      }

      if (criados > 0) {
        toast.success(`${criados} comissão(ões) lançada(s).`);
        onGerou?.();
      }
      if (falhas > 0) {
        toast.error(`${falhas} serviço(s) não deram certo. Clique em Verificar de novo.`);
      }
      await varrer();
    } finally {
      setGerando(false);
      setProgresso('');
    }
  };

  const totalAPagar = (itens || []).reduce(
    (soma, it) => soma + it.destinos.reduce((s, d) => s + d.valor, 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Comissões faltantes
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-600">
          Procura serviços <strong>já concluídos e cobrados do cliente</strong> que ficaram
          sem comissão nenhuma para o técnico. Olha os últimos {DIAS_JANELA} dias.
        </p>

        {itens === null && !varrendo && (
          <div className="py-6 text-center">
            <Button onClick={varrer}>🔍 Verificar agora</Button>
          </div>
        )}

        {varrendo && (
          <div className="py-8 flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Conferindo os serviços...
          </div>
        )}

        {itens !== null && itens.length === 0 && !varrendo && (
          <div className="py-8 flex flex-col items-center gap-2 text-green-600">
            <CheckCircle2 className="w-10 h-10" />
            <p className="font-semibold">Nenhuma comissão faltando.</p>
            <p className="text-sm text-gray-500">Todo serviço concluído tem o lançamento dele.</p>
          </div>
        )}

        {itens !== null && itens.length > 0 && (
          <>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong>{itens.length} serviço(s)</strong> concluído(s) sem comissão, somando{' '}
              <strong>{formatBRL(totalAPagar)}</strong> a lançar.
              <p className="mt-2 text-xs">
                ⚠️ Quem recebe é quem está <strong>hoje</strong> na equipe. Se a equipe mudou de
                integrante depois do serviço, confira a lista abaixo antes de confirmar — pode
                ser que o crédito vá para a pessoa errada.
              </p>
            </div>

            <div className="space-y-2">
              {itens.map(({ servico, destinos, quando }) => (
                <div key={servico.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex justify-between gap-2 flex-wrap">
                    <div>
                      <span className="font-semibold">{servico.cliente_nome || 'Sem cliente'}</span>
                      <span className="text-gray-500"> · {servico.tipo_servico || 'Serviço'}</span>
                    </div>
                    <div className="text-gray-500 text-xs">
                      {quando ? format(quando, 'dd/MM/yyyy HH:mm') : 'sem data'} ·{' '}
                      {servico.equipe_nome || servico.equipe_id}
                    </div>
                  </div>
                  <div className="mt-1 text-gray-600">
                    Valor do serviço: <strong>{formatBRL(servico.valor)}</strong>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {destinos.map((d) => (
                      <Badge key={d.tec.id || d.tec.tecnico_id} className="bg-blue-100 text-blue-700">
                        {d.tec.tecnico_nome}: {d.perc}% = {formatBRL(d.valor)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={varrer} disabled={gerando || varrendo}>
                Verificar de novo
              </Button>
              <Button onClick={gerar} disabled={gerando}>
                {gerando ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progresso || 'Lançando...'}</>
                ) : (
                  `Lançar as ${itens.length} comissão(ões)`
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
