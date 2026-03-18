import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, DollarSign, CheckCircle, Clock, Filter, BarChart2, List } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import NoPermission from '../components/NoPermission';
import { usePermissions } from '../components/auth/PermissionGuard';
import { useNavigate } from 'react-router-dom';

const TIPOS_SERVICO = [
  "Limpeza de 9k", "Limpeza de 12k", "Limpeza de 18k", "Limpeza de 22 a 24k",
  "Limpeza de 24k", "Limpeza de 30 a 32k", "Limpeza piso e teto",
  "Instalação de 9k", "Instalação de 12k", "Instalação de 18k", "Instalação de 22 a 24k",
  "Instalação de 24k", "Instalação de 30 a 32k", "Instalação piso e teto",
  "Troca de capacitor", "Recarga de gás", "Carga de gás completa", "Serviço de solda",
  "Troca de relé da placa", "Troca de sensor", "Troca de chave contadora",
  "Conserto de placa eletrônica", "Retirada de ar condicionado",
  "Serviço de passar tubulação de infra", "Ver defeito", "Troca de local", "Outro tipo de serviço"
];

const CATEGORIAS = [
  { label: 'Limpeza', keywords: ['limpeza'], color: '#06b6d4' },
  { label: 'Instalação', keywords: ['instalação', 'instalacao'], color: '#8b5cf6' },
  { label: 'Recarga / Gás', keywords: ['recarga', 'carga de gás', 'carga de gas'], color: '#f59e0b' },
  { label: 'Conserto / Reparo', keywords: ['troca', 'conserto', 'solda', 'capacitor', 'relé', 'sensor', 'chave', 'placa', 'defeito'], color: '#ef4444' },
  { label: 'Retirada', keywords: ['retirada'], color: '#ec4899' },
  { label: 'Outros', keywords: [], color: '#6b7280' },
];

function getCategoria(tipoServico) {
  if (!tipoServico) return 'Outros';
  const lower = tipoServico.toLowerCase();
  for (const cat of CATEGORIAS) {
    if (cat.keywords.length === 0) continue;
    if (cat.keywords.some(k => lower.includes(k))) return cat.label;
  }
  return 'Outros';
}

const PERIODOS = [
  { label: 'Este mês', getValue: () => { const t = new Date(); return { start: startOfMonth(t), end: endOfMonth(t) }; } },
  { label: 'Mês passado', getValue: () => { const t = subMonths(new Date(), 1); return { start: startOfMonth(t), end: endOfMonth(t) }; } },
  { label: 'Últimos 3 meses', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 2)), end: endOfMonth(new Date()) }) },
  { label: 'Últimos 6 meses', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 5)), end: endOfMonth(new Date()) }) },
  { label: 'Este ano', getValue: () => ({ start: new Date(new Date().getFullYear(), 0, 1), end: new Date(new Date().getFullYear(), 11, 31) }) },
  { label: 'Personalizado', getValue: null },
];

