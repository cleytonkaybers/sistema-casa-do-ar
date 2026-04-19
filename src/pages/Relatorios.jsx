import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, DollarSign, CheckCircle, Clock, Filter, BarChart2, List, BookOpen, FileSpreadsheet, FileText } from 'lucide-react';
import NotionExportModal from '../components/relatorios/NotionExportModal';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, startOfWeek, endOfWeek, startOfYear, endOfYear, subWeeks } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import NoPermission from '../components/NoPermission';
import { usePermissions } from '../components/auth/PermissionGuard';
import { useNavigate } from 'react-router-dom';
import { exportarExcel } from '@/lib/excelUtils';
import { formatTipoServicoCompact } from '@/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

const CATEGORIAS = [
  { label: 'Limpeza', color: '#3b82f6', keywords: ['Limpeza'] },
  { label: 'Instalação', color: '#10b981', keywords: ['Instalação'] },
  { label: 'Manutenção', color: '#f59e0b', keywords: ['Troca', 'Recarga', 'Carga', 'Conserto', 'Serviço', 'Ver defeito', 'Mudança'] },
  { label: 'Outros', color: '#8b5cf6', keywords: [] },
];

const getCategoria = (tipo) => {
  if (!tipo) return 'Outros';
  for (const cat of CATEGORIAS) {
    if (cat.keywords.some(k => tipo.includes(k))) return cat.label;
  }
  return 'Outros';
};

const hoje = new Date();
const PERIODOS = [
  { label: 'Esta semana', range: () => ({ start: startOfWeek(hoje, { weekStartsOn: 1 }), end: endOfWeek(hoje, { weekStartsOn: 1 }) }) },
  { label: 'Semana passada', range: () => ({ start: startOfWeek(subWeeks(hoje, 1), { weekStartsOn: 1 }), end: endOfWeek(subWeeks(hoje, 1), { weekStartsOn: 1 }) }) },
  { label: 'Este mês', range: () => ({ start: startOfMonth(hoje), end: endOfMonth(hoje) }) },
  { label: 'Mês passado', range: () => ({ start: startOfMonth(subMonths(hoje, 1)), end: endOfMonth(subMonths(hoje, 1)) }) },
  { label: 'Este ano', range: () => ({ start: startOfYear(hoje), end: endOfYear(hoje) }) },
  { label: 'Personalizado', range: () => ({ start: startOfMonth(hoje), end: endOfMonth(hoje) }) },
];

