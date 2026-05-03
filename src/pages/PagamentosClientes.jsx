import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import TipoServicoDisplay from '@/components/TipoServicoDisplay';
import { formatTipoServicoCompact } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { exportarExcel } from '@/lib/excelUtils';
import TechnicianAccessBlock from '@/components/TechnicianAccessBlock';
import jsPDF from 'jspdf';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import RelatorioClientesPagamentoModal from '@/components/financeiro/RelatorioClientesPagamentoModal';
import BotaoGerarRelatorioCobranca from '@/components/financeiro/BotaoGerarRelatorioCobranca';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, isAfter, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseHistoricoData, toLocalDateSafe } from '@/lib/dateUtils';
import { isApenasTiposIgnorados } from '@/lib/utils/tipoServico';
import { matchClienteSearch } from '@/lib/utils/buscaCliente';
import CompromissoClientePDF from '@/components/financeiro/CompromissoClientePDF';
import {
  Search, CheckCircle2, AlertCircle, Calendar,
  MessageCircle, Filter, X, Tag,
  Clock, History, Trash2, Eye, Check, FileDown, AlertTriangle, RotateCcw, Archive, ArchiveRestore
} from 'lucide-react';

const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatPhone = (p) => {
  if (!p) return '';
  const c = p.replace(/\D/g, '');
  if (c.length === 11) return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`;
  return p;
};
const getWhatsApp = (phone) => {
  if (!phone) return '#';
  const n = phone.replace(/\D/g, '');
  return `https://wa.me/55${n}`;
};
const calcularSaldo = (total, pago) => (total || 0) - (pago || 0);