const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6b7280', '#10b981', '#3b82f6'];

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

  const dateRange = useMemo(() => {
    if (periodoSelecionado === 5) {
      return { start: parseISO(customStart), end: parseISO(customEnd) };
    }
    return PERIODOS[periodoSelecionado].getValue();
  }, [periodoSelecionado, customStart, customEnd]);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
            Relatórios
          </h1>
          <p className="text-gray-400 mt-1">
            {format(dateRange.start, 'dd/MM/yyyy')} — {format(dateRange.end, 'dd/MM/yyyy')}
            {filtroCategoria !== 'todas' && <span className="ml-2 text-cyan-400">· {filtroCategoria}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('resumo')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${viewMode === 'resumo' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-gray-300'}`}>
            <BarChart2 className="w-4 h-4" /> Resumo
          </button>
          <button onClick={() => setViewMode('detalhado')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${viewMode === 'detalhado' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-gray-300'}`}>
            <List className="w-4 h-4" /> Detalhado
          </button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border border-blue-800/40" style={{ backgroundColor: '#152032' }}>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total', value: metrics.total, color: 'text-cyan-400', icon: <TrendingUp className="w-5 h-5 text-cyan-400/40" /> },
              { label: 'Concluídos', value: metrics.concluidos, color: 'text-green-400', icon: <CheckCircle className="w-5 h-5 text-green-400/40" /> },
              { label: 'Em andamento', value: metrics.emAndamento, color: 'text-blue-400', icon: <Clock className="w-5 h-5 text-blue-400/40" /> },
              { label: 'Abertos', value: metrics.abertos, color: 'text-yellow-400', icon: <Clock className="w-5 h-5 text-yellow-400/40" /> },
              { label: 'Faturamento Total', value: `R$ ${metrics.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'text-purple-400', icon: <DollarSign className="w-5 h-5 text-purple-400/40" />, small: true },
              { label: 'Fat. Concluídos', value: `R$ ${metrics.valorConcluidos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'text-emerald-400', icon: <DollarSign className="w-5 h-5 text-emerald-400/40" />, small: true },
            ].map((m, i) => (
              <Card key={i} className="border border-blue-800/30" style={{ backgroundColor: '#152032' }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-400 text-xs">{m.label}</p>
                      <p className={`font-bold mt-1 ${m.color} ${m.small ? 'text-lg' : 'text-3xl'}`}>{m.value}</p>
                    </div>
                    {m.icon}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {viewMode === 'resumo' && (
            <div className="space-y-6">
              {/* Gráfico por Categoria */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border border-blue-800/30" style={{ backgroundColor: '#152032' }}>
                  <CardHeader><CardTitle className="text-white text-base">Serviços por Categoria</CardTitle></CardHeader>
                  <CardContent>
                    {dadosPorCategoria.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">Nenhum dado no período</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={dadosPorCategoria} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f1923', border: '1px solid #1e3a5f', borderRadius: 8, color: '#fff' }}
                            formatter={(value, name) => [value, name === 'quantidade' ? 'Qtd' : 'Valor']} />
                          <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                            {dadosPorCategoria.map((entry, index) => (
                              <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-blue-800/30" style={{ backgroundColor: '#152032' }}>
                  <CardHeader><CardTitle className="text-white text-base">Distribuição por Categoria</CardTitle></CardHeader>
                  <CardContent>
                    {dadosPorCategoria.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">Nenhum dado no período</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie data={dadosPorCategoria} dataKey="quantidade" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {dadosPorCategoria.map((entry, index) => (
                              <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0f1923', border: '1px solid #1e3a5f', borderRadius: 8, color: '#fff' }} />
                          <Legend formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tabela resumo por tipo */}
              <Card className="border border-blue-800/30" style={{ backgroundColor: '#152032' }}>
                <CardHeader><CardTitle className="text-white text-base">📊 Quantidade por Tipo de Serviço</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-blue-800/40 text-gray-400 text-xs uppercase">
                          <th className="text-left py-2 px-3">Tipo de Serviço</th>
                          <th className="text-left py-2 px-3">Categoria</th>
                          <th className="text-center py-2 px-3">Quantidade</th>
                          <th className="text-right py-2 px-3">Valor Total</th>
                          <th className="text-right py-2 px-3">% do Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dadosPorTipo.map((row, i) => {
                          const cat = CATEGORIAS.find(c => c.label === getCategoria(row.name));
                          return (
                            <tr key={i} className="border-b border-blue-900/20 hover:bg-blue-900/10 transition-colors">
                              <td className="py-2 px-3 text-gray-200">{row.name}</td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: (cat?.color || '#6b7280') + '30', color: cat?.color || '#6b7280' }}>
                                  {getCategoria(row.name)}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="text-cyan-400 font-bold text-base">{row.quantidade}</span>
                                <div className="w-full bg-slate-700/50 rounded-full h-1 mt-1">
                                  <div className="h-1 rounded-full bg-cyan-500" style={{ width: `${Math.round((row.quantidade / metrics.total) * 100)}%` }} />
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right text-green-400 font-medium">
                                R$ {row.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-right text-gray-400">
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
            <Card className="border border-blue-800/30" style={{ backgroundColor: '#152032' }}>
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center justify-between">
                  <span>📋 Serviços Detalhados</span>
                  <span className="text-sm font-normal text-gray-400">{servicosFiltrados.length} registros</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-blue-800/40 text-gray-400 text-xs uppercase">
                        <th className="text-left py-2 px-3">Cliente</th>
                        <th className="text-left py-2 px-3">Tipo de Serviço</th>
                        <th className="text-left py-2 px-3">Categoria</th>
                        <th className="text-left py-2 px-3">Data</th>
                        <th className="text-left py-2 px-3">Status</th>
                        <th className="text-right py-2 px-3">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicosFiltrados.map(s => {
                        const cat = CATEGORIAS.find(c => c.label === getCategoria(s.tipo_servico));
                        return (
                          <tr key={s.id} className="border-b border-blue-900/20 hover:bg-blue-900/10 transition-colors">
                            <td className="py-2 px-3 text-gray-200 font-medium">{s.cliente_nome}</td>
                            <td className="py-2 px-3 text-gray-300 text-xs">{s.tipo_servico}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: (cat?.color || '#6b7280') + '25', color: cat?.color || '#6b7280' }}>
                                {getCategoria(s.tipo_servico)}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-gray-400">{format(parseISO(s.data_programada), 'dd/MM/yyyy')}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                s.status === 'concluido' ? 'bg-green-900/40 text-green-300' :
                                s.status === 'andamento' ? 'bg-blue-900/40 text-blue-300' :
                                'bg-yellow-900/40 text-yellow-300'
                              }`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-green-400 font-semibold">
                              {s.valor ? `R$ ${s.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                      {servicosFiltrados.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nenhum serviço no período com os filtros selecionados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}