export default function RelatóriosPage() {
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const today = new Date();
  
  React.useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = await base44.auth.me();
        if (user?.role !== 'admin') {
          navigate('/Dashboard');
        }
      } catch {
        navigate('/Dashboard');
      }
    };
    checkAdmin();
  }, [navigate]);

  const [periodoSelecionado, setPeriodoSelecionado] = useState(0);
  const [customStart, setCustomStart] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroTipoEspecifico, setFiltroTipoEspecifico] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [viewMode, setViewMode] = useState('resumo'); // 'resumo' | 'detalhado'
  const [notionModal, setNotionModal] = useState(false);

  const dateRange = useMemo(() => {
    if (periodoSelecionado === 5 && customStart && customEnd) {
      return { start: new Date(customStart), end: new Date(customEnd + 'T23:59:59') };
    }
    const p = PERIODOS[periodoSelecionado];
    return p ? p.range() : { start: startOfMonth(today), end: endOfMonth(today) };
  }, [periodoSelecionado, customStart, customEnd]);

  const handleExportarExcel = async () => {
    const resumoCat = dadosPorCategoria.map(d => ({
      'Categoria': d.name,
      'Quantidade': d.quantidade,
      'Valor Total (R$)': d.valor.toFixed(2),
      '% do Total': metrics.total > 0 ? Math.round((d.quantidade / metrics.total) * 100) + '%' : '0%',
    }));

    const resumoTipo = dadosPorTipo.map(d => ({
      'Tipo de Serviço': d.name,
      'Categoria': getCategoria(d.name),
      'Quantidade': d.quantidade,
      'Valor Total (R$)': d.valor.toFixed(2),
      '% do Total': metrics.total > 0 ? Math.round((d.quantidade / metrics.total) * 100) + '%' : '0%',
    }));

    const detalhes = servicosFiltrados.map(s => ({
      'Cliente': s.cliente_nome,
      'Tipo de Serviço': s.tipo_servico,
      'Categoria': getCategoria(s.tipo_servico),
      'Equipe': s.equipe_nome || '-',
      'Data': s.data_programada ? format(parseISO(s.data_programada), 'dd/MM/yyyy') : '-',
      'Status': s.status,
      'Valor (R$)': s.valor ? s.valor.toFixed(2) : '0.00',
    }));

    const periodo = `${format(dateRange.start, 'dd-MM-yyyy')}_${format(dateRange.end, 'dd-MM-yyyy')}`;

    await exportarExcel(
      [
        { name: 'Resumo por Categoria', data: resumoCat, colWidths: [22, 12, 18, 12] },
        { name: 'Resumo por Tipo', data: resumoTipo, colWidths: [35, 22, 12, 18, 12] },
        { name: 'Serviços Detalhados', data: detalhes, colWidths: [28, 35, 22, 18, 14, 12, 14] },
      ],
      `relatorio_servicos_${periodo}.xlsx`
    );
  };

  const { data: servicos = [], isLoading } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list('-data_programada', 2000)
  });

  const servicosFiltrados = useMemo(() => {
    return servicos.filter(s => {
      if (!s.data_programada) return false;
      const date = parseISO(s.data_programada);
      if (!isWithinInterval(date, { start: dateRange.start, end: dateRange.end })) return false;
      if (filtroCategoria !== 'todas' && getCategoria(s.tipo_servico) !== filtroCategoria) return false;
      if (filtroTipoEspecifico !== 'todos' && s.tipo_servico !== filtroTipoEspecifico) return false;
      if (filtroStatus !== 'todos' && s.status !== filtroStatus) return false;
      return true;
    });
  }, [servicos, dateRange, filtroCategoria, filtroTipoEspecifico, filtroStatus]);

  // Métricas gerais
  const metrics = useMemo(() => {
    const total = servicosFiltrados.length;
    const concluidos = servicosFiltrados.filter(s => s.status === 'concluido').length;
    const emAndamento = servicosFiltrados.filter(s => s.status === 'andamento').length;
    const abertos = servicosFiltrados.filter(s => s.status === 'aberto' || s.status === 'agendado' || s.status === 'reagendado').length;
    const valorTotal = servicosFiltrados.reduce((sum, s) => sum + (s.valor || 0), 0);
    const valorConcluidos = servicosFiltrados.filter(s => s.status === 'concluido').reduce((sum, s) => sum + (s.valor || 0), 0);
    return { total, concluidos, emAndamento, abertos, valorTotal, valorConcluidos };
  }, [servicosFiltrados]);

  // Dados por categoria
  const dadosPorCategoria = useMemo(() => {
    const map = {};
    CATEGORIAS.forEach(c => { map[c.label] = { quantidade: 0, valor: 0, color: c.color }; });
    servicosFiltrados.forEach(s => {
      const cat = getCategoria(s.tipo_servico);
      map[cat].quantidade++;
      map[cat].valor += s.valor || 0;
    });
    return Object.entries(map).map(([name, data]) => ({ name, ...data })).filter(d => d.quantidade > 0).sort((a, b) => b.quantidade - a.quantidade);
  }, [servicosFiltrados]);

  // Dados por tipo específico
  const dadosPorTipo = useMemo(() => {
    const map = {};
    servicosFiltrados.forEach(s => {
      const tipo = s.tipo_servico || 'Sem tipo';
      if (!map[tipo]) map[tipo] = { quantidade: 0, valor: 0 };
      map[tipo].quantidade++;
      map[tipo].valor += s.valor || 0;
    });
    return Object.entries(map).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.quantidade - a.quantidade);
  }, [servicosFiltrados]);

  // Tipos disponíveis no período filtrado (para o select)
  const tiposDisponiveis = useMemo(() => {
    const set = new Set(servicos.filter(s => {
      if (!s.data_programada) return false;
      const date = parseISO(s.data_programada);
      return isWithinInterval(date, { start: dateRange.start, end: dateRange.end });
    }).map(s => s.tipo_servico).filter(Boolean));
    return [...set].sort();
  }, [servicos, dateRange]);

  if (!isAdmin) return <NoPermission />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-5 sm:p-6" style={{ backgroundColor: '#1e3a8a' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Relatórios</h1>
            <p className="text-blue-200/80 mt-1 text-xs sm:text-sm">
              {format(dateRange.start, 'dd/MM/yyyy')} — {format(dateRange.end, 'dd/MM/yyyy')}
              {filtroCategoria !== 'todas' && <span className="ml-2 text-yellow-300">· {filtroCategoria}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExportarExcel} className="h-9 text-sm font-semibold rounded-xl gap-2" style={{ backgroundColor: '#22c55e', color: '#fff' }}>
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </Button>
            <Button onClick={() => setNotionModal(true)} variant="outline" className="h-9 text-sm rounded-xl gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20">
              <BookOpen className="w-4 h-4" /> Notion
            </Button>
            <Button onClick={() => setViewMode('resumo')} className={`h-9 text-sm rounded-xl gap-2 ${viewMode === 'resumo' ? 'bg-yellow-400 text-gray-900 font-bold' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}>
              <BarChart2 className="w-4 h-4" /> Resumo
            </Button>
            <Button onClick={() => setViewMode('detalhado')} className={`h-9 text-sm rounded-xl gap-2 ${viewMode === 'detalhado' ? 'bg-yellow-400 text-gray-900 font-bold' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}>
              <List className="w-4 h-4" /> Detalhado
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-4">
          {/* Período */}
          <div>
            <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Filter className="w-3 h-3" /> Período</p>
            <div className="flex flex-wrap gap-2">
              {PERIODOS.map((p, i) => (
                <button key={i} onClick={() => setPeriodoSelecionado(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${periodoSelecionado === i ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-gray-300 hover:border-blue-500'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {periodoSelecionado === 5 && (
              <div className="flex gap-3 mt-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">De</p>
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                    className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Até</p>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                    className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-1.5 text-sm" />
                </div>
              </div>
            )}
          </div>

          {/* Categoria */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Categoria</p>
            <div className="flex flex-wrap gap-2">
              {['todas', ...CATEGORIAS.map(c => c.label)].map(cat => (
                <button key={cat} onClick={() => { setFiltroCategoria(cat); setFiltroTipoEspecifico('todos'); }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${filtroCategoria === cat ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-600 text-gray-300 hover:border-purple-500'}`}>
                  {cat === 'todas' ? 'Todas' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo específico e Status */}
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Tipo específico</p>
              <select value={filtroTipoEspecifico} onChange={e => setFiltroTipoEspecifico(e.target.value)}
                className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-1.5 text-sm min-w-48">
                <option value="todos">Todos os tipos</option>
                {tiposDisponiveis.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
                className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-1.5 text-sm">
                <option value="todos">Todos</option>
                <option value="concluido">Concluído</option>
                <option value="andamento">Em andamento</option>
                <option value="aberto">Aberto</option>
                <option value="agendado">Agendado</option>
                <option value="reagendado">Reagendado</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total', value: metrics.total, color: 'text-blue-600', bg: 'bg-blue-50', icon: <TrendingUp className="w-5 h-5 text-blue-500" /> },
              { label: 'Concluídos', value: metrics.concluidos, color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
              { label: 'Em andamento', value: metrics.emAndamento, color: 'text-blue-500', bg: 'bg-blue-50', icon: <Clock className="w-5 h-5 text-blue-400" /> },
              { label: 'Abertos', value: metrics.abertos, color: 'text-amber-600', bg: 'bg-amber-50', icon: <Clock className="w-5 h-5 text-amber-500" /> },
              { label: 'Faturamento Total', value: `R$ ${metrics.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'text-purple-600', bg: 'bg-purple-50', icon: <DollarSign className="w-5 h-5 text-purple-500" />, small: true },
              { label: 'Fat. Concluídos', value: `R$ ${metrics.valorConcluidos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <DollarSign className="w-5 h-5 text-emerald-500" />, small: true },
            ].map((m, i) => (
              <Card key={i} className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-medium">{m.label}</p>
                      <p className={`font-bold mt-1 ${m.color} ${m.small ? 'text-base' : 'text-2xl'}`}>{m.value}</p>
                    </div>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${m.bg}`}>{m.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {viewMode === 'resumo' && (
            <div className="space-y-5">
              {/* Gráfico por Categoria */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                  <CardHeader><CardTitle className="text-gray-800 text-base font-semibold">Serviços por Categoria</CardTitle></CardHeader>
                  <CardContent>
                    {dadosPorCategoria.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">Nenhum dado no período</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={dadosPorCategoria} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}
                            formatter={(value, name) => [value, name === 'quantidade' ? 'Qtd' : 'Valor']} />
                          <Bar dataKey="quantidade" radius={[6, 6, 0, 0]}>
                            {dadosPorCategoria.map((entry, index) => (
                              <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                  <CardHeader><CardTitle className="text-gray-800 text-base font-semibold">Distribuição por Categoria</CardTitle></CardHeader>
                  <CardContent>
                    {dadosPorCategoria.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">Nenhum dado no período</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie data={dadosPorCategoria} dataKey="quantidade" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {dadosPorCategoria.map((entry, index) => (
                              <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }} />
                          <Legend formatter={(value) => <span style={{ color: '#64748b', fontSize: 12 }}>{value}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tabela resumo por tipo */}
              <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-gray-800 text-base font-semibold">📊 Quantidade por Tipo de Serviço</CardTitle>
                    <Button onClick={handleExportarExcel} size="sm" className="h-8 text-xs gap-1.5 rounded-lg" style={{ backgroundColor: '#22c55e', color: '#fff' }}>
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase bg-gray-50">
                          <th className="text-left py-2.5 px-3 rounded-tl-lg">Tipo de Serviço</th>
                          <th className="text-left py-2.5 px-3">Categoria</th>
                          <th className="text-center py-2.5 px-3">Quantidade</th>
                          <th className="text-right py-2.5 px-3">Valor Total</th>
                          <th className="text-right py-2.5 px-3 rounded-tr-lg">% do Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dadosPorTipo.map((row, i) => {
                          const cat = CATEGORIAS.find(c => c.label === getCategoria(row.name));
                          return (
                            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="py-2.5 px-3 text-gray-800 font-medium">{row.name}</td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: (cat?.color || '#6b7280') + '20', color: cat?.color || '#6b7280' }}>
                                  {getCategoria(row.name)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="text-blue-600 font-bold text-base">{row.quantidade}</span>
                                <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                                  <div className="h-1 rounded-full bg-blue-500" style={{ width: `${Math.round((row.quantidade / metrics.total) * 100)}%` }} />
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right text-green-600 font-semibold">
                                R$ {row.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-500 font-medium">
                                {metrics.total > 0 ? Math.round((row.quantidade / metrics.total) * 100) : 0}%
                              </td>
                            </tr>
                          );
                        })}
                        {dadosPorTipo.length === 0 && (
                          <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nenhum serviço no período com os filtros selecionados</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                </Card>
                </div>
                )}

                {viewMode === 'detalhado' && (
                <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gray-800 text-base font-semibold">📋 Serviços Detalhados</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{servicosFiltrados.length} registros</span>
                    <Button onClick={handleExportarExcel} size="sm" className="h-8 text-xs gap-1.5 rounded-lg" style={{ backgroundColor: '#22c55e', color: '#fff' }}>
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Excel
                    </Button>
                  </div>
                </div>
                </CardHeader>
                <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase bg-gray-50">
                        <th className="text-left py-2.5 px-3">Cliente</th>
                        <th className="text-left py-2.5 px-3">Tipo de Serviço</th>
                        <th className="text-left py-2.5 px-3">Categoria</th>
                        <th className="text-left py-2.5 px-3">Equipe</th>
                        <th className="text-left py-2.5 px-3">Data</th>
                        <th className="text-left py-2.5 px-3">Status</th>
                        <th className="text-right py-2.5 px-3">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicosFiltrados.map(s => {
                        const cat = CATEGORIAS.find(c => c.label === getCategoria(s.tipo_servico));
                        return (
                          <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-2.5 px-3 text-gray-800 font-semibold">{s.cliente_nome}</td>
                            <td className="py-2.5 px-3 text-gray-600 text-xs max-w-[180px] truncate">{formatTipoServicoCompact(s.tipo_servico)}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: (cat?.color || '#6b7280') + '20', color: cat?.color || '#6b7280' }}>
                                {getCategoria(s.tipo_servico)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 text-xs">{s.equipe_nome || '-'}</td>
                            <td className="py-2.5 px-3 text-gray-500 text-xs">{format(parseISO(s.data_programada), 'dd/MM/yyyy')}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                s.status === 'concluido' ? 'bg-green-100 text-green-700' :
                                s.status === 'andamento' ? 'bg-blue-100 text-blue-700' :
                                s.status === 'agendado' ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-green-600 font-semibold">
                              {s.valor ? `R$ ${s.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                      {servicosFiltrados.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-8 text-gray-400">Nenhum serviço no período com os filtros selecionados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </CardContent>
                </Card>
                )}
                </>
                )}
                <NotionExportModal open={notionModal} onClose={() => setNotionModal(false)} />
                </div>
                );
                }