async function gerarPDFCobranca(pag) {
  const { addBannerToDoc, getBannerUrl } = await import('@/lib/pdfBanner');
  const bannerUrl = await getBannerUrl();

  const records = pag._records || [pag];

  // Agrupa por tipo de serviço contando quantidade e somando valores
  const servicosMap = {};
  records.forEach(r => {
    const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
    const valorPorTipo = tipos.length > 0 ? (r.valor_total || 0) / tipos.length : 0;
    tipos.forEach(tipo => {
      if (!servicosMap[tipo]) servicosMap[tipo] = { tipo, qtd: 0, valorUnit: valorPorTipo, totalValor: 0 };
      servicosMap[tipo].qtd += 1;
      servicosMap[tipo].totalValor += valorPorTipo;
    });
  });
  const servicos = Object.values(servicosMap);
  const totalGeral = servicos.reduce((s, sv) => s + sv.totalValor, 0);
  const totalPago = records.reduce((s, r) => s + (r.valor_pago || 0), 0);
  const saldo = totalGeral - totalPago;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Banner ou cabeçalho colorido
  let y = await addBannerToDoc(doc, bannerUrl);
  if (!bannerUrl) {
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setFontSize(18); doc.setTextColor(255, 255, 255); doc.setFont(undefined, 'bold');
    doc.text('Casa do Ar Climatização', 15, 16);
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    doc.text('Comprovante de Serviços Realizados', 15, 26);
    doc.setTextColor(180, 200, 255); doc.setFontSize(9);
    doc.text(`Emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, pageWidth - 15, 26, { align: 'right' });
    y = 44;
  } else {
    // Subtítulo após banner
    doc.setFontSize(13); doc.setTextColor(30, 58, 138); doc.setFont(undefined, 'bold');
    doc.text('Comprovante de Serviços Realizados', 15, y);
    doc.setFontSize(9); doc.setTextColor(100, 100, 100); doc.setFont(undefined, 'normal');
    doc.text(`Emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, pageWidth - 15, y, { align: 'right' });
    y += 10;
  }

  // Cliente
  doc.setTextColor(0, 0, 0); doc.setFontSize(13); doc.setFont(undefined, 'bold');
  doc.text(`Cliente: ${pag.cliente_nome}`, 15, y);
  y += 8;
  if (pag.telefone) {
    doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(100, 100, 100);
    doc.text(`Telefone: ${pag.telefone}`, 15, y);
    y += 8;
  }
  y += 4;

  // Tabela de serviços
  const col = { qtd: 15, servico: 35, unit: 130, total: 165 };
  const rowH = 10;

  // Cabeçalho tabela
  doc.setFillColor(240, 244, 248);
  doc.rect(15, y - 6, pageWidth - 30, rowH, 'F');
  doc.setFontSize(9); doc.setFont(undefined, 'bold'); doc.setTextColor(30, 58, 138);
  doc.text('Qtd', col.qtd, y);
  doc.text('Descrição do Serviço', col.servico, y);
  doc.text('Valor Unit.', col.unit, y);
  doc.text('Total', col.total, y);
  y += rowH;

  // Linhas
  doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
  servicos.forEach((sv, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(250, 252, 255);
      doc.rect(15, y - 6, pageWidth - 30, rowH, 'F');
    }
    doc.setFontSize(9);
    doc.text(`${sv.qtd}x`, col.qtd, y);
    const linhasServico = doc.splitTextToSize(sv.tipo, 88);
    doc.text(linhasServico, col.servico, y);
    doc.text(`R$ ${sv.valorUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, col.unit, y);
    doc.text(`R$ ${sv.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, col.total, y);
    y += rowH * (linhasServico.length > 1 ? linhasServico.length : 1);
  });

  // Linha divisora
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, pageWidth - 15, y);
  y += 8;

  // Totais
  doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(0, 0, 0);
  doc.text('Total dos Serviços:', col.unit - 30, y);
  doc.text(`R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, col.total, y);
  y += 8;

  if (totalPago > 0) {
    doc.setTextColor(22, 163, 74);
    doc.text('Valor Pago:', col.unit - 30, y);
    doc.text(`R$ ${totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, col.total, y);
    y += 8;
  }

  if (saldo > 0.01) {
    doc.setFillColor(254, 242, 242);
    doc.rect(15, y - 6, pageWidth - 30, 12, 'F');
    doc.setTextColor(185, 28, 28); doc.setFontSize(12);
    doc.text('SALDO A PAGAR:', col.unit - 30, y + 2);
    doc.text(`R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, col.total, y + 2);
  } else {
    doc.setFillColor(240, 253, 244);
    doc.rect(15, y - 6, pageWidth - 30, 12, 'F');
    doc.setTextColor(22, 163, 74); doc.setFontSize(12);
    doc.text('SERVIÇOS QUITADOS', 15, y + 2);
  }

  // Rodapé
  doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.setFont(undefined, 'normal');
  doc.text('Obrigado pela preferência! Em caso de dúvidas, entre em contato conosco.', 15, pageH - 10);

  doc.save(`Cobranca_${pag.cliente_nome.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
}

// Conta ocorrências de cada serviço e retorna string com multiplicadores
function resumirServicos(records) {
  const counts = {};
  records.forEach(r => {
    const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
    tipos.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  });
  return Object.entries(counts)
    .map(([tipo, qtd]) => qtd > 1 ? `${tipo} x${qtd}` : tipo)
    .join(' + ');
}

// Agrupa pagamentos do mesmo cliente (toda a semana = uma linha)
function groupPagamentos(lista) {
  const groups = {};
  lista.forEach(p => {
    const key = (p.cliente_nome || '').trim().toLowerCase();
    if (!groups[key]) {
      groups[key] = { ...p, _records: p._records || [p] };
    } else {
      const novoRecords = p._records || [p];
      groups[key]._records = [...(groups[key]._records || [groups[key]]), ...novoRecords];
    }
  });
  return Object.values(groups).map(g => {
    // Dedup por servico_id (mantem o mais recente). Sem servico_id passa direto.
    // Evita "Troca de local x2" quando ha 2 PagamentoCliente para o mesmo servico
    // (causado por regerar duplicado ou race no sync).
    const porServico = new Map();
    const semServicoId = [];
    g._records.forEach(r => {
      if (!r.servico_id) { semServicoId.push(r); return; }
      const existente = porServico.get(r.servico_id);
      const dataR = new Date(r.data_conclusao || r.created_date || 0);
      const dataE = existente ? new Date(existente.data_conclusao || existente.created_date || 0) : null;
      if (!existente || dataR > dataE) {
        porServico.set(r.servico_id, r);
      }
    });
    const recordsDedup = [...porServico.values(), ...semServicoId];
    const valorTotal = recordsDedup.reduce((s, r) => s + (r.valor_total || 0), 0);
    const valorPago = recordsDedup.reduce((s, r) => s + (r.valor_pago || 0), 0);
    const saldo = valorTotal - valorPago;
    // Tolerancia de R$1 so se houve algum pagamento (cobre arredondamento). Sem pagamento = pendente.
    const status = saldo <= 0.01 || (valorPago > 0 && saldo <= 1.0) ? 'pago' : valorPago > 0 ? 'parcial' : 'pendente';
    // Mescla historico_pagamentos dos records deduplicados
    const historicoMesclado = recordsDedup.flatMap(r => r.historico_pagamentos || []);
    return {
      ...g,
      _records: recordsDedup,
      valor_total: valorTotal,
      valor_pago: valorPago,
      status,
      historico_pagamentos: historicoMesclado,
      _tipoResumido: resumirServicos(recordsDedup),
    };
  });
}

// Modal exclusivo para DEFINIR PREÇOS
function DefinirPrecoModal({ open, onClose, pagamento, pagamentosAtuais = [], onSave }) {
  const [precosGrupo, setPrecosGrupo] = useState({});
  const [loading, setLoading] = useState(false);

  const servicosGrupos = useMemo(() => {
    if (!pagamento) return [];
    const records = (pagamento._records && pagamento._records.length > 0)
      ? pagamento._records
      : [pagamento];
    const counts = {};
    records.forEach(r => {
      const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
      tipos.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    // Fallback ROBUSTO: se nenhum tipo foi extraido (tipo_servico vazio, "+",
    // null, etc), garantir pelo menos 1 entrada para que o modal mostre 1 input
    // e o ADM possa precificar.
    if (Object.keys(counts).length === 0) {
      const tipoBruto = (pagamento.tipo_servico || '').trim() || 'Servico';
      counts[tipoBruto] = Math.max(1, records.length);
    }
    return Object.entries(counts).map(([tipo, qtd]) => ({ tipo, qtd }));
  }, [pagamento]);

  useEffect(() => {
    if (!open || !pagamento) return;
    const records = pagamento._records || [pagamento];

    const inicial = {};
    servicosGrupos.forEach(({ tipo }) => {
      // Busca um record onde TODOS os tipos são iguais a este tipo (mesmo tipo repetido N vezes)
      const rec = records.find(r => {
        const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
        return tipos.length > 0 && tipos.every(t => t === tipo) && (r.valor_total || 0) > 1;
      });
      if (rec) {
        const tipos = (rec.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
        const precoUnitario = tipos.length > 0 ? (rec.valor_total || 0) / tipos.length : (rec.valor_total || 0);
        inicial[tipo] = Number(precoUnitario).toFixed(2).replace('.', ',');
      } else {
        // Se algum record ja tem valor_total > 1 (mas nao matchou regex), usar como base
        const recComValor = records.find(r => (r.valor_total || 0) > 1);
        if (recComValor) {
          inicial[tipo] = Number(recComValor.valor_total).toFixed(2).replace('.', ',');
        } else {
          inicial[tipo] = '';
        }
      }
    });
    setPrecosGrupo(inicial);
  }, [open, pagamento?.id, servicosGrupos]);

  const handleSave = async () => {
    if (Object.values(precosGrupo).every(v => !parseFloat((v || '').replace(',', '.')))) {
      return toast.error('Defina ao menos um preço');
    }
    setLoading(true);
    await onSave(pagamento, precosGrupo);
    setLoading(false);
    onClose();
  };

  const inputRefs = useRef([]);
  const handleKeyDown = (e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = inputRefs.current[idx + 1];
      if (next) next.focus();
      else handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Tag className="w-5 h-5 text-blue-600" /> Definir Preços — {pagamento?.cliente_nome}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Preço unitário • pressione Enter para avançar</p>
          {servicosGrupos.map((g, idx) => {
            const preco = precosGrupo[g.tipo] || '';
            const precoNum = parseFloat(preco.replace(',', '.')) || 0;
            const totalLinha = precoNum * g.qtd;
            return (
              <div key={g.tipo} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{g.qtd}</span>
                  <span className="flex-1 text-sm text-gray-700 font-medium">{g.tipo}</span>
                  <span className="text-xs text-gray-400">R$</span>
                  <Input
                    ref={el => { inputRefs.current[idx] = el; }}
                    placeholder="0,00"
                    value={preco}
                    onChange={e => setPrecosGrupo(prev => ({ ...prev, [g.tipo]: e.target.value }))}
                    onKeyDown={e => handleKeyDown(e, idx)}
                    className={`w-28 h-9 text-sm text-right font-semibold ${precoNum === 0 ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}`}
                    autoFocus={idx === 0}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  {precoNum > 0
                    ? <><span>{g.qtd} × {formatCurrency(precoNum)}</span><span className="font-semibold text-gray-700">= {formatCurrency(totalLinha)}</span></>
                    : <span className="text-amber-500">Digite o valor unitário e pressione Enter</span>
                  }
                </div>
              </div>
            );
          })}
          {servicosGrupos.length > 0 && (() => {
            const totalGeral = servicosGrupos.reduce((s, g) => {
              const p = parseFloat((precosGrupo[g.tipo] || '').replace(',', '.')) || 0;
              return s + p * g.qtd;
            }, 0);
            return (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 mt-1">
                <span className="text-sm font-bold text-blue-800">Total Geral</span>
                <span className={`text-base font-bold ${totalGeral > 0 ? 'text-blue-700' : 'text-amber-500'}`}>
                  {totalGeral > 0 ? formatCurrency(totalGeral) : 'A definir'}
                </span>
              </div>
            );
          })()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? 'Salvando...' : '💾 Salvar Preços'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Modal exclusivo para REGISTRAR PAGAMENTO
function PagamentoModal({ open, onClose, pagamento, onSave, pagamentosAtuais = [], syncKey = 0, tecnicos = [] }) {
  const [obs, setObs] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [loading, setLoading] = useState(false);
  const [parcelas, setParcelas] = useState([]);
  const [novaData, setNovaData] = useState('');
  const [novoValorParcela, setNovoValorParcela] = useState('');
  const [valorRegistrar, setValorRegistrar] = useState('');
  const [desconto, setDesconto] = useState('');
  const [tecnicoRecebeu, setTecnicoRecebeu] = useState('adm');
  const [dataPagamentoAgendado, setDataPagamentoAgendado] = useState('');
  // Preços salvos (somente leitura neste modal)
  const [precosGrupo, setPrecosGrupo] = useState({});

  const servicosGrupos = useMemo(() => {
    const records = pagamento?._records || (pagamento ? [pagamento] : []);
    const counts = {};
    records.forEach(r => {
      const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
      tipos.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.entries(counts).map(([tipo, qtd]) => ({ tipo, qtd }));
  }, [pagamento]);

  useEffect(() => {
    if (!open) return;
    setObs('');
    setMetodoPagamento('');
    setParcelas([]);
    setNovaData('');
    setNovoValorParcela('');
    setValorRegistrar('');
    setDesconto('');
    setTecnicoRecebeu('adm');

    // Busca preços dos records mais frescos
    const records = pagamento?._records || (pagamento ? [pagamento] : []);
    const idsAtend = new Set(records.map(r => r.atendimento_id || r.id).filter(Boolean));
    const frescos = pagamentosAtuais.filter(p => idsAtend.has(p.atendimento_id) || idsAtend.has(p.id));
    const fonte = frescos.length > 0 ? frescos : records;

    const inicial = {};
    const counts = {};
    records.forEach(r => {
      const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
      tipos.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    Object.keys(counts).forEach(tipo => {
      // Tenta buscar um record com esse tipo que tenha valor_total > 0
      const rec = fonte.find(r => {
        const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
        return tipos.includes(tipo) && (r.valor_total || 0) > 0;
      });
      if (rec) {
        // Se encontrou, calcula o valor individual dividindo pelo número de tipos nesse record
        const tipos = (rec.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
        const valorIndividual = rec.valor_total / tipos.length;
        inicial[tipo] = Number(valorIndividual).toFixed(2).replace('.', ',');
      } else {
        inicial[tipo] = '';
      }
    });
    setPrecosGrupo(inicial);
  }, [open, pagamento, pagamentosAtuais, syncKey]);

  const totalDefinido = servicosGrupos.reduce((s, g) => {
    const preco = parseFloat((precosGrupo[g.tipo] || '').replace(',', '.')) || 0;
    return s + preco * g.qtd;
  }, 0);

  const totalPago = (pagamento?._records || (pagamento ? [pagamento] : [])).reduce((s, r) => s + (r.valor_pago || 0), 0);
  const saldo = totalDefinido - totalPago;
  const descontoNum = Math.max(0, parseFloat((desconto || '').replace(',', '.')) || 0);
  // Desconto nao pode ser maior que o saldo
  const descontoEfetivo = Math.min(descontoNum, Math.max(0, saldo));
  const saldoComDesconto = Math.max(0, saldo - descontoEfetivo);
  const valorAtualNum = parseFloat((valorRegistrar || '').replace(',', '.')) || 0;
  const todosPrecosDefinidos = servicosGrupos.every(g => parseFloat((precosGrupo[g.tipo] || '').replace(',', '.')) > 0);

  // Auto-ajuste: quando o usuario adiciona/altera o desconto e o valor digitado
  // passa do saldo com desconto, ajusta o valor para nao bloquear a confirmacao.
  // Caso comum: usuario clica "Preencher total" antes de colocar o desconto.
  useEffect(() => {
    if (!open) return;
    if (valorAtualNum > saldoComDesconto + 0.01) {
      setValorRegistrar(saldoComDesconto > 0.01 ? saldoComDesconto.toFixed(2).replace('.', ',') : '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descontoEfetivo]);

  const isValidDate = (dateStr) => {
    try {
      const date = new Date(dateStr + 'T12:00:00');
      return !isNaN(date.getTime());
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    if (!todosPrecosDefinidos) return toast.error('Preços não definidos. Use o botão 🏷️ Preços primeiro.');
    if (dataPagamentoAgendado && !isValidDate(dataPagamentoAgendado)) return toast.error('Data inválida');
    const v = parseFloat((valorRegistrar || '').replace(',', '.')) || 0;
    // Aceita valor zero APENAS se houver desconto (cobre caso de quitar so com desconto)
    if (v <= 0 && descontoEfetivo <= 0) return toast.error('Informe um valor ou desconto');
    if (v + descontoEfetivo > saldo + 0.01) {
      return toast.error(`Pagamento (${formatCurrency(v)}) + desconto (${formatCurrency(descontoEfetivo)}) excede o saldo (${formatCurrency(saldo)})`);
    }
    setLoading(true);
    const obsCompleta = [metodoPagamento, obs].filter(Boolean).join(' | ');
    await onSave(pagamento, v, obsCompleta, parcelas, precosGrupo, dataPagamentoAgendado, descontoEfetivo, tecnicoRecebeu, metodoPagamento);
    setLoading(false);
    setValorRegistrar('');
    setObs('');
    setParcelas([]);
    setDesconto('');
    setTecnicoRecebeu('adm');
    setDataPagamentoAgendado('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {/* Resumo do cliente */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="font-bold text-gray-800 text-base mb-3">{pagamento?.cliente_nome}</p>
            {!todosPrecosDefinidos && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                <AlertCircle className="w-3.5 h-3.5" /> Defina os preços usando o botão 🏷️ Preços antes de pagar
              </div>
            )}
            <div className="space-y-2 pt-3 border-t border-gray-200">
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <p className="text-xs text-red-600 font-semibold mb-0.5">💰 Débito Total</p>
                <p className="font-bold text-red-700 text-base">{totalDefinido > 0 ? formatCurrency(saldoComDesconto) : <span className="text-amber-500">A definir</span>}</p>
                {descontoEfetivo > 0.01 && (
                  <p className="text-[11px] text-orange-600 font-semibold mt-1">
                    🏷️ Desconto: -{formatCurrency(descontoEfetivo)} (saldo original: {formatCurrency(saldo)})
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-gray-400">Total</p><p className="font-bold text-gray-800 text-sm">{totalDefinido > 0 ? formatCurrency(totalDefinido) : <span className="text-amber-500 text-xs">A definir</span>}</p></div>
                <div><p className="text-xs text-gray-400">Pago</p><p className="font-bold text-green-600 text-sm">{formatCurrency(totalPago)}</p></div>
                <div><p className="text-xs text-gray-400">Saldo</p><p className="font-bold text-red-600 text-sm">{formatCurrency(saldoComDesconto)}</p></div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">📅 Data de Agendamento (opcional)</label>
            <Input type="date" value={dataPagamentoAgendado} onChange={e => setDataPagamentoAgendado(e.target.value)} className="h-10 text-sm" />
            {dataPagamentoAgendado && <p className="text-xs text-gray-400 mt-1">Será notificado em {format(new Date(dataPagamentoAgendado + 'T12:00:00'), 'dd/MM/yyyy')}</p>}
          </div>

          <div>
           <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">Valor a registrar (R$)</label>
           <Input placeholder="0,00" value={valorRegistrar} onChange={e => setValorRegistrar(e.target.value)} className="h-11 sm:h-12 text-base sm:text-lg font-semibold" autoFocus />
           {saldoComDesconto > 0.01 && (
             <button onClick={() => setValorRegistrar(saldoComDesconto.toFixed(2).replace('.', ','))} className="text-xs text-blue-600 mt-2 underline">
               Preencher total ({formatCurrency(saldoComDesconto)})
             </button>
           )}
          </div>

          <div>
           <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">🏷️ Desconto (R$) — opcional</label>
           <Input
             placeholder="0,00"
             value={desconto}
             onChange={e => setDesconto(e.target.value)}
             className="h-10 text-sm"
           />
           <p className="text-[11px] text-gray-500 mt-1">Sera abatido do saldo do cliente.</p>
           {descontoNum > 0 && descontoNum > saldo + 0.01 && (
             <p className="text-[11px] text-amber-600 font-semibold mt-1">
               ⚠ Desconto maior que o saldo — sera limitado a {formatCurrency(saldo)}
             </p>
           )}
          </div>

          <div>
           <label className="text-xs sm:text-sm font-medium text-gray-700 mb-2 block">Método de pagamento</label>
           <div className="grid grid-cols-2 gap-1.5">
             {['PIX', 'Dinheiro', 'Crédito', 'Débito', 'Máquina', 'Transferência'].map(m => {
               const mapLabel = { 'Crédito': 'Cartão de Crédito', 'Débito': 'Cartão de Débito', 'Máquina': 'Máquina de Cartão' };
               const fullLabel = mapLabel[m] || m;
               return (
                 <button key={m} type="button" onClick={() => setMetodoPagamento(prev => prev === fullLabel ? '' : fullLabel)}
                   className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
                     metodoPagamento === fullLabel ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                   }`}>
                   <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${metodoPagamento === fullLabel ? 'border-white bg-white' : 'border-gray-300'}`}>
                     {metodoPagamento === fullLabel && <span className="w-2 h-2 rounded-sm bg-blue-600 block" />}
                   </span>
                   {m}
                 </button>
               );
             })}
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">👤 Quem recebeu este valor?</label>
            <select
              value={tecnicoRecebeu}
              onChange={e => setTecnicoRecebeu(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-500"
            >
              <option value="adm">ADM (caixa da empresa)</option>
              {tecnicos.map(t => (
                <option key={t.tecnico_id} value={t.tecnico_id}>{t.tecnico_nome}</option>
              ))}
            </select>
            {tecnicoRecebeu !== 'adm' && valorAtualNum > 0 && (
              <p className="text-[11px] text-blue-600 font-medium mt-1.5">
                ✓ Sera creditado como pagamento ao tecnico (debita do credito pendente).
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Observação (opcional)</label>
            <Input placeholder="Ex: referência, número do comprovante..." value={obs} onChange={e => setObs(e.target.value)} />
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={
            loading
            || saldo <= 0
            || !todosPrecosDefinidos
            || (valorAtualNum <= 0 && descontoEfetivo <= 0)
            || (valorAtualNum > 0 && !metodoPagamento)
          } className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">
            {loading ? 'Salvando...' : '✓ Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgendarDataModal({ open, onClose, pagamento, onSave }) {
  const [data, setData] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && pagamento) {
      setData(pagamento.data_pagamento_agendado || '');
    }
  }, [open, pagamento]);

  const handleSave = async () => {
    if (!data) return toast.error('Informe a data');
    setLoading(true);
    await onSave(pagamento, data);
    setLoading(false);
    setData('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-[95vw]">
        <DialogHeader><DialogTitle>Agendar Data de Pagamento</DialogTitle></DialogHeader>
        <div className="py-3 space-y-3">
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <span className="font-semibold">{pagamento?.cliente_nome}</span>
            <br />
            <TipoServicoDisplay value={pagamento?.tipo_servico} />
          </p>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">📅 Data que o cliente vai pagar</label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-11" autoFocus />
            {data && <p className="text-xs text-blue-600 mt-2">Você será notificado em {format(new Date(data + 'T12:00:00'), 'dd/MM/yyyy')}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? 'Agendando...' : '✓ Agendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarValorModal({ open, onClose, pagamento, onSave }) {
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open && pagamento) setValor(String(pagamento.valor_total || '').replace('.', ',')); }, [open, pagamento]);

  const handleSave = async () => {
    const v = parseFloat(valor.replace(',', '.'));
    if (!v || v <= 0) return toast.error('Valor inválido');
    setLoading(true);
    await onSave(pagamento, v);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Valor do Serviço</DialogTitle></DialogHeader>
        <div className="py-3 space-y-3">
          <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">{pagamento?.cliente_nome} — {formatTipoServicoCompact(pagamento?.tipo_servico)}</p>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Novo valor (R$)</label>
            <Input value={valor} onChange={e => setValor(e.target.value)} className="h-12 text-lg font-semibold" autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalhesClienteModal({ open, onClose, pagamento }) {
  const records = pagamento?._records || (pagamento ? [pagamento] : []);

  // Agrupar cada tipo de serviço com suas ocorrências individuais
  const servicosAgrupados = useMemo(() => {
    const groups = {};
    records.forEach(r => {
      // Contar quantas vezes cada tipo aparece dentro deste record
      const tiposRaw = (r.tipo_servico || 'Sem tipo').split('+').map(s => s.trim()).filter(Boolean);
      const contagem = {};
      tiposRaw.forEach(t => { contagem[t] = (contagem[t] || 0) + 1; });
      const tiposUnicos = Object.keys(contagem);
      const totalTipos = tiposRaw.length;
      const valorPorUnitario = totalTipos > 0 ? (r.valor_total || 0) / totalTipos : 0;

      tiposUnicos.forEach(tipo => {
        const qtdNesteRecord = contagem[tipo];
        if (!groups[tipo]) groups[tipo] = { tipo, totalQtd: 0, ocorrencias: [] };
        groups[tipo].totalQtd += qtdNesteRecord;
        groups[tipo].ocorrencias.push({
          data: r.data_conclusao,
          equipe: r.equipe_nome,
          qtd: qtdNesteRecord,
          valorTotal: valorPorUnitario * qtdNesteRecord,
          valorUnitario: valorPorUnitario,
          id: r.id,
        });
      });
    });
    return Object.values(groups).sort((a, b) => b.totalQtd - a.totalQtd);
  }, [records]);

  const totalGeral = records.reduce((s, r) => s + (r.valor_total || 0), 0);
  const totalPago = records.reduce((s, r) => s + (r.valor_pago || 0), 0);
  const saldo = totalGeral - totalPago;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Detalhes — {pagamento?.cliente_nome}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Resumo financeiro */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">Serviços</p>
              <p className="font-bold text-gray-800 text-lg">{records.length}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
              <p className="text-xs text-gray-400 mb-0.5">Faturado</p>
              <p className="font-bold text-blue-700 text-sm">{formatCurrency(totalGeral)}</p>
            </div>
            <div className={`rounded-xl p-3 text-center border ${saldo > 0.01 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
              <p className="text-xs text-gray-400 mb-0.5">{saldo > 0.01 ? 'Em débito' : 'Quitado'}</p>
              <p className={`font-bold text-sm ${saldo > 0.01 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(saldo)}</p>
            </div>
          </div>

          {/* Serviços agrupados por tipo */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Serviços Realizados</p>
            <div className="space-y-3">
              {servicosAgrupados.map((g) => {
                const qtd = g.totalQtd;
                const totalTipo = g.ocorrencias.reduce((s, o) => s + (o.valorTotal || 0), 0);
                const valorUnitario = qtd > 0 ? totalTipo / qtd : 0;
                return (
                  <div key={g.tipo} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Cabeçalho do tipo */}
                    <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {qtd > 1 ? `x${qtd}` : '1'}
                        </span>
                        <span className="text-sm font-semibold text-gray-800">{g.tipo}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-700 text-sm">{formatCurrency(totalTipo)}</p>
                        {qtd > 1 && valorUnitario > 0 && (
                          <p className="text-xs text-gray-400">{formatCurrency(valorUnitario)} / un.</p>
                        )}
                      </div>
                    </div>
                    {/* Ocorrências individuais por data */}
                    <div className="divide-y divide-gray-50">
                      {g.ocorrencias.map((o, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-white text-xs">
                          <div className="flex items-center gap-2 text-gray-500">
                            <Calendar className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                            <span className="font-medium text-gray-700">
                              {o.data ? format(parseISO(o.data), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                            </span>
                            {o.qtd > 1 && <span className="bg-blue-100 text-blue-600 px-1.5 rounded font-semibold">x{o.qtd}</span>}
                            {o.equipe && (
                              <span className="text-blue-500 font-medium">· 👷 {o.equipe}</span>
                            )}
                          </div>
                          {o.valorTotal > 0 && (
                            <span className="font-semibold text-gray-700">{formatCurrency(o.valorTotal)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total final */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs text-gray-500">Total faturado</p>
              <p className="font-bold text-gray-800">{formatCurrency(totalGeral)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Já pago</p>
              <p className="font-bold text-green-600">{formatCurrency(totalPago)}</p>
            </div>
            {saldo > 0.01 && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Saldo</p>
                <p className="font-bold text-red-600">{formatCurrency(saldo)}</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoModal({ open, onClose, pagamento }) {
  const records = pagamento?._records || (pagamento ? [pagamento] : []);
  // Merge historico de todos os records
  const todosPagamentos = records.flatMap(r => (r.historico_pagamentos || []).map(h => ({ ...h, _equipe: r.equipe_nome }))).sort((a, b) => (parseHistoricoData(a.data)?.getTime() || 0) - (parseHistoricoData(b.data)?.getTime() || 0));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Histórico — {pagamento?.cliente_nome}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <TipoServicoDisplay value={pagamento?.tipo_servico} />

          {/* Serviços realizados */}
          {records.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Serviços Realizados ({records.length})</p>
              <div className="space-y-1.5">
                {records.map((r, i) => (
                  <div key={r.id || i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">
                        {r.data_conclusao ? format(parseISO(r.data_conclusao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'}
                      </p>
                      {r.equipe_nome && <p className="text-xs text-blue-600">👷 {r.equipe_nome}</p>}
                    </div>
                    <span className="font-semibold text-gray-700 text-sm">{formatCurrency(r.valor_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico de pagamentos */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pagamentos Registrados</p>
            {!todosPagamentos.length ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum pagamento registrado</p>
            ) : (
              <div className="space-y-2">
                {todosPagamentos.map((h, i) => (
                  <div key={i} className={`flex items-center justify-between border rounded-lg px-4 py-2.5 ${h.agendada ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
                    <div>
                      <div className="flex items-center gap-1.5">
                        {h.agendada && <Calendar className="w-3 h-3 text-blue-500" />}
                        <p className="text-xs font-medium text-gray-700">{h.data}</p>
                        {h.agendada && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 rounded font-medium">Agendado</span>}
                      </div>
                      {h.observacao && !h.agendada && <p className="text-xs text-gray-400">{h.observacao}</p>}
                    </div>
                    <span className={`font-bold ${h.agendada ? 'text-blue-600' : 'text-green-600'}`}>{formatCurrency(h.valor)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-sm px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <span>Total pago</span>
                  <span className="text-green-700">{formatCurrency(pagamento?.valor_pago)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Card compacto estilo tabela com expansão
function LinhaTabela({ pag, onPagar, onEditarValor, onHistorico, onDelete, onDetalhes, onDefinirPreco, onAgendarData, alertaDinheiro, onDismissAlerta, onMarcarPago, onReverterPagamento }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [expandido, setExpandido] = useState(false);
  const records = pag._records || [pag];
  const saldo = calcularSaldo(pag.valor_total, pag.valor_pago);
  const _valorPago = pag.valor_pago || 0;
  // Tolerância de R$1 só se houve algum pagamento (cobre arredondamento em serviços compostos)
  const isPago = pag.status === 'pago' || saldo <= 0.01 || (_valorPago > 0 && saldo <= 1.0);
  const isParcial = !isPago && pag.status === 'parcial' && _valorPago > 0;
  const temHistoricoReal = (pag.historico_pagamentos || []).some(h => !h.agendada && !h.consolidado);
  // Mostrar 100% apenas se realmente pago — evitar display enganoso
  const pct = pag.valor_total > 0
    ? isPago ? 100 : Math.min(99, Math.round((_valorPago / pag.valor_total) * 100))
    : 0;
  const temPrecoDefinido = pag.valor_total > 0;
  const dataAgendada = pag.data_pagamento_agendado ? parseISO(pag.data_pagamento_agendado) : null;
  const hoje = new Date();
  const chegoDataAgendada = dataAgendada && isAfter(hoje, dataAgendada) && !isPago;

  // Próxima parcela agendada no histórico (para exibir em serviços parciais)
  const proximaParcelaAgendada = useMemo(() => {
    if (!isParcial) return null;
    // Busca em _records E no próprio pag (caso agrupado com um único registro)
    const fontes = records.length > 0 ? records : [pag];
    const todasParcelas = [
      ...(pag.historico_pagamentos || []).filter(h => h.agendada),
      ...fontes.flatMap(r => (r.historico_pagamentos || []).filter(h => h.agendada)),
    ];
    // Deduplica por data+valor
    const unicas = todasParcelas.filter((p, i, arr) =>
      arr.findIndex(x => x.data === p.data && x.valor === p.valor) === i
    );
    if (!unicas.length) return null;
    const parseData = (d) => {
      if (!d) return null;
      const parte = d.split(' ')[0].split('/');
      if (parte.length === 3) return new Date(`${parte[2]}-${parte[1]}-${parte[0]}T12:00:00`);
      return null;
    };
    const comDatas = unicas.map(p => ({ ...p, _date: parseData(p.data) })).filter(p => p._date);
    const futuras = comDatas.filter(p => p._date >= hoje);
    if (futuras.length) return futuras.sort((a, b) => a._date - b._date)[0];
    return comDatas.sort((a, b) => b._date - a._date)[0] || null;
  }, [isParcial, records, pag]);

  return (
    <div className={`border rounded-lg transition-all ${
      chegoDataAgendada
        ? 'border-orange-400 bg-orange-50 shadow-md shadow-orange-200'
        : expandido
        ? 'border-blue-300 bg-blue-50/30'
        : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div onClick={() => setExpandido(!expandido)} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${expandido ? 'bg-white border-b border-blue-200' : 'hover:bg-gray-50/50'}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
        {chegoDataAgendada && <span className="text-lg flex-shrink-0 animate-pulse" title="Data de agendamento chegou!">🔔</span>}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
            chegoDataAgendada ? 'bg-orange-500' : isPago ? 'bg-green-500' : isParcial ? 'bg-amber-500' : 'bg-blue-500'
          }`}>
            {pag.cliente_nome?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {alertaDinheiro && (
              <button
                onClick={(e) => { e.stopPropagation(); onDismissAlerta(alertaDinheiro); }}
                className="flex items-center gap-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold text-xs px-2 py-1 rounded-lg border-2 border-yellow-500 shadow-md animate-pulse flex-shrink-0"
                title="Clique para confirmar visualização: cliente pagou em dinheiro"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                💵 DINHEIRO — confirmar
              </button>
            )}
            <p className="font-semibold text-sm text-gray-800">{pag.cliente_nome}</p>
              {pag.data_pagamento_agendado && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-semibold flex-shrink-0">
                  📅 {format(toLocalDateSafe(pag.data_pagamento_agendado), 'dd/MM')}
                </span>
              )}
              {isParcial && proximaParcelaAgendada && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-semibold flex-shrink-0">
                  📅 {proximaParcelaAgendada.data.split(' ')[0].split('/').slice(0,2).join('/')}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">{pag._tipoResumido || formatTipoServicoCompact(pag.tipo_servico)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="text-left flex-shrink-0">
            <p className="text-xs text-gray-400">Valor</p>
            <p className={`font-semibold text-sm ${pag.valor_total === 0 ? 'text-amber-500' : 'text-gray-800'}`}>
              {pag.valor_total === 0 ? 'A def.' : formatCurrency(pag.valor_total).replace('R$', '').trim()}
            </p>
          </div>
          <div className="flex-shrink-0">
            {isPago
              ? <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs">✓ Pago</Badge>
              : isParcial
              ? <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs">Parcial</Badge>
              : pag.data_pagamento_agendado
              ? <Badge className="bg-purple-100 text-purple-700 border border-purple-200 text-xs">📅 Agendado</Badge>
              : temPrecoDefinido ? <Badge className="bg-red-100 text-red-700 border border-red-200 text-xs">Pendente</Badge> : <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-200 text-xs">Sem preço</Badge>
            }
          </div>
        </div>

        <div className="w-full sm:w-16 flex-shrink-0">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all ${isPago ? 'bg-green-500' : isParcial ? 'bg-amber-500' : 'bg-red-400'}`}
              style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400 text-right mt-0.5">{pct}%</p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onDetalhes(pag)} className="p-1.5 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 flex-shrink-0" title="Detalhes">
            <Eye className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button onClick={() => gerarPDFCobranca(pag)} className="p-1.5 rounded text-gray-400 hover:text-green-700 hover:bg-green-50 flex-shrink-0" title="PDF para cliente">
              <FileDown className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => onHistorico(pag)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 flex-shrink-0" title="Histórico">
            <History className="w-4 h-4" />
          </button>
          {!isPago && (
            <>
              <button onClick={() => onDefinirPreco(pag)} className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold whitespace-nowrap">
                Preço
              </button>
              {pag.telefone && (
                <a href={getWhatsApp(pag.telefone)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-xs flex items-center gap-1.5 flex-shrink-0 shadow-md hover:shadow-lg transition-all" title="WhatsApp">
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}
              <button onClick={() => onAgendarData(pag)} className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold whitespace-nowrap flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Agendar
              </button>
              <button onClick={() => onPagar(pag)} className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-semibold whitespace-nowrap">
                Pagar
              </button>
              {isAdmin && isParcial && pct >= 90 && onMarcarPago && (
                <button
                  onClick={() => { if (confirm(`Marcar "${pag.cliente_nome}" como pago (${formatCurrency(pag.valor_total)})?`)) onMarcarPago(pag); }}
                  className="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded font-semibold whitespace-nowrap"
                  title="Forçar status pago (diferença por arredondamento)"
                >
                  ✓ Quitar
                </button>
              )}
            </>
          )}
          {isAdmin && temHistoricoReal && onReverterPagamento && (
            <button
              onClick={() => { if (confirm(`Reverter último pagamento de "${pag.cliente_nome}"?`)) onReverterPagamento(pag); }}
              className="p-1.5 rounded text-orange-500 hover:bg-orange-50 flex-shrink-0"
              title="Reverter último pagamento"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => onDelete(pag)} className="p-1.5 rounded text-red-500 hover:bg-red-50 flex-shrink-0" title="Excluir">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expandido && (
        <div className="px-4 py-3 bg-white border-t border-blue-200 space-y-2 text-sm">
          {pag.telefone && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-gray-600">Contato:</span>
              <a href={getWhatsApp(pag.telefone)} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" />
                {formatPhone(pag.telefone)}
              </a>
            </div>
          )}
          {pag.equipe_nome && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-gray-600">Equipe:</span>
              <span className="text-gray-800 font-medium">👷 {pag.equipe_nome}</span>
            </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-gray-600">Data:</span>
            <span className="text-gray-800 font-medium text-xs">
              {pag.data_conclusao ? format(parseISO(pag.data_conclusao), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
            </span>
          </div>
          {pag._records && pag._records.length > 1 && (
            <div className="text-xs text-gray-600">
              <span className="font-medium">Serviços: {pag._records.length} registros</span>
            </div>
          )}
          {chegoDataAgendada && (
            <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-100 border border-orange-300 rounded px-3 py-2 font-semibold">
              <span>🔔 COBRAR HOJE! ({format(dataAgendada, 'dd/MM/yyyy')})</span>
            </div>
          )}
          {pag.data_pagamento_agendado && !chegoDataAgendada && (
            <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Agendado para: {format(dataAgendada, 'dd/MM/yyyy')}</span>
            </div>
          )}
          {!isPago && temPrecoDefinido && (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded px-3 py-2">
              <span className="text-red-700 font-semibold text-xs">Saldo devido:</span>
              <span className="text-red-700 font-bold">{formatCurrency(saldo)}</span>
            </div>
          )}
          {!temPrecoDefinido && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 font-semibold animate-pulse">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 animate-bounce" />
              <span>🚨 CRÍTICO: Defina o preço deste serviço antes de aceitar pagamento!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabelaPagamentos({ lista, onPagar, onEditarValor, onHistorico, onDelete, onDetalhes, onDefinirPreco, onAgendarData, emptyMsg, alertasDinheiro = [], onDismissAlerta, onMarcarPago, onReverterPagamento }) {
  return (
    <div className="space-y-2">
      {lista.length === 0 ? (
        <div className="text-center py-14 text-gray-400 bg-white rounded-lg border border-gray-200">
          <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{emptyMsg}</p>
        </div>
      ) : lista.map(p => {
        const alertaDinheiro = alertasDinheiro.find(n => n.cliente_nome?.trim().toLowerCase() === (p.cliente_nome || '').trim().toLowerCase() && !n.lida);
        return (
          <LinhaTabela key={p.id} pag={p} onPagar={onPagar} onEditarValor={onEditarValor} onHistorico={onHistorico} onDelete={onDelete} onDetalhes={onDetalhes} onDefinirPreco={onDefinirPreco} onAgendarData={onAgendarData} alertaDinheiro={alertaDinheiro} onDismissAlerta={onDismissAlerta} onMarcarPago={onMarcarPago} onReverterPagamento={onReverterPagamento} />
        );
      })}
    </div>
  );
}

export default function PagamentosClientes() {
  return (
    <TechnicianAccessBlock>
      <PagamentosClientesContent />
    </TechnicianAccessBlock>
  );
}

function PagamentosClientesContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  // Bloquear acesso para não-admins
  const isAdmin = user?.role === 'admin';

  const criandoIds = useRef(new Set());
  const deletedAtendimentoIds = useRef(new Set(
    JSON.parse(localStorage.getItem('pag_deleted_atend_ids') || '[]')
  ));
  const secaoSemPrecoRef = useRef(null);
  const secaoCobrarRef = useRef(null);
  const autoArquivadoRef = useRef(false);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [highlightSecao, setHighlightSecao] = useState('');

  // Ler parâmetro de URL e fazer scroll
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const h = params.get('highlight');
    if (h) {
      setHighlightSecao(h);
      const timer = setTimeout(() => {
        const ref = h === 'sempreco' ? secaoSemPrecoRef : h === 'cobrar' ? secaoCobrarRef : null;
        if (ref?.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const { data: notificacoesDinheiro = [], refetch: refetchNotif } = useQuery({
    queryKey: ['notif-dinheiro'],
    queryFn: () => base44.entities.Notificacao.filter({ tipo: 'pagamento_agendado', lida: false }),
  });
  const alertasDinheiro = notificacoesDinheiro.filter(n => n.titulo?.includes('Pagamento em Dinheiro') || n.titulo?.includes('💵'));

  const handleDismissAlerta = async (notif) => {
    await base44.entities.Notificacao.update(notif.id, { lida: true });
    refetchNotif();
    toast.success('✅ Pagamento em dinheiro confirmado!');
  };

  const [pagarModal, setPagarModal] = useState(null);
  const [precosModal, setPrecosModal] = useState(null);
  const [editarModal, setEditarModal] = useState(null);
  const [historicoModal, setHistoricoModal] = useState(null);
  const [detalhesModal, setDetalhesModal] = useState(null);
  const [agendarDataModal, setAgendarDataModal] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('semana');
  const [precosSyncKey, setPrecosSyncKey] = useState(0);
  const [abrirRelatorio, setAbrirRelatorio] = useState(false);
  const [compartilharModal, setCompartilharModal] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState(['pendente', 'parcial', 'agendado', 'pago']);

  const toggleFiltroStatus = (status) => {
    setFiltroStatus(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const handleExportarExcel = async () => {
    const statusFiltros = filtroStatus.length === 0 ? ['pendente', 'parcial', 'agendado', 'pago'] : filtroStatus;

    const lista = pagamentos.filter(p =>
      statusFiltros.includes(p.status) &&
      !isApenasTiposIgnorados(p.tipo_servico)
    );

    const agrupado = {};
    lista.forEach(p => {
      const key = (p.cliente_nome || '').trim().toLowerCase();
      if (!agrupado[key]) {
        agrupado[key] = {
          cliente_nome: p.cliente_nome,
          telefone: p.telefone,
          valor_total: 0,
          valor_pago: 0,
          datas_agendadas: [],
          status: p.status,
        };
      }
      agrupado[key].valor_total += p.valor_total || 0;
      agrupado[key].valor_pago += p.valor_pago || 0;
      if (p.data_pagamento_agendado) agrupado[key].datas_agendadas.push(p.data_pagamento_agendado);
      const prioridade = { pendente: 0, agendado: 1, parcial: 2, pago: 3 };
      if ((prioridade[p.status] || 0) > (prioridade[agrupado[key].status] || 0)) {
        agrupado[key].status = p.status;
      }
    });

    const rows = Object.values(agrupado).map(c => {
      const vt = c.valor_total || 0;
      const vp = c.valor_pago || 0;
      return {
        'Cliente': c.cliente_nome || '',
        'Telefone': c.telefone ? c.telefone.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : '',
        'Total (R$)': parseFloat(vt.toFixed(2)),
        'Pago (R$)': parseFloat(vp.toFixed(2)),
        'Pendente (R$)': parseFloat(Math.max(0, vt - vp).toFixed(2)),
        'Status': c.status,
        'Datas Agendadas': c.datas_agendadas.join(', ') || '-',
      };
    });

    rows.sort((a, b) => b['Pendente (R$)'] - a['Pendente (R$)']);

    const label = statusFiltros.join('_');
    await exportarExcel(
      [{ name: 'Pagamentos Clientes', data: rows, colWidths: [28, 18, 14, 14, 14, 12, 22] }],
      `pagamentos_clientes_${label}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`
    );
  };

  // Relatórios
  const [relFiltro, setRelFiltro] = useState('semana');
  const [relDataInicio, setRelDataInicio] = useState('');
  const [relDataFim, setRelDataFim] = useState('');
  const [relCliente, setRelCliente] = useState('');

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos-pag'],
    queryFn: () => base44.entities.Atendimento.list('-data_conclusao'),
  });

  const { data: servicosConcluidos = [] } = useQuery({
    queryKey: ['servicos-concluidos-pag'],
    queryFn: () => base44.entities.Servico.filter({ status: 'concluido' }, '-data_conclusao'),
  });

  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ['pagamentos-clientes'],
    queryFn: () => base44.entities.PagamentoCliente.list('-data_conclusao'),
  });

  // Lista de tecnicos para o Select "Quem recebeu este valor?" no modal de pagamento.
  const { data: tecnicosFinanceiros = [] } = useQuery({
    queryKey: ['tecnicos-financeiro-pag'],
    queryFn: () => base44.entities.TecnicoFinanceiro.list(),
  });

  // Índice O(1) por nome de cliente normalizado.
  // Sem isso, o auto-sync de atendimentos→pagamentos roda O(N×M) — a 30k atendimentos × 50k pagamentos
  // o navegador trava no useEffect de montagem.
  const pagamentosPorNome = useMemo(() => {
    const map = new Map();
    pagamentos.forEach(p => {
      const key = (p.cliente_nome || '').trim().toLowerCase();
      if (!key) return;
      const arr = map.get(key);
      if (arr) arr.push(p); else map.set(key, [p]);
    });
    return map;
  }, [pagamentos]);

  // Lookups por ID para resolver tipo_servico de pagamentos com campo vazio
  // (ex: sync antigo que nao copiou tipo_servico do atendimento/servico).
  const atendimentoPorId = useMemo(() => {
    const map = new Map();
    atendimentos.forEach(a => { if (a.id) map.set(a.id, a); });
    return map;
  }, [atendimentos]);

  const servicoPorId = useMemo(() => {
    const map = new Map();
    servicosConcluidos.forEach(s => { if (s.id) map.set(s.id, s); });
    return map;
  }, [servicosConcluidos]);

  // Enriquece um pagamento com tipo_servico resolvido via atendimento_id ou
  // servico_id quando o campo esta vazio. Retorna o objeto pagamento clonado
  // com tipo_servico preenchido (ou o original se ja tinha).
  const enriquecerTipoServico = (pag) => {
    if (!pag) return pag;
    const enrich = (rec) => {
      if (rec.tipo_servico && rec.tipo_servico.trim()) return rec;
      // Tenta atendimento primeiro, depois servico
      const aMatch = rec.atendimento_id ? atendimentoPorId.get(rec.atendimento_id) : null;
      const sMatch = rec.servico_id ? servicoPorId.get(rec.servico_id) : null;
      const tipoResolvido = (aMatch?.tipo_servico || sMatch?.tipo_servico || '').trim();
      return tipoResolvido ? { ...rec, tipo_servico: tipoResolvido } : rec;
    };
    const enriquecido = enrich(pag);
    if (pag._records && pag._records.length > 0) {
      enriquecido._records = pag._records.map(enrich);
    }
    return enriquecido;
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PagamentoCliente.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pagamentos-clientes'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PagamentoCliente.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pagamentos-clientes'] }),
  });

  const handleDelete = (pag) => {
    // Soft-delete: arquiva em vez de deletar do banco.
    // Isso mantém o atendimento_id em idsRegistrados e impede que a sincronização
    // automática recrie o registro ao detectar o atendimento sem pagamento.
    const records = pag._records?.length > 0 ? pag._records : [pag];

    records.forEach(rec => {
      if (rec.id) {
        updateMutation.mutate({ id: rec.id, data: { arquivado: true, excluido_manual: true } });
      }
    });

    toast.success('Registro removido!');
  };

  const hoje = new Date();
  const inicioSemana = startOfWeek(hoje, { weekStartsOn: 1 }); // segunda-feira
  const fimSemana = endOfWeek(hoje, { weekStartsOn: 1 }); // domingo

  // Helper: verifica se registro é "efetivamente pago" (DB pago, tolerância ou placeholder)
  const isEfetivamentePago = useCallback((p) => {
    const valorPago = p.valor_pago || 0;
    const saldo = (p.valor_total || 0) - valorPago;
    return (
      p.status === 'pago' ||
      (valorPago > 0 && saldo <= 1.0) ||        // pago com tolerância de R$1
      ((p.valor_total || 0) <= 1.0 && valorPago === 0) // placeholder sem pagamento real
    );
  }, []);

  // Helper: verifica se data é de semana anterior
  const isDeSemanasAnteriores = useCallback((p) => {
    const dataRef = p.data_pagamento_completo || p.data_conclusao;
    if (!dataRef) return false;
    try {
      return !isWithinInterval(parseISO(dataRef), { start: inicioSemana, end: fimSemana });
    } catch { return false; }
  }, [inicioSemana, fimSemana]);

  // Auto-arquivar pagamentos pagos de semanas anteriores ao carregar a página
  useEffect(() => {
    if (!isAdmin || autoArquivadoRef.current || pagamentos.length === 0) return;

    const candidatos = pagamentos.filter(p =>
      !p.arquivado &&
      isEfetivamentePago(p) &&
      isDeSemanasAnteriores(p)
    );

    autoArquivadoRef.current = true;
    if (candidatos.length === 0) return;

    // Arquivar silenciosamente em segundo plano
    (async () => {
      for (const p of candidatos) {
        try { await updateMutation.mutateAsync({ id: p.id, data: { arquivado: true } }); } catch {}
      }
    })();
   
  }, [pagamentos.length, isAdmin]);

  // Sincronizar apenas ATENDIMENTOS DA SEMANA ATUAL — 1 registro por atendimento
  useEffect(() => {
    if (isLoading || !atendimentos.length || !pagamentos) return;
    // Aguarda pagamentos estarem carregados (evita criar duplicatas na montagem)
    const idsRegistrados = new Set(pagamentos.map(p => p.atendimento_id).filter(Boolean));
    // Defesa em profundidade: tambem deduplica por servico_id (evita 2 pagamentos
    // para o mesmo servico mesmo se vierem de atendimentos diferentes — caso raro
    // de regerar duplicado ou race no fluxo de conclusao).
    const servicosRegistrados = new Set(pagamentos.map(p => p.servico_id).filter(Boolean));
    // Chave composta cliente+tipo+data para casos onde servico_id e atendimento_id
    // mudam mas o pagamento e logicamente o mesmo (ex: regerar atendimento ao
    // mesmo tempo que outra aba criou um pagamento — sem essa proteção dava duplicata).
    const compoundKey = (cliente, tipo, dataRef) =>
      `${(cliente || '').trim().toLowerCase()}|${(tipo || '').trim()}|${(dataRef || '').slice(0, 10)}`;
    const compoundsRegistrados = new Set(
      pagamentos.map(p => compoundKey(p.cliente_nome, p.tipo_servico, p.data_conclusao))
    );

    const novos = atendimentos.filter(a => {
      if (idsRegistrados.has(a.id)) return false;
      if (a.servico_id && servicosRegistrados.has(a.servico_id)) return false;
      if (criandoIds.current.has(a.id)) return false;
      if (deletedAtendimentoIds.current.has(a.id)) return false;
      if (isApenasTiposIgnorados(a.tipo_servico)) return false;
      const dataRef = a.data_conclusao || a.created_date;
      if (!dataRef) return false;
      // Protege contra duplicacao via compound key (cliente+tipo+data)
      if (compoundsRegistrados.has(compoundKey(a.cliente_nome, a.tipo_servico, dataRef))) return false;
      try {
        const data = parseISO(dataRef);
        return isWithinInterval(data, { start: inicioSemana, end: fimSemana });
      } catch { return false; }
    });

    if (novos.length === 0) return;

    // Sequencializa as criacoes (mutateAsync) para que cada nova insercao
    // adicione seu compound key ao Set ANTES da proxima iteracao — evita
    // criar 2 pagamentos do mesmo cliente+tipo+data se a query nao refetchar
    // a tempo entre as iteracoes.
    (async () => {
      for (const a of novos) {
        const dataRef = a.data_conclusao || a.created_date;
        const ck = compoundKey(a.cliente_nome, a.tipo_servico, dataRef);
        if (compoundsRegistrados.has(ck)) continue; // dupla checagem em caso de race
        compoundsRegistrados.add(ck);
        criandoIds.current.add(a.id);

        const nomeNormalizado = (a.cliente_nome || '').trim().toLowerCase();
        const telefoneLimpo = (a.telefone || '').replace(/\D/g, '');

        // Lookup O(1) por nome
        const candidatosDoCliente = pagamentosPorNome.get(nomeNormalizado) || [];
        const debitosAtrasados = candidatosDoCliente.filter(p => {
          const pTelefoneLimpo = (p.telefone || '').replace(/\D/g, '');
          const debitoPendente = calcularSaldo(p.valor_total, p.valor_pago);
          if (telefoneLimpo && pTelefoneLimpo && telefoneLimpo !== pTelefoneLimpo) return false;
          if (debitoPendente <= 0.01) return false;
          if (p.data_conclusao) {
            try {
              if (isWithinInterval(parseISO(p.data_conclusao), { start: inicioSemana, end: fimSemana })) return false;
            } catch {}
          }
          return true;
        });

        const debitoTotal = debitosAtrasados.reduce((sum, p) => sum + ((p.valor_total || 0) - (p.valor_pago || 0)), 0);

        try {
          await createMutation.mutateAsync({
            atendimento_id: a.id,
            servico_id: a.servico_id || '',
            cliente_nome: a.cliente_nome || '',
            telefone: a.telefone || '',
            tipo_servico: a.tipo_servico || '',
            data_conclusao: a.data_conclusao || a.created_date,
            valor_total: debitoTotal > 0 ? debitoTotal : 1.0,
            valor_pago: 0,
            status: 'pendente',
            equipe_nome: a.equipe_nome || '',
            historico_pagamentos: debitoTotal > 0 ? [{
              valor: debitoTotal,
              data: format(new Date(), 'dd/MM/yyyy HH:mm'),
              observacao: '🔗 Débitos anteriores consolidados',
              consolidado: true
            }] : [],
          });
        } catch (err) {
          console.error('Falha ao criar PagamentoCliente do atendimento', a.id, err);
          criandoIds.current.delete(a.id);
        }
      }
    })();
  }, [atendimentos, isLoading, pagamentos.length]);

  const handleSalvarPrecos = async (pag, precosGrupo) => {
    // Busca registros frescos direto do pagamentos (evita dados desatualizados de _records)
    const nomeKey = (pag.cliente_nome || '').trim().toLowerCase();
    const candidatos = pagamentosPorNome.get(nomeKey) || [];
    const recordsFrescos = candidatos.filter(p => p.status !== 'pago');
    const records = recordsFrescos.length > 0 ? recordsFrescos : (pag._records || [pag]);

    let atualizados = 0;
    for (const rec of records) {
      const tipos = (rec.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
      let novoPreco = tipos.reduce((sum, t) => {
        const val = parseFloat((precosGrupo[t] || '').replace(',', '.')) || 0;
        return sum + val;
      }, 0);
      // Fallback APENAS quando ha 1 unico record com tipo_servico vazio
      // (caso historico do Wesley). Se ha varios records, NAO somar tudo —
      // isso multiplicaria o valor total do cliente. Records sem match ficam
      // com seu valor atual.
      if (novoPreco === 0 && records.length === 1 && tipos.length === 0) {
        novoPreco = Object.values(precosGrupo).reduce((sum, v) => {
          return sum + (parseFloat((v || '').replace(',', '.')) || 0);
        }, 0);
      }
      if (novoPreco > 0) {
        const novoStatus = rec.data_pagamento_agendado ? 'agendado' : 'pendente';
        await updateMutation.mutateAsync({ id: rec.id, data: { valor_total: novoPreco, status: novoStatus } });
        atualizados++;
      }
    }
    toast.success(`💾 Preços salvos em ${atualizados} registro(s)!`);
    setPrecosSyncKey(k => k + 1);
  };

  const handleRegistrarPagamento = async (pag, valor, obs, parcelas = [], precosGrupo = {}, dataPagamentoAgendado = '', desconto = 0, tecnicoRecebeu = 'adm', metodoPagamento = '') => {
    const records = pag._records?.length > 1 ? pag._records : [pag];
    let remaining = valor;
    let descontoRemaining = Math.max(0, desconto || 0);
    const dataStr = format(new Date(), "dd/MM/yyyy HH:mm");

    const calcularValorRecord = (rec) => {
      const tipos = (rec.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
      const total = tipos.reduce((sum, t) => {
        const preco = parseFloat((precosGrupo[t] || '').replace(',', '.')) || 0;
        return sum + preco;
      }, 0);
      return total > 0 ? total : rec.valor_total;
    };

    const recordsAtualizados = records.map(rec => {
      const novoPreco = calcularValorRecord(rec);
      return { ...rec, valor_total: novoPreco > 0 ? novoPreco : rec.valor_total };
    });

    // Saldo total para distribuir desconto proporcionalmente entre os records
    const saldoTotalRecords = recordsAtualizados.reduce((s, r) => s + Math.max(0, calcularSaldo(r.valor_total, r.valor_pago)), 0);

    // Rastrear estado atualizado de cada record para repassar ao modal do PDF
    const recordsParaModal = recordsAtualizados.map(r => ({ ...r }));

    for (let i = 0; i < recordsAtualizados.length; i++) {
      const rec = recordsAtualizados[i];
      const recSaldo = calcularSaldo(rec.valor_total, rec.valor_pago);
      if (recSaldo <= 0.01) continue;

      // Distribui desconto proporcional ao saldo do record (ultimo absorve sobra)
      let descontoRec = 0;
      if (descontoRemaining > 0.01 && saldoTotalRecords > 0) {
        const isUltimoComSaldo = recordsAtualizados.slice(i + 1).every(r => calcularSaldo(r.valor_total, r.valor_pago) <= 0.01);
        if (isUltimoComSaldo) {
          descontoRec = Math.min(descontoRemaining, recSaldo);
        } else {
          const proporcao = recSaldo / saldoTotalRecords;
          descontoRec = Math.min(descontoRemaining, recSaldo, desconto * proporcao);
        }
        descontoRemaining = Math.max(0, descontoRemaining - descontoRec);
      }

      const novoValorTotal = (rec.valor_total || 0) - descontoRec;
      const saldoAposDesconto = recSaldo - descontoRec;
      const toPay = remaining > 0.01 ? Math.min(remaining, saldoAposDesconto) : 0;
      remaining = Math.max(0, remaining - toPay);
      const novoPago = (rec.valor_pago || 0) + toPay;

      const parcelasAgendadas = parcelas.map(p => ({
        valor: p.valor,
        data: format(new Date(p.data + 'T12:00:00'), 'dd/MM/yyyy'),
        observacao: '📅 Parcela agendada',
        agendada: true,
      }));
      const histDesconto = descontoRec > 0.01
        ? [{ valor: descontoRec, data: dataStr, observacao: '🏷️ Desconto aplicado', desconto: true }]
        : [];
      const histPagamento = toPay > 0.01
        ? [{ valor: toPay, data: dataStr, observacao: obs }]
        : [];
      const novoHistorico = [
        ...(rec.historico_pagamentos || []),
        ...histDesconto,
        ...histPagamento,
        ...parcelasAgendadas,
      ];
      const isQuitado = novoPago >= novoValorTotal - 0.01;
      const statusFinal = isQuitado ? 'pago' : (dataPagamentoAgendado ? 'agendado' : 'parcial');
      await updateMutation.mutateAsync({
        id: rec.id, data: {
          valor_total: novoValorTotal,
          valor_pago: novoPago,
          status: statusFinal,
          historico_pagamentos: novoHistorico,
          data_pagamento_completo: isQuitado ? new Date().toISOString() : undefined,
          data_pagamento_agendado: dataPagamentoAgendado || undefined,
        },
      });
      // Atualizar snapshot para o modal com os valores já gravados
      recordsParaModal[i] = { ...rec, valor_total: novoValorTotal, valor_pago: novoPago, historico_pagamentos: novoHistorico, status: statusFinal };
    }

    if (desconto > 0.01) {
      toast.success(`✅ Pagamento registrado com desconto de ${formatCurrency(desconto)}!`);
    } else {
      toast.success('✅ Pagamento registrado!');
    }

    // Sincroniza com Financeiro: cria PagamentoTecnico se foi um tecnico que recebeu o
    // dinheiro direto do cliente. Reutiliza a funcao registrarPagamentoTecnico que ja
    // debita credito_pendente e atualiza credito_pago do TecnicoFinanceiro.
    if (tecnicoRecebeu && tecnicoRecebeu !== 'adm' && valor > 0.01) {
      const tec = tecnicosFinanceiros.find(t => t.tecnico_id === tecnicoRecebeu);
      const dataStr = format(new Date(), 'dd/MM/yyyy');
      const obsTec = `Recebido direto do cliente ${pag.cliente_nome || ''}` +
        (pag.telefone ? ` (Tel: ${pag.telefone})` : '') +
        ` em ${dataStr}` +
        (metodoPagamento ? ` via ${metodoPagamento}` : '') +
        `. Valor: ${formatCurrency(valor)}`;
      try {
        // Validacao defensiva — tecnico precisa existir no TecnicoFinanceiro
        if (!tec) {
          throw new Error(`Tecnico nao encontrado em TecnicoFinanceiro (id: ${tecnicoRecebeu}). Cadastre-o em Financeiro antes.`);
        }
        const response = await base44.functions.invoke('registrarPagamentoTecnico', {
          tecnico_id: tecnicoRecebeu,
          valor_pago: valor,
          data_pagamento: format(new Date(), 'yyyy-MM-dd'),
          metodo_pagamento: metodoPagamento || 'Outro',
          observacao: obsTec,
          lancamentos_id: [],
        });
        // base44 functions.invoke nao dispara throw em status >= 400 — checar manualmente
        const respData = response?.data || {};
        if (respData.error || respData.success === false) {
          throw new Error(respData.error || 'Erro desconhecido no backend');
        }
        // Forca refetch (refetchType: active garante que componentes ativos refazem a query)
        await queryClient.invalidateQueries({ queryKey: ['tecnicos'], refetchType: 'all' });
        await queryClient.invalidateQueries({ queryKey: ['pagamentos'], refetchType: 'all' });
        await queryClient.invalidateQueries({ queryKey: ['tecnicos-financeiro-pag'], refetchType: 'all' });
        toast.success(`💰 ${formatCurrency(valor)} creditado ao tecnico ${tec.tecnico_nome}`);
      } catch (err) {
        console.error('[PagamentosClientes] Falha ao creditar tecnico:', err);
        toast.error(`⚠ Pagamento do cliente OK, mas falhou ao creditar tecnico ${tec?.tecnico_nome || tecnicoRecebeu}: ${err?.message || 'tente novamente em Financeiro'}`, { duration: 8000 });
      }
    }

    // Montar pag atualizado para o PDF — usando os valores efetivamente gravados, não o snapshot antigo
    const totalPagoAtualizado = recordsParaModal.reduce((s, r) => s + (r.valor_pago || 0), 0);
    setCompartilharModal({
      ...pag,
      _records: recordsParaModal,
      valor_pago: totalPagoAtualizado,
      historico_pagamentos: recordsParaModal.flatMap(r => r.historico_pagamentos || []),
    });
  };

  const handleEditarValor = async (pag, novoValor) => {
    await updateMutation.mutateAsync({ id: pag.id, data: { valor_total: novoValor, status: 'pendente' } });
    toast.success('Valor atualizado! Status retornado para pendente.');
  };

  const handleAgendarData = async (pag, novaData) => {
    const records = pag._records?.length > 1 ? pag._records : [pag];
    for (const rec of records) {
      // Apenas agende se não estiver pago
      const saldo = calcularSaldo(rec.valor_total, rec.valor_pago);
      if (saldo > 0.01) {
        await updateMutation.mutateAsync({ id: rec.id, data: { data_pagamento_agendado: novaData, status: 'agendado' } });
      }
    }
    toast.success('📅 Data de pagamento agendada!');
  };

  // Forçar pagamento total (admin) — para casos onde valor_pago ficou ligeiramente abaixo de valor_total
  const handleMarcarPago = async (pag) => {
    const records = pag._records?.length > 0 ? pag._records : [pag];
    const agora = new Date().toISOString();
    const dataStr = format(new Date(), 'dd/MM/yyyy');
    try {
      for (const rec of records) {
        const saldoRec = calcularSaldo(rec.valor_total, rec.valor_pago);
        if (saldoRec <= 0.01) continue; // já pago, pular
        const novoHistorico = [
          ...(rec.historico_pagamentos || []),
          { valor: saldoRec, data: dataStr, observacao: '✅ Marcado como pago manualmente' },
        ];
        await updateMutation.mutateAsync({
          id: rec.id,
          data: {
            valor_pago: rec.valor_total,
            status: 'pago',
            historico_pagamentos: novoHistorico,
            data_pagamento_completo: agora,
          },
        });
      }
      toast.success('✅ Pagamento marcado como pago!');
    } catch {
      toast.error('Erro ao marcar como pago');
    }
  };

  const handleReverterPagamento = async (pag) => {
    const records = pag._records?.length > 0 ? pag._records : [pag];
    let reverteuAlgum = false;
    try {
      for (const rec of records) {
        const hist = rec.historico_pagamentos || [];
        // Encontra índice do ÚLTIMO pagamento real (sem flag agendada nem consolidado)
        const ultimoIdx = [...hist].map((h, i) => ({ h, i }))
          .reverse()
          .find(({ h }) => !h.agendada && !h.consolidado)?.i;
        if (ultimoIdx === undefined) continue;

        const entrada = hist[ultimoIdx];
        const novoHistorico = hist.filter((_, i) => i !== ultimoIdx);
        const novoValorPago = Math.max(0, (rec.valor_pago || 0) - (entrada.valor || 0));
        const saldoRestante = (rec.valor_total || 0) - novoValorPago;

        let novoStatus;
        if (novoValorPago <= 0.01) {
          novoStatus = rec.data_pagamento_agendado ? 'agendado' : 'pendente';
        } else if (saldoRestante <= 0.01) {
          novoStatus = 'pago';
        } else {
          novoStatus = rec.data_pagamento_agendado ? 'agendado' : 'parcial';
        }

        await updateMutation.mutateAsync({
          id: rec.id,
          data: {
            valor_pago: novoValorPago,
            status: novoStatus,
            historico_pagamentos: novoHistorico,
            data_pagamento_completo: novoStatus === 'pago' ? rec.data_pagamento_completo : null,
          },
        });
        reverteuAlgum = true;
      }
      if (reverteuAlgum) toast.success('↩ Pagamento revertido!');
      else toast.error('Nenhum pagamento encontrado para reverter.');
    } catch {
      toast.error('Erro ao reverter pagamento');
    }
  };

  const handleArquivarAntigos = async () => {
    const candidatos = pagamentos.filter(p =>
      !p.arquivado &&
      isEfetivamentePago(p) &&
      isDeSemanasAnteriores(p)
    );
    if (candidatos.length === 0) { toast.info('Nenhum pagamento anterior para arquivar.'); return; }
    if (!confirm(`Arquivar ${candidatos.length} registro(s) de semanas anteriores?\n\nEles ficarão na aba "Arquivo" e poderão ser restaurados.`)) return;
    try {
      for (const p of candidatos) {
        await updateMutation.mutateAsync({ id: p.id, data: { arquivado: true } });
      }
      toast.success(`✅ ${candidatos.length} registros arquivados!`);
    } catch {
      toast.error('Erro ao arquivar registros');
    }
  };

  const handleDesarquivar = async (pag) => {
    const records = pag._records?.length > 0 ? pag._records : [pag];
    try {
      for (const rec of records) {
        await updateMutation.mutateAsync({ id: rec.id, data: { arquivado: false } });
      }
      toast.success('↩ Registro restaurado!');
    } catch {
      toast.error('Erro ao restaurar registro');
    }
  };

  const pagsFiltrados = useMemo(() =>
    pagamentos.filter(p =>
      p.arquivado !== true &&
      matchClienteSearch(p.cliente_nome, p.telefone, debouncedSearch) &&
      !isApenasTiposIgnorados(p.tipo_servico)
    )
  , [pagamentos, debouncedSearch]);

  // Helper: verifica se algum pagamento real foi feito nesta semana
  const temPagamentoNaSemana = useCallback((p) => {
    return (p.historico_pagamentos || [])
      .filter(h => !h.agendada && !h.consolidado)
      .some(h => {
        const d = parseHistoricoData(h.data);
        if (!d) return false;
        try { return isWithinInterval(d, { start: inicioSemana, end: fimSemana }); }
        catch { return false; }
      });
  }, [inicioSemana, fimSemana]);

  // 1. Serviços da semana atual (todos, incluindo pagos — somem na virada)
  const pagsSemana = useMemo(() => {
    const statusOrder = { 'pendente': 0, 'agendado': 1, 'parcial': 2, 'pago': 3 };
    const filtrados = pagsFiltrados
      .filter(p => {
        // Serviço concluído esta semana
        if (p.data_conclusao) {
          try {
            if (isWithinInterval(parseISO(p.data_conclusao), { start: inicioSemana, end: fimSemana })) return true;
          } catch {}
        }
        // Ou: pagamento atrasado que foi recebido esta semana
        return temPagamentoNaSemana(p);
      });
    const agrupados = groupPagamentos(filtrados);
    return agrupados
      .filter(g => filtroStatus.length === 0 || filtroStatus.includes(g.status))
      .sort((a, b) => {
        const aTemPreco = a.valor_total > 0;
        const bTemPreco = b.valor_total > 0;
        if (aTemPreco !== bTemPreco) return aTemPreco ? 1 : -1;
        return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
      });
  }, [pagsFiltrados, inicioSemana, fimSemana, temPagamentoNaSemana, filtroStatus]);

  // 2. PENDÊNCIAS: apenas itens de semanas ANTERIORES com saldo em aberto
  //    Exclui os que receberam pagamento esta semana
  const pagsPendencias = useMemo(() => {
    const filtrados = pagsFiltrados
      .filter(p => {
        if (p.status === 'pago') return false;
        // Se recebeu pagamento esta semana → aparece na aba semana, não aqui
        if (temPagamentoNaSemana(p)) return false;
        if (p.data_conclusao) {
          try {
            if (isWithinInterval(parseISO(p.data_conclusao), { start: inicioSemana, end: fimSemana })) return false;
          } catch {}
        }
        const saldo = (p.valor_total || 0) - (p.valor_pago || 0);
        const valorPago = p.valor_pago || 0;
        // Pagamentos com valor placeholder (R$ 1,00) sem pagamento DEVEM aparecer
        // como pendentes para o ADM precificar. Nao remover.
        // Excluir apenas se "pago por tolerancia" (saldo <= R$1 com algum pagamento feito)
        if (valorPago > 0 && saldo <= 1.0) return false;
        // Mostrar: saldo real > R$0,01 OU servico sem preco definido (valor_total = 0)
        return saldo > 0.01 || !p.valor_total;
      })
      .sort((a, b) => {
        const prioridade = { agendado: 0, parcial: 1, pendente: 2 };
        const pa = prioridade[a.status] ?? 3;
        const pb = prioridade[b.status] ?? 3;
        if (pa !== pb) return pa - pb;
        const da = a.data_pagamento_agendado ? new Date(a.data_pagamento_agendado) : (a.data_conclusao ? new Date(a.data_conclusao) : new Date(0));
        const db = b.data_pagamento_agendado ? new Date(b.data_pagamento_agendado) : (b.data_conclusao ? new Date(b.data_conclusao) : new Date(0));
        return da - db;
      });
    return groupPagamentos(filtrados)
      .filter(g => filtroStatus.length === 0 || filtroStatus.includes(g.status));
  }, [pagsFiltrados, inicioSemana, fimSemana, temPagamentoNaSemana, filtroStatus]);

  const pagsArquivados = useMemo(() =>
    pagamentos
      .filter(p => p.arquivado === true && !p.excluido_manual)
      .sort((a, b) => new Date(b.data_conclusao || 0) - new Date(a.data_conclusao || 0)),
  [pagamentos]);

  const pagsRelatorio = useMemo(() => {
    let inicio, fim;
    if (relFiltro === 'semana') { inicio = inicioSemana; fim = fimSemana; }
    else if (relFiltro === 'mes') { inicio = startOfMonth(hoje); fim = endOfMonth(hoje); }
    else if (relFiltro === 'personalizado' && relDataInicio && relDataFim) {
      inicio = new Date(relDataInicio); fim = new Date(relDataFim + 'T23:59:59');
    }
    return pagamentos.filter(p => {
      const matchCliente = matchClienteSearch(p.cliente_nome, p.telefone, relCliente);
      let matchData = true;
      if (inicio && fim && p.data_conclusao) {
        try { matchData = isWithinInterval(parseISO(p.data_conclusao), { start: inicio, end: fim }); }
        catch { matchData = false; }
      }
      return matchCliente && matchData;
    });
  }, [pagamentos, relFiltro, relDataInicio, relDataFim, relCliente, inicioSemana, fimSemana]);

  const totalSemana = pagsSemana.reduce((s, p) => s + (p.valor_total || 0), 0);
  const totalPendencias = pagsPendencias.reduce((s, p) => s + Math.max(0, (p.valor_total || 0) - (p.valor_pago || 0)), 0);

  // Auto-abrir o modal "Definir Preços" quando vier via Dashboard com ?highlight=sempreco.
  // Procura o primeiro grupo (semana ou pendencias) que tenha algum record com
  // valor_total <= 1 (placeholder de precificacao pendente).
  useEffect(() => {
    if (!isAdmin) return;
    const params = new URLSearchParams(location.search);
    if (params.get('highlight') !== 'sempreco') return;
    if (isLoading) return; // espera carregar pagamentos
    if (precosModal) return; // ja esta aberto

    const temPlaceholder = (g) => {
      const records = (g._records && g._records.length > 0) ? g._records : [g];
      return records.some(r => (r.valor_total || 0) <= 1.0);
    };
    const todos = [...pagsSemana, ...pagsPendencias];
    const alvo = todos.find(temPlaceholder);
    if (alvo) {
      setPrecosModal(enriquecerTipoServico(alvo));
    } else {
      toast.info('Nenhum servico aguardando precificacao no momento.');
    }
    // Limpa o query param para nao reabrir ao re-renderizar
    navigate(location.pathname, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, location.search]);


  // Recebido na semana: soma via historico_pagamentos (data real do recebimento)
  // Fallback: se o registro tem valor_pago mas historico vazio, usa updated_date ou data_pagamento_completo
  const totalPagoSemana = useMemo(() => {
    const isNaSemana = (d) => {
      try { return d && isWithinInterval(d, { start: inicioSemana, end: fimSemana }); }
      catch { return false; }
    };

    let total = 0;
    const contabilizados = new Set(); // evita double-count

    pagamentos.forEach(p => {
      const hist = (p.historico_pagamentos || []).filter(h => !h.agendada && !h.consolidado);
      if (hist.length > 0) {
        // Método primário: somar entradas do histórico que caem na semana
        hist.forEach(h => {
          const d = parseHistoricoData(h.data);
          if (isNaSemana(d)) total += h.valor || 0;
        });
      } else if ((p.valor_pago || 0) > 0) {
        // Fallback: sem histórico, verifica se a data do pagamento completo ou updated_date está na semana
        const dataRef = p.data_pagamento_completo || p.updated_date;
        let d = null;
        try { d = dataRef ? parseISO(dataRef) : null; } catch {}
        if (isNaSemana(d) && !contabilizados.has(p.id)) {
          total += p.valor_pago || 0;
          contabilizados.add(p.id);
        }
      }
    });
    return total;
  }, [pagamentos, inicioSemana, fimSemana]);


  const inicioMes = startOfMonth(hoje);
  const fimMes = endOfMonth(hoje);
  const pagsMes = useMemo(() => pagamentos.filter(p => {
    if (!p.data_conclusao) return false;
    try { return isWithinInterval(parseISO(p.data_conclusao), { start: inicioMes, end: fimMes }); }
    catch { return false; }
  }), [pagamentos, inicioMes, fimMes]);
  const totalMes = pagsMes.reduce((s, p) => s + (p.valor_total || 0), 0);
  const totalPagoMes = pagsMes.reduce((s, p) => s + (p.valor_pago || 0), 0);

  // Mes anterior — para comparativo
  const inicioMesAnterior = startOfMonth(subMonths(hoje, 1));
  const fimMesAnterior = endOfMonth(subMonths(hoje, 1));
  const pagsMesAnterior = useMemo(() => pagamentos.filter(p => {
    if (!p.data_conclusao) return false;
    try { return isWithinInterval(parseISO(p.data_conclusao), { start: inicioMesAnterior, end: fimMesAnterior }); }
    catch { return false; }
  }), [pagamentos, inicioMesAnterior, fimMesAnterior]);
  const totalMesAnterior = pagsMesAnterior.reduce((s, p) => s + (p.valor_total || 0), 0);
  const totalPagoMesAnterior = pagsMesAnterior.reduce((s, p) => s + (p.valor_pago || 0), 0);
  const totalRel = pagsRelatorio.reduce((s, p) => s + (p.valor_total || 0), 0);
  const totalPagoRel = pagsRelatorio.reduce((s, p) => s + (p.valor_pago || 0), 0);

  const abas = [
    { key: 'semana', label: 'Semana Atual', count: pagsSemana.length + pagsPendencias.length },
    { key: 'arquivo', label: '📦 Arquivo', count: pagsArquivados.length > 0 ? pagsArquivados.length : null },
    { key: 'relatorio', label: 'Histórico / Relatórios', count: null },
  ];



  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h1>
          <p className="text-gray-500">Esta página é restrita a administradores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header com resumo */}
      <div className="rounded-2xl p-4 sm:p-5" style={{ backgroundColor: '#1e3a8a' }}>
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-white">Pagamentos dos Clientes</h1>
            <p className="text-blue-200/80 text-xs sm:text-sm mt-1 flex items-center gap-1.5 flex-wrap">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Semana: {format(inicioSemana, "dd/MM", { locale: ptBR })} – {format(fimSemana, "dd/MM/yyyy", { locale: ptBR })}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <div className="bg-white/10 rounded-lg px-2 sm:px-3 py-2 text-center">
              <p className="text-white font-bold text-sm sm:text-lg">{formatCurrency(totalMes).replace('R$', '').trim()}</p>
              <p className="text-blue-200 text-xs">Faturado Mês</p>
            </div>
            <div className="bg-green-500/20 rounded-lg px-2 sm:px-3 py-2 text-center">
              <p className="text-green-300 font-bold text-sm sm:text-lg">{formatCurrency(totalPagoMes).replace('R$', '').trim()}</p>
              <p className="text-blue-200 text-xs">Recebido Mês</p>
            </div>
            <div className="bg-white/10 rounded-lg px-2 sm:px-3 py-2 text-center">
              <p className="text-white font-bold text-sm sm:text-lg">{formatCurrency(totalSemana).replace('R$', '').trim()}</p>
              <p className="text-blue-200 text-xs">Faturado Sem.</p>
            </div>
            <div className="bg-green-500/20 rounded-lg px-2 sm:px-3 py-2 text-center">
              <p className="text-green-300 font-bold text-sm sm:text-lg">{formatCurrency(totalPagoSemana).replace('R$', '').trim()}</p>
              <p className="text-blue-200 text-xs">Recebido Sem.</p>
            </div>
            {/* Comparativo do mes anterior */}
            <div className="bg-white/5 rounded-lg px-2 sm:px-3 py-2 text-center border border-white/10">
              <p className="text-gray-200 font-bold text-sm sm:text-lg">{formatCurrency(totalMesAnterior).replace('R$', '').trim()}</p>
              <p className="text-blue-300/80 text-[10px] sm:text-xs">Faturado Mês Ant.</p>
            </div>
            <div className="bg-emerald-500/10 rounded-lg px-2 sm:px-3 py-2 text-center border border-emerald-500/20">
              <p className="text-emerald-200 font-bold text-sm sm:text-lg">{formatCurrency(totalPagoMesAnterior).replace('R$', '').trim()}</p>
              <p className="text-blue-300/80 text-[10px] sm:text-xs">Recebido Mês Ant.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Busca + Abas */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-10 bg-white border-gray-200 w-full" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400" /></button>}
        </div>
        <div className="flex flex-wrap gap-2 items-center justify-between">
          {/* Filtros de status — controlam a visualização */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-semibold text-gray-500 mr-1">Filtrar:</span>
            {[
              { key: 'pendente', label: 'Pendentes', color: 'text-red-700 bg-red-50 border-red-200' },
              { key: 'parcial',  label: 'Parcial',   color: 'text-amber-700 bg-amber-50 border-amber-200' },
              { key: 'agendado', label: 'Agendados', color: 'text-purple-700 bg-purple-50 border-purple-200' },
              { key: 'pago',     label: 'Pagos',     color: 'text-green-700 bg-green-50 border-green-200' },
            ].map(({ key, label, color }) => {
              const ativo = filtroStatus.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFiltroStatus(key)}
                  className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-semibold transition-all ${ativo ? color : 'text-gray-400 bg-white border-gray-200 hover:border-gray-300'}`}
                >
                  <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    ativo ? 'border-current bg-current' : 'border-gray-300'
                  }`}>
                    {ativo && <X className="w-2 h-2 text-white" />}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
          {/* Botões de exportação agrupados */}
          <div className="flex gap-2">
            {isAdmin && (
              <Button onClick={() => setAbrirRelatorio(true)} variant="outline" className="gap-1.5 h-8 text-xs px-3">
                📄 PDF
              </Button>
            )}
            {isAdmin && (
              <BotaoGerarRelatorioCobranca className="h-8 text-xs px-3" />
            )}
            <Button onClick={handleExportarExcel} disabled={filtroStatus.length === 0} className="gap-1.5 h-8 text-xs px-3 rounded-lg" style={{ backgroundColor: '#22c55e', color: '#fff' }}>
              📅 Excel
            </Button>
          </div>
        </div>
        <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          {abas.map(a => (
            <button key={a.key} onClick={() => setAbaAtiva(a.key)}
              className={`flex-1 px-2 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-colors ${abaAtiva === a.key ? 'text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              style={abaAtiva === a.key ? { backgroundColor: '#1e3a8a' } : {}}>
              <span className="truncate">{a.label}</span>
              {a.count !== null && (
                <span className={`text-xs px-1 sm:px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${abaAtiva === a.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {a.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Aba: Semana Atual */}
      {abaAtiva === 'semana' && (
        <div className="space-y-5">
          {/* SEÇÃO 1: TODOS os serviços da semana */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600" />
                Serviços da Semana
              </h2>
              <span className="text-sm font-semibold text-blue-600">{pagsSemana.length} serviços</span>
            </div>
            <TabelaPagamentos
              lista={pagsSemana}
              onPagar={setPagarModal}
              onDefinirPreco={(p) => setPrecosModal(enriquecerTipoServico(p))}
              onEditarValor={setEditarModal}
              onHistorico={setHistoricoModal}
              onDetalhes={setDetalhesModal}
              onAgendarData={setAgendarDataModal}
              onDelete={handleDelete}
              onMarcarPago={handleMarcarPago}
              onReverterPagamento={handleReverterPagamento}
              alertasDinheiro={alertasDinheiro}
              onDismissAlerta={handleDismissAlerta}
              emptyMsg="Nenhum serviço nesta semana"
            />
          </div>

          {/* SEÇÃO 2: Pendências unificadas (atrasados + agendados + parciais + sem preço) */}
          {pagsPendencias.length > 0 && (
            <div
              ref={secaoSemPrecoRef}
              className="space-y-3 rounded-2xl p-3 transition-all"
              style={highlightSecao === 'sempreco' || highlightSecao === 'cobrar'
                ? { background: 'rgba(251,191,36,0.15)', border: '2px solid rgba(251,191,36,0.5)' }
                : { background: 'rgba(234,88,12,0.12)', border: '1px solid rgba(234,88,12,0.3)' }
              }
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-bold text-orange-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-400" />
                  Pendências (Atrasados, Agendados, Parciais)
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-orange-300 font-semibold">{formatCurrency(totalPendencias)} a receber</span>
                  <span className="text-sm font-semibold text-orange-300">{pagsPendencias.length} itens</span>
                </div>
              </div>
              <TabelaPagamentos
                lista={pagsPendencias}
                onPagar={setPagarModal}
                onDefinirPreco={(p) => setPrecosModal(enriquecerTipoServico(p))}
                onEditarValor={setEditarModal}
                onHistorico={setHistoricoModal}
                onDetalhes={setDetalhesModal}
                onAgendarData={setAgendarDataModal}
                onDelete={handleDelete}
                onMarcarPago={handleMarcarPago}
                onReverterPagamento={handleReverterPagamento}
                alertasDinheiro={alertasDinheiro}
                onDismissAlerta={handleDismissAlerta}
                emptyMsg="Nenhuma pendência encontrada"
              />
            </div>
          )}


        </div>
      )}

      {/* Aba: Arquivo */}
      {abaAtiva === 'arquivo' && (
        <div className="space-y-4">
          {/* Cabeçalho do arquivo */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Archive className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-800">Registros Arquivados</h2>
                  <p className="text-xs text-gray-500">Pagamentos concluídos de semanas anteriores</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{pagsArquivados.length} registros</span>
                {isAdmin && (
                  <Button
                    onClick={handleArquivarAntigos}
                    variant="outline"
                    className="gap-1.5 h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Arquivar pagos anteriores
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 border-t pt-3">
              Arquivar remove os registros das listas principais e do alerta do Dashboard. Use "Restaurar" para trazer de volta quando necessário.
            </p>
          </div>

          {/* Lista de arquivados */}
          {pagsArquivados.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
              <Archive className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum registro arquivado</p>
              <p className="text-xs text-gray-400 mt-1">Clique em "Arquivar pagos anteriores" para organizar o sistema</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pagsArquivados.map(p => {
                const dataConc = p.data_conclusao ? format(parseISO(p.data_conclusao), 'dd/MM/yyyy', { locale: ptBR }) : '—';
                const dataPag = p.data_pagamento_completo ? format(parseISO(p.data_pagamento_completo), 'dd/MM/yyyy', { locale: ptBR }) : null;
                return (
                  <div key={p.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{p.cliente_nome}</p>
                        <p className="text-xs text-gray-400 truncate">{formatTipoServicoCompact(p.tipo_servico)} · Concluído {dataConc}{dataPag ? ` · Pago ${dataPag}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-bold text-green-600">{formatCurrency(p.valor_total)}</span>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            if (confirm(`Restaurar "${p.cliente_nome}" para a lista principal?`))
                              handleDesarquivar(p);
                          }}
                          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
                          title="Restaurar registro"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                          Restaurar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Aba: Relatórios */}
      {abaAtiva === 'relatorio' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-gray-700 font-semibold mb-3">
              <Filter className="w-4 h-4 text-blue-600" /> Filtros
            </div>
            <div className="flex flex-col gap-3">
              <Select value={relFiltro} onValueChange={setRelFiltro}>
                <SelectTrigger className="h-10 bg-white w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Semana Atual</SelectItem>
                  <SelectItem value="mes">Mês Atual</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Filtrar cliente..." value={relCliente} onChange={e => setRelCliente(e.target.value)} className="pl-9 h-10 bg-white w-full" />
              </div>
            </div>
            {relFiltro === 'personalizado' && (
              <div className="flex flex-col gap-3 mt-3">
                <div><label className="text-xs text-gray-500 mb-1 block">Data início</label><Input type="date" value={relDataInicio} onChange={e => setRelDataInicio(e.target.value)} className="h-10 w-full" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Data fim</label><Input type="date" value={relDataFim} onChange={e => setRelDataFim(e.target.value)} className="h-10 w-full" /></div>
              </div>
            )}
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Faturado', value: totalRel, color: 'border-gray-200 bg-white text-gray-800' },
              { label: 'Recebido', value: totalPagoRel, color: 'border-green-200 bg-green-50 text-green-700' },
              { label: 'Débito', value: totalRel - totalPagoRel, color: 'border-red-200 bg-red-50 text-red-700' },
            ].map(item => (
              <div key={item.label} className={`rounded-lg border p-3 text-center ${item.color}`}>
                <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                <p className="font-bold text-sm">{formatCurrency(item.value)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pagsRelatorio.length} reg</p>
              </div>
            ))}
          </div>

          <TabelaPagamentos
            lista={pagsRelatorio}
            onPagar={setPagarModal}
            onDefinirPreco={(p) => setPrecosModal(enriquecerTipoServico(p))}
            onEditarValor={setEditarModal}
            onHistorico={setHistoricoModal}
            onDetalhes={setDetalhesModal}
            onAgendarData={setAgendarDataModal}
            onDelete={handleDelete}
            onReverterPagamento={handleReverterPagamento}
            emptyMsg="Nenhum registro no período selecionado"
          />
        </div>
      )}

      <DefinirPrecoModal open={!!precosModal} onClose={() => setPrecosModal(null)} pagamento={precosModal} pagamentosAtuais={pagamentos} onSave={handleSalvarPrecos} />
      <PagamentoModal open={!!pagarModal} onClose={() => setPagarModal(null)} pagamento={pagarModal} onSave={handleRegistrarPagamento} pagamentosAtuais={pagamentos} syncKey={precosSyncKey} tecnicos={tecnicosFinanceiros} />
      <AgendarDataModal open={!!agendarDataModal} onClose={() => setAgendarDataModal(null)} pagamento={agendarDataModal} onSave={handleAgendarData} />
      <EditarValorModal open={!!editarModal} onClose={() => setEditarModal(null)} pagamento={editarModal} onSave={handleEditarValor} />
      <HistoricoModal open={!!historicoModal} onClose={() => setHistoricoModal(null)} pagamento={historicoModal} />
      <DetalhesClienteModal open={!!detalhesModal} onClose={() => setDetalhesModal(null)} pagamento={detalhesModal} />
      <RelatorioClientesPagamentoModal isOpen={abrirRelatorio} onClose={() => setAbrirRelatorio(false)} pagamentos={pagamentos} servicos={servicosConcluidos} />
      <CompromissoClientePDF isOpen={!!compartilharModal} onClose={() => setCompartilharModal(null)} pagamento={compartilharModal} />
    </div>
  );
}