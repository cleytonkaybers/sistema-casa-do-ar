import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, DollarSign, TrendingUp, Calendar, Filter, Trophy, Users, Plus, Trash2, Calculator, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { calcularTotalComissoes, agruparPorPeriodo } from '@/lib/utils/calculations';
import { TableSkeleton, CardSkeleton } from '@/components/LoadingSkeleton';
import ConfirmDialog from '@/components/ConfirmDialog';
import { usePermissions } from '@/components/auth/PermissionGuard';
import NoPermission from '@/components/NoPermission';
import { useNavigate } from 'react-router-dom';
import { getStartOfWeek, getEndOfWeek, getLocalDate, toLocalDate, formatDate } from '@/lib/dateUtils';
import { subWeeks, format, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatTipoServicoCompact } from '@/utils';
import { calcularComissao, calcularComissaoSync } from '@/lib/comissao';

const inputDark = 'bg-[#1e2d3d] border-[#2d3f55] text-gray-100 placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500/20 h-10 px-3 rounded-md border w-full text-sm';
const selectDark = 'bg-[#1e2d3d] border border-[#2d3f55] text-gray-100 h-10 px-3 rounded-md w-full text-sm focus:outline-none focus:border-blue-500';

const NUM_SEMANAS = 10;
const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// ─── Gerador de PDF (HTML → window.print) ─────────────────────────────────
async function gerarPDF({ lancamentosFiltrados, totais, ganhosSemanais, equipesNomes, totaisPorEquipe, porMes, dataInicio, dataFim }) {
  const { bannerHtmlImg, getBannerUrl } = await import('@/lib/pdfBanner');
  const bannerUrl = await getBannerUrl();
  const bannerTag = bannerHtmlImg(bannerUrl);

  const agora = format(getLocalDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const periodo = dataInicio && dataFim
    ? `${formatDate(dataInicio)} a ${formatDate(dataFim)}`
    : dataInicio ? `A partir de ${formatDate(dataInicio)}`
    : dataFim   ? `Até ${formatDate(dataFim)}`
    : 'Todo o período';

  // Agrupa lançamentos por técnico
  const porTecnico = {};
  lancamentosFiltrados.forEach(l => {
    const key = l.tecnico_id || l.tecnico_nome || 'Sem técnico';
    if (!porTecnico[key]) porTecnico[key] = { nome: l.tecnico_nome || 'Sem técnico', equipe: l.equipe_nome || '—', itens: [] };
    porTecnico[key].itens.push(l);
  });

  const statusBadge = (s) => {
    const map = { pago: '#16a34a', creditado: '#2563eb', pendente: '#d97706' };
    return `<span style="background:${map[s] || '#6b7280'}22;color:${map[s] || '#6b7280'};border:1px solid ${map[s] || '#6b7280'}44;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">${s}</span>`;
  };

  // Seção de cada técnico
  const tecnicosSections = Object.values(porTecnico).map(tec => {
    const totalTec = tec.itens.reduce((s, l) => s + (l.valor_comissao_tecnico || 0), 0);
    const pendenteTec = tec.itens.filter(l => l.status === 'pendente').reduce((s, l) => s + (l.valor_comissao_tecnico || 0), 0);
    const pagoTec = tec.itens.filter(l => l.status === 'pago').reduce((s, l) => s + (l.valor_comissao_tecnico || 0), 0);

    const linhas = tec.itens.map((l, i) => `
      <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'}">
        <td style="padding:7px 10px;font-size:12px;color:#374151;white-space:nowrap">${formatDate(l.data_geracao)}</td>
        <td style="padding:7px 10px;font-size:12px;color:#111827;font-weight:500">${l.cliente_nome || '—'}</td>
        <td style="padding:7px 10px;font-size:11px;color:#6b7280;max-width:160px">${l.tipo_servico || '—'}</td>
        <td style="padding:7px 10px;font-size:12px;color:#111827;text-align:right;white-space:nowrap">${fmt(l.valor_total_servico)}</td>
        <td style="padding:7px 10px;font-size:12px;font-weight:700;color:#16a34a;text-align:right;white-space:nowrap">${fmt(l.valor_comissao_tecnico)}</td>
        <td style="padding:7px 10px;text-align:center">${statusBadge(l.status)}</td>
      </tr>`).join('');

    return `
    <div style="page-break-inside:avoid;margin-bottom:28px">
      <!-- Cabeçalho do técnico -->
      <div style="display:flex;align-items:center;justify-content:space-between;background:#1e3a5f;color:#fff;padding:10px 16px;border-radius:8px 8px 0 0">
        <div>
          <div style="font-size:15px;font-weight:700">${tec.nome}</div>
          <div style="font-size:11px;color:#93c5fd;margin-top:2px">Equipe: ${tec.equipe} &nbsp;·&nbsp; ${tec.itens.length} lançamento${tec.itens.length !== 1 ? 's' : ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:800;color:#86efac">${fmt(totalTec)}</div>
          <div style="font-size:10px;color:#93c5fd;margin-top:2px">Pago: ${fmt(pagoTec)} &nbsp;|&nbsp; Pendente: ${fmt(pendenteTec)}</div>
        </div>
      </div>
      <!-- Tabela de serviços -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px 10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:left;white-space:nowrap">Data</th>
            <th style="padding:8px 10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:left">Cliente</th>
            <th style="padding:8px 10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:left">Serviço</th>
            <th style="padding:8px 10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:right">Valor Total</th>
            <th style="padding:8px 10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:right">Comissão</th>
            <th style="padding:8px 10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:center">Status</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
        <tfoot>
          <tr style="background:#f0fdf4;border-top:2px solid #bbf7d0">
            <td colspan="4" style="padding:10px 10px;font-size:12px;font-weight:700;color:#15803d">TOTAL DO TÉCNICO</td>
            <td style="padding:10px 10px;font-size:14px;font-weight:800;color:#15803d;text-align:right">${fmt(totalTec)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  }).join('');

  // Tabela semanal por equipe
  const semanaisHeader = equipesNomes.map(n => `<th style="padding:8px 12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:right">${n}</th>`).join('');
  const semanaisLinhas = ganhosSemanais.map((sem, i) => {
    const melhor = equipesNomes.reduce((b, n) => sem.porEquipe[n] > (sem.porEquipe[b] || 0) ? n : b, equipesNomes[0]);
    const cols = equipesNomes.map(n => {
      const v = sem.porEquipe[n] || 0;
      const isBest = v > 0 && n === melhor && equipesNomes.length > 1;
      return `<td style="padding:7px 12px;text-align:right;font-size:12px;font-weight:${isBest ? '700' : '500'};color:${v === 0 ? '#d1d5db' : isBest ? '#15803d' : '#374151'}">${v === 0 ? '—' : fmt(v)}${isBest && v > 0 ? ' ↑' : ''}</td>`;
    }).join('');
    return `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'}">
      <td style="padding:7px 12px;font-size:12px;color:#374151;font-weight:500;white-space:nowrap">${sem.label}</td>
      ${cols}
      <td style="padding:7px 12px;text-align:right;font-size:12px;font-weight:700;color:${sem.total === 0 ? '#d1d5db' : '#1e40af'}">${sem.total === 0 ? '—' : fmt(sem.total)}</td>
    </tr>`;
  }).join('');
  const rodapeEquipes = equipesNomes.map(n => `<td style="padding:9px 12px;text-align:right;font-size:12px;font-weight:700;color:#b45309">${fmt(totaisPorEquipe.porEquipe[n] || 0)}</td>`).join('');

  // Resumo mensal
  const resumoMensalLinhas = Object.entries(porMes).map(([mes, items], i) => {
    const t = calcularTotalComissoes(items);
    return `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td style="padding:8px 14px;font-size:13px;font-weight:600;color:#111827">${mes}</td>
      <td style="padding:8px 14px;font-size:12px;color:#6b7280;text-align:center">${items.length} lançamentos</td>
      <td style="padding:8px 14px;font-size:13px;font-weight:700;color:#1e40af;text-align:right">${fmt(t.total)}</td>
      <td style="padding:8px 14px;font-size:12px;color:#d97706;text-align:right">${fmt(t.pendente)}</td>
      <td style="padding:8px 14px;font-size:12px;color:#16a34a;text-align:right">${fmt(t.pago)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório de Comissões — Casa do Ar</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111827; font-size: 13px; }
    @page { size: A4; margin: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      .content-wrapper { padding: 14mm 14mm 18mm !important; }
    }
    .btn-print { background:#1e3a5f;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:24px;display:flex;align-items:center;gap:8px }
    .btn-print:hover { background:#1e40af }
    h2 { font-size: 15px; font-weight: 700; color: #1e3a5f; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; display:flex;align-items:center;gap:8px }
    .section { margin-bottom: 32px; }
  </style>
</head>
<body style="padding:0;margin:0">

  <!-- Botão imprimir (desaparece no PDF) -->
  <div class="no-print" style="padding:16px 24px 0">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar como PDF</button>
  </div>

  <!-- ══ BANNER DA EMPRESA — full bleed, sem padding ══ -->
  ${bannerTag}

  <div class="content-wrapper" style="padding:20px 24px 24px">

  <!-- ══ CABEÇALHO ══ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #1e3a5f">
    <div>
      <div style="font-size:22px;font-weight:800;color:#1e3a5f;letter-spacing:-.5px">Casa do Ar Climatização</div>
      <div style="font-size:17px;font-weight:700;color:#374151;margin-top:4px">Relatório de Comissões</div>
      <div style="font-size:12px;color:#6b7280;margin-top:6px">Período: <strong>${periodo}</strong></div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#9ca3af">Gerado em</div>
      <div style="font-size:12px;font-weight:600;color:#374151">${agora}</div>
      <div style="font-size:11px;color:#9ca3af;margin-top:6px">${lancamentosFiltrados.length} lançamentos</div>
    </div>
  </div>

  <!-- ══ RESUMO GERAL ══ -->
  <div class="section">
    <h2>📊 Resumo Geral</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:4px">
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:8px;padding:14px 16px">
        <div style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.5px">Total Gerado</div>
        <div style="font-size:22px;font-weight:800;color:#1e40af;margin-top:4px">${fmt(totais.total)}</div>
        <div style="font-size:11px;color:#93c5fd;margin-top:2px">${lancamentosFiltrados.length} lançamentos</div>
      </div>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #d97706;border-radius:8px;padding:14px 16px">
        <div style="font-size:11px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.5px">Pendente</div>
        <div style="font-size:22px;font-weight:800;color:#92400e;margin-top:4px">${fmt(totais.pendente)}</div>
        <div style="font-size:11px;color:#fcd34d;margin-top:2px">${lancamentosFiltrados.filter(l=>l.status==='pendente').length} aguardando</div>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:8px;padding:14px 16px">
        <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.5px">Pago</div>
        <div style="font-size:22px;font-weight:800;color:#15803d;margin-top:4px">${fmt(totais.pago)}</div>
        <div style="font-size:11px;color:#86efac;margin-top:2px">${lancamentosFiltrados.filter(l=>l.status==='pago').length} liquidados</div>
      </div>
    </div>
  </div>

  <!-- ══ GANHOS SEMANAIS POR EQUIPE ══ -->
  ${equipesNomes.length > 0 ? `
  <div class="section">
    <h2>🏆 Ganhos Semanais por Equipe <span style="font-size:11px;font-weight:400;color:#9ca3af">(últimas ${NUM_SEMANAS} semanas)</span></h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f3f4f6">
          <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:left">Semana</th>
          ${semanaisHeader}
          <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${semanaisLinhas}</tbody>
      <tfoot>
        <tr style="background:#fefce8;border-top:2px solid #fde68a">
          <td style="padding:9px 12px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.5px">Total período</td>
          ${rodapeEquipes}
          <td style="padding:9px 12px;text-align:right;font-size:13px;font-weight:800;color:#1e40af">${fmt(totaisPorEquipe.total)}</td>
        </tr>
      </tfoot>
    </table>
  </div>` : ''}

  <!-- ══ RESUMO MENSAL ══ -->
  <div class="section">
    <h2>📅 Resumo Mensal</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f3f4f6">
          <th style="padding:8px 14px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:left">Mês</th>
          <th style="padding:8px 14px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:center">Lançamentos</th>
          <th style="padding:8px 14px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:right">Total</th>
          <th style="padding:8px 14px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:right">Pendente</th>
          <th style="padding:8px 14px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:right">Pago</th>
        </tr>
      </thead>
      <tbody>${resumoMensalLinhas}</tbody>
    </table>
  </div>

  <!-- ══ COMISSÕES POR TÉCNICO ══ -->
  <div class="section page-break">
    <h2>👷 Comissões por Técnico</h2>
    ${tecnicosSections || '<p style="color:#9ca3af;text-align:center;padding:20px">Nenhum lançamento encontrado.</p>'}
  </div>

  <!-- ══ RODAPÉ ══ -->
  <div style="margin-top:40px;padding-top:14px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af">
    <span>Casa do Ar Climatização — Relatório de Comissões</span>
    <span>Gerado em ${agora}</span>
  </div>

  </div><!-- fim do wrapper com padding -->
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(html);
  win.document.close();
  win.focus();
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function RelatorioComissoes() {
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tecnicoFiltro, setTecnicoFiltro] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modoLanc, setModoLanc] = useState('equipe'); // 'equipe' | 'tecnico'
  const [novoLanc, setNovoLanc] = useState({ equipe_id: '', tecnico_id: '', cliente_nome: '', tipo_servico: '', valor_servico: '', data_geracao: new Date().toISOString().slice(0,10) });
  const [salvando, setSalvando] = useState(false);
  const [lancParaDeletar, setLancParaDeletar] = useState(null);
  const [deletando, setDeletando] = useState(false);
  const [confirmRecalc, setConfirmRecalc] = useState(false);
  const [recalculando, setRecalculando] = useState(false);

  React.useEffect(() => {
    const checkAdmin = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        if (u?.role !== 'admin') navigate('/Dashboard');
      } catch {
        navigate('/Dashboard');
      }
    };
    checkAdmin();
  }, [navigate]);

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ['lancamentos-financeiros'],
    queryFn: () => base44.entities.LancamentoFinanceiro.list('-data_geracao'),
  });

  const { data: tecnicos = [] } = useQuery({
    queryKey: ['tecnicos-financeiro'],
    queryFn: () => base44.entities.TecnicoFinanceiro.list(),
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list(),
  });

  const { data: tiposServico = [] } = useQuery({
    queryKey: ['tipos-servico-valor'],
    queryFn: () => base44.entities.TipoServicoValor.list(),
  });

  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(lanc => {
      const dataLanc = new Date(lanc.data_geracao);
      const matchData = (!dataInicio || dataLanc >= new Date(dataInicio)) &&
                        (!dataFim   || dataLanc <= new Date(dataFim));
      const matchTecnico = !tecnicoFiltro || lanc.tecnico_id === tecnicoFiltro;
      return matchData && matchTecnico;
    });
  }, [lancamentos, dataInicio, dataFim, tecnicoFiltro]);

  const totais = useMemo(() => calcularTotalComissoes(lancamentosFiltrados), [lancamentosFiltrados]);
  const porMes = useMemo(() => agruparPorPeriodo(lancamentosFiltrados), [lancamentosFiltrados]);

  // Ganhos semanais por equipe
  const { semanas, equipesNomes } = useMemo(() => {
    const hoje = getLocalDate();
    const sems = Array.from({ length: NUM_SEMANAS }, (_, i) => {
      const ref = subWeeks(hoje, i);
      const inicio = getStartOfWeek(ref);
      const fim    = getEndOfWeek(ref);
      const label  = `${format(inicio, 'dd/MM', { locale: ptBR })} – ${format(fim, 'dd/MM', { locale: ptBR })}`;
      return { inicio, fim, label };
    });
    const nomesSet = new Set(lancamentos.map(l => l.equipe_nome).filter(Boolean));
    const ordered = equipes.map(e => e.nome).filter(n => nomesSet.has(n));
    nomesSet.forEach(n => { if (!ordered.includes(n)) ordered.push(n); });
    return { semanas: sems, equipesNomes: ordered };
  }, [lancamentos, equipes]);

  const ganhosSemanais = useMemo(() => {
    return semanas.map(({ inicio, fim, label }) => {
      const lancsSemana = lancamentos.filter(l => {
        if (!l.data_geracao) return false;
        try {
          const dt = toLocalDate(new Date(l.data_geracao));
          if (!dt) return false;
          return isWithinInterval(dt, { start: inicio, end: fim });
        } catch { return false; }
      });
      const porEquipe = {};
      let totalSemana = 0;
      equipesNomes.forEach(nome => { porEquipe[nome] = 0; });
      lancsSemana.forEach(l => {
        const nome = l.equipe_nome;
        if (!nome) return;
        const val = (l.valor_comissao_tecnico || 0) + (l.valor_comissao_equipe || 0);
        porEquipe[nome] = (porEquipe[nome] || 0) + val;
        totalSemana += val;
      });
      return { label, porEquipe, total: totalSemana };
    });
  }, [semanas, lancamentos, equipesNomes]);

  const totaisPorEquipe = useMemo(() => {
    const t = {};
    equipesNomes.forEach(n => { t[n] = 0; });
    let grand = 0;
    ganhosSemanais.forEach(s => {
      equipesNomes.forEach(n => { t[n] = (t[n] || 0) + s.porEquipe[n]; });
      grand += s.total;
    });
    return { porEquipe: t, total: grand };
  }, [ganhosSemanais, equipesNomes]);

  const handleSalvarLancamento = async () => {
    const valor = parseFloat(novoLanc.valor_servico);
    if (!valor || isNaN(valor)) { toast.error('Informe o valor do serviço'); return; }
    if (!novoLanc.cliente_nome.trim()) { toast.error('Informe o cliente'); return; }

    // Determinar lista de técnicos que vão receber o lançamento
    let tecLista = [];
    if (modoLanc === 'equipe') {
      if (!novoLanc.equipe_id) { toast.error('Selecione uma equipe'); return; }
      tecLista = tecnicos.filter(t => t.equipe_nome === novoLanc.equipe_id);
      if (tecLista.length === 0) {
        toast.error(`Nenhum técnico na equipe "${novoLanc.equipe_id}". Verifique o cadastro.`);
        return;
      }
    } else {
      const tec = tecnicos.find(t => t.tecnico_id === novoLanc.tecnico_id);
      if (!tec) { toast.error('Selecione um técnico'); return; }
      tecLista = [tec];
    }

    setSalvando(true);
    try {
      const agora = novoLanc.data_geracao ? new Date(novoLanc.data_geracao + 'T12:00:00').toISOString() : new Date().toISOString();
      // Le percentuais da Tabela de Servicos (TipoServicoValor). Fallback 30/15.
      const tipoServ = novoLanc.tipo_servico.trim() || 'Serviço';
      const comissaoCalc = await calcularComissao(tipoServ, valor, queryClient);
      const comissao = comissaoCalc.valor_comissao_tecnico;

      // Buscar um servico_id real para usar como referência (campo obrigatório no schema)
      let placeholderServicoId = lancamentos.find(l => l.servico_id && l.servico_id.length > 10)?.servico_id;
      if (!placeholderServicoId) {
        const servicosList = await base44.entities.Servico.list();
        placeholderServicoId = servicosList[0]?.id;
      }
      if (!placeholderServicoId) { toast.error('Nenhum serviço encontrado para referência'); setSalvando(false); return; }

      for (const tec of tecLista) {
        // Criar lançamento — tecnico_id deve ser o email do técnico (usado em MeuFinanceiro)
        await base44.entities.LancamentoFinanceiro.create({
          servico_id: placeholderServicoId,
          tecnico_id: tec.tecnico_id,
          tecnico_nome: tec.tecnico_nome,
          equipe_id: tec.equipe_id || '',
          equipe_nome: tec.equipe_nome || '',
          cliente_nome: novoLanc.cliente_nome.trim(),
          tipo_servico: tipoServ,
          valor_total_servico: valor,
          percentual_tecnico: comissaoCalc.percentual_tecnico,
          valor_comissao_tecnico: comissao,
          percentual_equipe: comissaoCalc.percentual_equipe,
          valor_comissao_equipe: comissaoCalc.valor_comissao_equipe,
          status: 'pendente',
          data_geracao: agora,
          usuario_geracao: user?.email || '',
        });

        // Sincronizar crédito no financeiro do técnico (buscar registro atualizado)
        try {
          const tecRegs = await base44.entities.TecnicoFinanceiro.filter({ tecnico_id: tec.tecnico_id });
          if (tecRegs && tecRegs.length > 0) {
            const tr = tecRegs[0];
            await base44.entities.TecnicoFinanceiro.update(tr.id, {
              credito_pendente: (tr.credito_pendente || 0) + comissao,
              total_ganho: (tr.total_ganho || 0) + comissao,
            });
          }
        } catch (err2) {
          console.error('[Comissão] Erro ao atualizar TecnicoFinanceiro:', err2);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
      queryClient.invalidateQueries({ queryKey: ['tecnicos-financeiro'] });
      queryClient.invalidateQueries({ queryKey: ['minhasComissoes'] });
      toast.success(`${tecLista.length} lançamento(s) adicionado(s) — R$ ${comissao.toFixed(2)} cada!`);
      setModalOpen(false);
      setNovoLanc({ equipe_id: '', tecnico_id: '', cliente_nome: '', tipo_servico: '', valor_servico: '', data_geracao: new Date().toISOString().slice(0,10) });
    } catch (err) {
      console.error('[Comissão] Erro ao salvar lançamento:', err);
      toast.error('Erro ao salvar: ' + (err?.message || String(err)), { duration: 8000 });
    } finally { setSalvando(false); }
  };

  const executarDelecaoLancamento = async () => {
    const lanc = lancParaDeletar;
    if (!lanc) return;
    setDeletando(true);
    try {
      await base44.entities.LancamentoFinanceiro.delete(lanc.id);
      // Reverter crédito do técnico (buscar registro atualizado para evitar race condition)
      try {
        const tecRegs = await base44.entities.TecnicoFinanceiro.filter({ tecnico_id: lanc.tecnico_id });
        if (tecRegs && tecRegs.length > 0) {
          const tr = tecRegs[0];
          await base44.entities.TecnicoFinanceiro.update(tr.id, {
            credito_pendente: Math.max(0, (tr.credito_pendente || 0) - (lanc.valor_comissao_tecnico || 0)),
            total_ganho: Math.max(0, (tr.total_ganho || 0) - (lanc.valor_comissao_tecnico || 0)),
          });
        }
      } catch (err2) {
        console.error('[Comissão] Erro ao reverter TecnicoFinanceiro:', err2);
      }
      queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
      toast.success('Lançamento removido');
    } catch {
      toast.error('Erro ao remover');
    } finally {
      setDeletando(false);
      setLancParaDeletar(null);
    }
  };

  const handleGerarPDF = async () => {
    await gerarPDF({ lancamentosFiltrados, totais, ganhosSemanais, equipesNomes, totaisPorEquipe, porMes, dataInicio, dataFim });
  };

  // Recalcula % de TODOS os lancamentos pendentes (sem pagamento) usando o
  // % atual da Tabela de Servicos. Ajusta credito_pendente/total_ganho do
  // TecnicoFinanceiro pela DIFERENCA. Nao mexe em pago/parcial.
  const handleRecalcularComissoes = async () => {
    setRecalculando(true);
    setConfirmRecalc(false);
    try {
      // Filtra apenas lancamentos elegiveis: sem pagamento confirmado E sem
      // valor pago parcial (status pendente E valor_pago = 0).
      const elegiveis = lancamentos.filter(l =>
        l.status === 'pendente' && (l.valor_pago || 0) === 0
      );
      if (elegiveis.length === 0) {
        toast.info('Nenhum lançamento pendente para recalcular');
        setRecalculando(false);
        return;
      }

      // Pre-carrega tabela uma vez (cache)
      await queryClient.fetchQuery({
        queryKey: ['tiposServicoValor'],
        queryFn: () => base44.entities.TipoServicoValor.list(),
        staleTime: 60_000,
      });

      // Agrupa diferenca por tecnico_id para 1 update por tecnico no final
      const ajusteCreditoPorTecnico = {};
      let atualizados = 0;
      let inalterados = 0;
      let erros = 0;

      for (const lanc of elegiveis) {
        try {
          const novo = await calcularComissao(lanc.tipo_servico, lanc.valor_total_servico || 0, queryClient);
          const oldPercTec = lanc.percentual_tecnico ?? 15;
          const oldComTec = lanc.valor_comissao_tecnico || 0;
          if (Math.abs(novo.percentual_tecnico - oldPercTec) < 0.001) {
            inalterados++;
            continue;
          }
          await base44.entities.LancamentoFinanceiro.update(lanc.id, {
            percentual_equipe: novo.percentual_equipe,
            valor_comissao_equipe: novo.valor_comissao_equipe,
            percentual_tecnico: novo.percentual_tecnico,
            valor_comissao_tecnico: novo.valor_comissao_tecnico,
          });
          const diff = novo.valor_comissao_tecnico - oldComTec;
          if (lanc.tecnico_id) {
            ajusteCreditoPorTecnico[lanc.tecnico_id] = (ajusteCreditoPorTecnico[lanc.tecnico_id] || 0) + diff;
          }
          atualizados++;
        } catch (err) {
          console.error('[recalc] falha em lancamento', lanc.id, err);
          erros++;
        }
      }

      // Aplica ajuste de credito_pendente/total_ganho por tecnico
      for (const [tecnicoId, diff] of Object.entries(ajusteCreditoPorTecnico)) {
        if (Math.abs(diff) < 0.001) continue;
        try {
          const tecRegs = await base44.entities.TecnicoFinanceiro.filter({ tecnico_id: tecnicoId });
          if (tecRegs && tecRegs.length > 0) {
            const tr = tecRegs[0];
            await base44.entities.TecnicoFinanceiro.update(tr.id, {
              credito_pendente: Math.max(0, (tr.credito_pendente || 0) + diff),
              total_ganho: Math.max(0, (tr.total_ganho || 0) + diff),
            });
          }
        } catch (err) {
          console.error('[recalc] falha ao ajustar TecnicoFinanceiro', tecnicoId, err);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
      queryClient.invalidateQueries({ queryKey: ['tecnicos-financeiro'] });

      if (erros > 0) {
        toast.error(`${atualizados} atualizados, ${inalterados} sem mudança, ${erros} falharam`);
      } else {
        toast.success(`✓ ${atualizados} lançamento(s) recalculado(s). ${inalterados} já estavam corretos.`);
      }
    } catch (err) {
      console.error('[recalc] erro geral', err);
      toast.error('Erro ao recalcular comissões: ' + (err?.message || ''));
    } finally {
      setRecalculando(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d1826]">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (user.role !== 'admin') return <NoPermission />;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton count={3} />
        <TableSkeleton rows={10} />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100">Relatório de Comissões</h1>
          <p className="text-gray-400 mt-1 text-sm">Extrato detalhado de comissões por período</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto flex-wrap">
          <Button
            onClick={() => setConfirmRecalc(true)}
            disabled={recalculando}
            variant="outline"
            className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            title="Recalcula o % de todos os lançamentos pendentes usando a Tabela de Serviços atual"
          >
            {recalculando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            {recalculando ? 'Recalculando...' : 'Recalcular %'}
          </Button>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
          <Button
            onClick={handleGerarPDF}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <FileText className="w-4 h-4" />
            Gerar PDF
          </Button>
        </div>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#152236] border-white/5 rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Gerado</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{fmt(totais.total)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#152236] border-white/5 rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Pendente</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{fmt(totais.pendente)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#152236] border-white/5 rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Pago</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{fmt(totais.pago)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-[#152236] border-white/5 rounded-2xl">
        <CardHeader className="pb-3 px-5 pt-5 border-b border-white/5">
          <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-400" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block uppercase tracking-wider">Data Início</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={inputDark} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block uppercase tracking-wider">Data Fim</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className={inputDark} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block uppercase tracking-wider">Técnico</label>
              <select value={tecnicoFiltro} onChange={(e) => setTecnicoFiltro(e.target.value)} className={selectDark}>
                <option value="">Todos</option>
                {tecnicos.map(t => (
                  <option key={t.tecnico_id} value={t.tecnico_id}>{t.tecnico_nome}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ganhos Semanais por Equipe */}
      {equipesNomes.length > 0 && (
        <Card className="bg-[#152236] border-white/5 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-5 border-b border-white/5">
            <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Ganhos Semanais por Equipe
              <span className="text-[10px] font-normal text-gray-500 ml-1">(últimas {NUM_SEMANAS} semanas)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-white/5 bg-[#0d1826]/50">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider w-36">Semana</th>
                  {equipesNomes.map(nome => (
                    <th key={nome} className="text-right px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">{nome}</th>
                  ))}
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ganhosSemanais.map((sem, idx) => {
                  const melhorEquipe = equipesNomes.reduce((best, n) =>
                    sem.porEquipe[n] > (sem.porEquipe[best] || 0) ? n : best, equipesNomes[0]);
                  return (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 text-gray-300 text-xs font-medium whitespace-nowrap">{sem.label}</td>
                      {equipesNomes.map(nome => {
                        const val = sem.porEquipe[nome] || 0;
                        const isBest = val > 0 && nome === melhorEquipe && equipesNomes.length > 1;
                        return (
                          <td key={nome} className="px-4 py-3 text-right">
                            <span className={`text-xs font-bold ${val === 0 ? 'text-gray-600' : isBest ? 'text-emerald-400' : 'text-gray-300'}`}>
                              {val === 0 ? '—' : fmt(val)}
                            </span>
                            {isBest && val > 0 && (
                              <span className="ml-1.5 text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">↑</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-5 py-3 text-right">
                        <span className={`text-xs font-bold ${sem.total === 0 ? 'text-gray-600' : 'text-blue-400'}`}>
                          {sem.total === 0 ? '—' : fmt(sem.total)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 bg-[#0d1826]/70">
                  <td className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total período</td>
                  {equipesNomes.map(nome => (
                    <td key={nome} className="px-4 py-3 text-right">
                      <span className="text-xs font-bold text-amber-400">{fmt(totaisPorEquipe.porEquipe[nome] || 0)}</span>
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs font-bold text-blue-400">{fmt(totaisPorEquipe.total)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Resumo Mensal */}
      <Card className="bg-[#152236] border-white/5 rounded-2xl">
        <CardHeader className="pb-3 px-5 pt-5 border-b border-white/5">
          <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            Resumo Mensal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-white/5">
          {Object.keys(porMes).length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">Nenhum lançamento encontrado</p>
          ) : (
            Object.entries(porMes).map(([mes, items]) => {
              const total = calcularTotalComissoes(items);
              return (
                <div key={mes} className="flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors">
                  <div>
                    <p className="font-semibold text-gray-200 text-sm">{mes}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{items.length} lançamentos</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-base text-blue-400">{fmt(total.total)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Pendente: {fmt(total.pendente)}</p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card className="bg-[#152236] border-white/5 rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-5 border-b border-white/5">
          <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Lançamentos Detalhados
            <span className="ml-auto text-xs font-normal text-gray-500">{lancamentosFiltrados.length} registros</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-white/5 bg-[#0d1826]/50">
                {['Data', 'Técnico', 'Equipe', 'Cliente', 'Serviço', 'Valor', 'Comissão', 'Status', ''].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {lancamentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500 text-sm">Nenhum lançamento encontrado</td>
                </tr>
              ) : (
                lancamentosFiltrados.map((lanc) => (
                  <tr key={lanc.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(lanc.data_geracao)}</td>
                    <td className="px-4 py-3 text-gray-200 font-medium text-xs">{lanc.tecnico_nome}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{lanc.equipe_nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{lanc.cliente_nome}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{formatTipoServicoCompact(lanc.tipo_servico)}</td>
                    <td className="px-4 py-3 text-gray-200 font-medium text-xs whitespace-nowrap">{fmt(lanc.valor_total_servico)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-400 text-xs whitespace-nowrap">{fmt(lanc.valor_comissao_tecnico)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        lanc.status === 'pago' ? 'bg-emerald-500/15 text-emerald-400' :
                        lanc.status === 'creditado' ? 'bg-blue-500/15 text-blue-400' :
                        'bg-amber-500/15 text-amber-400'
                      }`}>
                        {lanc.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setLancParaDeletar(lanc)}
                        className="p-1 rounded hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-colors"
                        title="Remover lançamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal adicionar lançamento manual */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Lançamento de Comissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            {/* Modo: equipe ou técnico */}
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => setModoLanc('equipe')}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${modoLanc === 'equipe' ? 'bg-blue-600 text-white' : 'bg-[#0f1a2b] text-gray-400 hover:bg-white/5'}`}
              >
                Por Equipe
              </button>
              <button
                onClick={() => setModoLanc('tecnico')}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${modoLanc === 'tecnico' ? 'bg-blue-600 text-white' : 'bg-[#0f1a2b] text-gray-400 hover:bg-white/5'}`}
              >
                Por Técnico
              </button>
            </div>

            {/* Seleção equipe ou técnico */}
            {modoLanc === 'equipe' ? (
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Equipe *</Label>
                <select
                  className="w-full border border-white/10 rounded-md h-10 px-3 text-sm bg-[#0f1a2b] text-gray-200"
                  value={novoLanc.equipe_id}
                  onChange={e => setNovoLanc(f => ({ ...f, equipe_id: e.target.value }))}
                >
                  <option value="">Selecione a equipe</option>
                  {equipes.map(eq => (
                    <option key={eq.id} value={eq.nome}>{eq.nome}</option>
                  ))}
                </select>
                {novoLanc.equipe_id && (() => {
                  const membros = tecnicos.filter(t => t.equipe_nome === novoLanc.equipe_id);
                  return membros.length > 0 ? (
                    <p className="text-xs text-emerald-600 mt-1.5">
                      ✓ Lançamento para {membros.length} técnico(s): {membros.map(m => m.tecnico_nome).join(', ')}
                    </p>
                  ) : <p className="text-xs text-red-500 mt-1.5">Nenhum técnico cadastrado nesta equipe</p>;
                })()}
              </div>
            ) : (
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Técnico *</Label>
                <select
                  className="w-full border border-white/10 rounded-md h-10 px-3 text-sm bg-[#0f1a2b] text-gray-200"
                  value={novoLanc.tecnico_id}
                  onChange={e => setNovoLanc(f => ({ ...f, tecnico_id: e.target.value }))}
                >
                  <option value="">Selecione o técnico</option>
                  {tecnicos.map(t => (
                    <option key={t.tecnico_id} value={t.tecnico_id}>{t.tecnico_nome} — {t.equipe_nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Cliente *</Label>
              <Input placeholder="Nome do cliente" value={novoLanc.cliente_nome} onChange={e => setNovoLanc(f => ({ ...f, cliente_nome: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Tipo de Serviço</Label>
              <select
                className="w-full border border-white/10 rounded-md h-10 px-3 text-sm bg-[#0f1a2b] text-gray-200"
                value={novoLanc.tipo_servico}
                onChange={e => {
                  const tipo = e.target.value;
                  const tabela = tiposServico.find(t => t.tipo_servico === tipo);
                  setNovoLanc(f => ({
                    ...f,
                    tipo_servico: tipo,
                    valor_servico: tabela?.valor_tabela ? String(tabela.valor_tabela) : f.valor_servico,
                  }));
                }}
              >
                <option value="">Selecione o tipo de serviço</option>
                {tiposServico.filter(t => t.ativo !== false).map(t => (
                  <option key={t.id} value={t.tipo_servico}>
                    {t.tipo_servico}{t.valor_tabela ? ` — R$ ${t.valor_tabela.toFixed(2).replace('.', ',')}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Valor do Serviço (R$) *</Label>
                <Input type="number" placeholder="200.00" value={novoLanc.valor_servico} onChange={e => setNovoLanc(f => ({ ...f, valor_servico: e.target.value }))} />
              </div>
              {(() => {
                // Preview da comissao do tecnico — le da Tabela de Servicos
                const previewVal = parseFloat(novoLanc.valor_servico) || 0;
                const previewTipo = (novoLanc.tipo_servico || '').trim() || 'Serviço';
                const prev = calcularComissaoSync(previewTipo, previewVal, tiposServico);
                return (
                  <div>
                    <Label className="text-xs text-gray-400 mb-1 block">
                      Comissão por técnico ({prev.percentual_tecnico}%)
                    </Label>
                    <Input
                      readOnly
                      className="bg-white/5 text-emerald-400 font-semibold border-white/10"
                      value={previewVal ? `R$ ${prev.valor_comissao_tecnico.toFixed(2)}` : 'R$ 0.00'}
                    />
                  </div>
                );
              })()}
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Data do Lançamento</Label>
              <Input type="date" value={novoLanc.data_geracao} onChange={e => setNovoLanc(f => ({ ...f, data_geracao: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSalvarLancamento} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!lancParaDeletar}
        onClose={() => !deletando && setLancParaDeletar(null)}
        onConfirm={executarDelecaoLancamento}
        title="Remover lançamento de comissão"
        description={lancParaDeletar ? `Remover lançamento de ${lancParaDeletar.tecnico_nome} — ${lancParaDeletar.cliente_nome} (${fmt(lancParaDeletar.valor_comissao_tecnico)})? O crédito será revertido.` : ''}
        confirmText="Remover"
        variant="destructive"
        isLoading={deletando}
      />

      <ConfirmDialog
        open={confirmRecalc}
        onClose={() => !recalculando && setConfirmRecalc(false)}
        onConfirm={handleRecalcularComissoes}
        title="Recalcular comissões pendentes?"
        description={`Vai atualizar o % de TODOS os lançamentos pendentes (sem pagamento confirmado) com base na Tabela de Serviços atual. Lançamentos pagos ou com pagamento parcial NÃO serão alterados. Os créditos pendentes dos técnicos serão ajustados pela diferença. Pode levar alguns segundos.`}
        confirmText={recalculando ? 'Recalculando...' : 'Recalcular agora'}
        isLoading={recalculando}
      />
    </div>
  );
}
