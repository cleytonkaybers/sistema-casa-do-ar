import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, TrendingUp, DollarSign, CheckCircle, Clock, Filter, BarChart2, List, BookOpen, FileSpreadsheet, Wrench, Search, X, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { matchClienteSearch } from '@/lib/utils/buscaCliente';
import { extrairMarca, isInstalacao, removerMarca, embutirMarca, MARCAS_AR } from '@/lib/marcasAr';
import { toast } from 'sonner';
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
  const [viewMode, setViewMode] = useState('resumo'); // 'resumo' | 'detalhado' | 'instalacoes'
  const [filtroMarca, setFiltroMarca] = useState('todas');
  const [filtroEquipeInst, setFiltroEquipeInst] = useState('todas');
  const [buscaInstalacao, setBuscaInstalacao] = useState('');
  const debouncedBuscaInstalacao = useDebounce(buscaInstalacao);
  const [editarMarcaModal, setEditarMarcaModal] = useState(null); // { instalacao, marcaAtual, novaMarca }
  const [salvandoMarca, setSalvandoMarca] = useState(false);
  const queryClient = useQueryClient();

  // Atualiza a marca de UMA instalacao especifica (identificada por servicoId + idx).
  // Toast em cada etapa pra dar visibilidade do que esta acontecendo.
  const handleSalvarMarca = async () => {
    console.log('[salvar-marca] handler INICIADO', { editarMarcaModal });
    if (!editarMarcaModal) {
      toast.error('Modal vazio — recarregue a pagina');
      return;
    }
    const { instalacao, novaMarca } = editarMarcaModal;
    if (!instalacao || !instalacao.servicoId) {
      toast.error('servicoId nao encontrado na instalacao');
      console.error('[salvar-marca] instalacao invalida:', instalacao);
      return;
    }
    setSalvandoMarca(true);
    toast.info('⏳ Buscando serviço no banco...', { id: 'salvar-marca-progresso', duration: 30000 });
    try {
      // Busca FRESCA — tenta filter primeiro, fallback pra list+find se nao encontrar
      let servico = null;
      try {
        const lista = await base44.entities.Servico.filter({ id: instalacao.servicoId });
        servico = lista && lista[0];
        console.log('[salvar-marca] Servico.filter retornou:', lista);
      } catch (e) {
        console.error('[salvar-marca] Servico.filter falhou:', e);
      }
      if (!servico) {
        // Fallback: busca em servicos do useQuery
        servico = servicos.find(s => s.id === instalacao.servicoId);
        console.log('[salvar-marca] fallback cache local:', servico);
      }
      if (!servico) {
        // Ultimo fallback: list completo
        try {
          toast.info('⏳ Buscando em toda a base...', { id: 'salvar-marca-progresso' });
          const todos = await base44.entities.Servico.list('-data_programada', 5000);
          servico = todos.find(s => s.id === instalacao.servicoId);
          console.log('[salvar-marca] fallback list:', servico ? 'encontrado' : 'NAO encontrado');
        } catch (e) {
          console.error('[salvar-marca] list completo falhou:', e);
        }
      }
      if (!servico) {
        toast.dismiss('salvar-marca-progresso');
        toast.error(`Serviço não encontrado (id: ${instalacao.servicoId}). Recarregue a página.`, { duration: 8000 });
        setSalvandoMarca(false);
        return;
      }
      const partes = (servico.tipo_servico || '').split(' + ').filter(Boolean);
      const partesNovas = partes.map((p, i) => {
        if (i !== instalacao.idx) return p;
        const m = p.match(/^(.+?)\s*\[(.+)\]$/);
        const tipoBase = m ? m[1].trim() : p.trim();
        const equipAtual = m ? m[2].trim() : '';
        const localAtual = removerMarca(equipAtual);
        const novoEquip = embutirMarca(novaMarca, localAtual);
        return novoEquip ? `${tipoBase} [${novoEquip}]` : tipoBase;
      });
      const novoTipoServico = partesNovas.join(' + ');
      console.log('[salvar-marca] UPDATE', { id: servico.id, antes: servico.tipo_servico, depois: novoTipoServico });
      toast.info('⏳ Salvando no banco...', { id: 'salvar-marca-progresso' });
      const resp = await base44.entities.Servico.update(servico.id, { tipo_servico: novoTipoServico });
      console.log('[salvar-marca] Servico.update RESPOSTA:', resp);
      toast.info('⏳ Atualizando tela...', { id: 'salvar-marca-progresso' });
      await queryClient.refetchQueries({ queryKey: ['servicos'] });
      toast.dismiss('salvar-marca-progresso');
      toast.success(`✓ Marca salva: ${novaMarca || 'não informada'}`);
      setEditarMarcaModal(null);
    } catch (err) {
      toast.dismiss('salvar-marca-progresso');
      console.error('[salvar-marca] ERRO FINAL:', err);
      toast.error('Erro ao salvar: ' + (err?.message || JSON.stringify(err) || 'desconhecido'), { duration: 10000 });
    } finally {
      setSalvandoMarca(false);
    }
  };
  const [instalacaoDetalhes, setInstalacaoDetalhes] = useState(null);
  const [notionModal, setNotionModal] = useState(false);

  // Arquivamento de instalacoes (controle de garantia confirmada).
  // Persiste localmente: cada chave de instalacao (servicoId-idx) marcada como
  // arquivada nao aparece na lista principal — fica acessivel pelo toggle.
  const LS_KEY_ARQUIVADAS = 'instalacoes_arquivadas';

  const lerArquivadasDoLocalStorage = () => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_KEY_ARQUIVADAS) || '[]')); }
    catch { return new Set(); }
  };

  const [instalacoesArquivadas, setInstalacoesArquivadas] = useState(lerArquivadasDoLocalStorage);
  const [verArquivadas, setVerArquivadas] = useState(false);

  // Defensivo 1: useEffect persiste sempre que o estado muda
  React.useEffect(() => {
    try { localStorage.setItem(LS_KEY_ARQUIVADAS, JSON.stringify([...instalacoesArquivadas])); } catch (_e) { /* ignore */ }
  }, [instalacoesArquivadas]);

  // Defensivo 2: ao retornar ao tab/janela ou recarregar, re-le do localStorage.
  // Cobre casos onde o componente nao desmontou mas o usuario abriu outra aba
  // e arquivou de la (ou se algo limpou o estado em memoria).
  React.useEffect(() => {
    const onFocus = () => {
      const lido = lerArquivadasDoLocalStorage();
      setInstalacoesArquivadas(prev => {
        if (prev.size === lido.size && [...prev].every(k => lido.has(k))) return prev;
        return lido;
      });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Acao explicita (nao toggle) com persistencia SINCRONA dentro do setter.
  // Dupla garantia: nao depende de useEffect/re-render para persistir.
  const setArquivada = (key, arquivar) => {
    setInstalacoesArquivadas(prev => {
      const ja = prev.has(key);
      if (arquivar === ja) return prev; // sem mudanca
      const next = new Set(prev);
      if (arquivar) next.add(key); else next.delete(key);
      // Persiste IMEDIATAMENTE — nao espera o useEffect rodar
      try { localStorage.setItem(LS_KEY_ARQUIVADAS, JSON.stringify([...next])); } catch (_e) { /* ignore */ }
      return next;
    });
  };

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

    const resumoMarca = contagemPorMarca.map(c => ({
      'Marca': c.marca,
      'Quantidade Instalada': c.qtd,
    }));

    const detalheInstalacoes = instalacoesExpandidas.map(i => ({
      'Data Conclusão': i.dataConclusao ? format(parseISO(i.dataConclusao), 'dd/MM/yyyy') : '-',
      'Data Programada': i.dataProgramada ? format(parseISO(i.dataProgramada), 'dd/MM/yyyy') : '-',
      'OS': i.os || '-',
      'Cliente': i.cliente,
      'Telefone': i.telefone || '-',
      'Endereço': i.endereco || '-',
      'Marca': i.marca,
      'Tipo de Instalação': i.tipo,
      'Local / Ambiente': i.local,
      'Equipe': i.equipe,
      'Valor (R$)': (i.valor || 0).toFixed(2),
      'Observações Conclusão': i.observacoesConclusao || '-',
      'Descrição Original': i.descricao || '-',
    }));

    await exportarExcel(
      [
        { name: 'Resumo por Categoria', data: resumoCat, colWidths: [22, 12, 18, 12] },
        { name: 'Resumo por Tipo', data: resumoTipo, colWidths: [35, 22, 12, 18, 12] },
        { name: 'Serviços Detalhados', data: detalhes, colWidths: [28, 35, 22, 18, 14, 12, 14] },
        { name: 'Instalações por Marca', data: resumoMarca, colWidths: [25, 18] },
        { name: 'Detalhe Instalações', data: detalheInstalacoes, colWidths: [14, 14, 12, 28, 16, 36, 18, 24, 22, 22, 14, 36, 28] },
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

  // Instalacoes expandidas: cada item de instalacao dentro de um servico vira uma linha.
  // Ex: tipo_servico = "Instalacao 9k [Marca: LG | Sala] + Limpeza 9k" gera 1 instalacao.
  // Valor e rateado igualmente entre os itens do servico.
  const instalacoesExpandidas = useMemo(() => {
    const out = [];
    servicosFiltrados
      .filter(s => s.status === 'concluido')
      .forEach(s => {
        const partes = (s.tipo_servico || '').split(' + ').filter(Boolean);
        const totalItens = partes.length || 1;
        const valorPorItem = totalItens > 0 ? (s.valor || 0) / totalItens : (s.valor || 0);
        partes.forEach((p, idx) => {
          const match = p.match(/^(.+?)\s*\[(.+)\]$/);
          const tipoBase = match ? match[1].trim() : p.trim();
          const equipamentoBruto = match ? match[2].trim() : '';
          if (!isInstalacao(tipoBase)) return;
          out.push({
            // Chave nova: estavel mesmo se tipo_servico mudar de ordem. Inclui
            // servicoId + tipoBase + equipamentoBruto. Idx mantido como tiebreaker
            // pra instalacoes 100% identicas no mesmo servico.
            key: `${s.id}::${tipoBase}::${equipamentoBruto}::${idx}`,
            // Compat: chave antiga ${s.id}-${idx} continua sendo aceita pra
            // arquivados que foram salvos antes desta refatoracao.
            legacyKey: `${s.id}-${idx}`,
            idx, // CRITICO: usado em handleSalvarMarca pra saber qual parte editar
            servicoId: s.id,
            os: s.os_numero || '',
            cliente: s.cliente_nome || '-',
            telefone: s.telefone || '',
            endereco: s.endereco || '',
            googleMaps: s.google_maps_link || '',
            marca: extrairMarca(equipamentoBruto) || 'Não informada',
            local: removerMarca(equipamentoBruto) || '-',
            tipo: tipoBase,
            dataProgramada: s.data_programada,
            dataConclusao: s.data_conclusao || s.data_programada,
            diaSemana: s.dia_semana || '',
            horario: s.horario || '',
            equipe: s.equipe_nome || '-',
            equipeId: s.equipe_id || '',
            valor: valorPorItem,
            valorTotalServico: s.valor || 0,
            totalItensServico: totalItens,
            descricao: s.descricao || '',
            observacoesConclusao: s.observacoes_conclusao || '',
            tipoServicoOriginal: s.tipo_servico || '',
          });
        });
      });
    return out;
  }, [servicosFiltrados]);

  const equipesNoPeriodo = useMemo(() => {
    const map = new Map();
    instalacoesExpandidas.forEach(i => {
      if (i.equipe && i.equipe !== '-') map.set(i.equipe, i.equipeId);
    });
    return [...map.keys()].sort();
  }, [instalacoesExpandidas]);

  // Helper: instalacao esta arquivada se a chave NOVA OU a chave ANTIGA estao no Set
  const estaArquivada = (i) => instalacoesArquivadas.has(i.key) || instalacoesArquivadas.has(i.legacyKey);

  const instalacoesFiltradas = useMemo(() =>
    instalacoesExpandidas
      .filter(i => verArquivadas ? estaArquivada(i) : !estaArquivada(i))
      .filter(i => filtroMarca === 'todas' || i.marca === filtroMarca)
      .filter(i => filtroEquipeInst === 'todas' || i.equipe === filtroEquipeInst)
      .filter(i => !debouncedBuscaInstalacao.trim() || matchClienteSearch(i.cliente, i.telefone, debouncedBuscaInstalacao))
      .sort((a, b) => new Date(b.dataConclusao || 0) - new Date(a.dataConclusao || 0))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [instalacoesExpandidas, filtroMarca, filtroEquipeInst, verArquivadas, instalacoesArquivadas, debouncedBuscaInstalacao]);

  const qtdArquivadas = useMemo(
    () => instalacoesExpandidas.filter(i => instalacoesArquivadas.has(i.key) || instalacoesArquivadas.has(i.legacyKey)).length,
    [instalacoesExpandidas, instalacoesArquivadas]
  );

  const totalValorInstalado = useMemo(
    () => instalacoesFiltradas.reduce((s, i) => s + (i.valor || 0), 0),
    [instalacoesFiltradas]
  );
  const ticketMedio = instalacoesFiltradas.length > 0
    ? totalValorInstalado / instalacoesFiltradas.length
    : 0;

  const marcasNoPeriodo = useMemo(() => {
    const set = new Set(instalacoesExpandidas.map(i => i.marca));
    return [...set].sort();
  }, [instalacoesExpandidas]);

  const contagemPorMarca = useMemo(() => {
    const map = {};
    instalacoesExpandidas.forEach(i => {
      map[i.marca] = (map[i.marca] || 0) + 1;
    });
    return Object.entries(map)
      .map(([marca, qtd]) => ({ marca, qtd }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [instalacoesExpandidas]);

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
            <Button onClick={() => setViewMode('instalacoes')} className={`h-9 text-sm rounded-xl gap-2 ${viewMode === 'instalacoes' ? 'bg-yellow-400 text-gray-900 font-bold' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}>
              <Wrench className="w-4 h-4" /> Instalações por Marca
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

                {viewMode === 'instalacoes' && (
                <div className="space-y-4">
                  {/* Cards de resumo: total, valor total, ticket medio, marca top */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                      <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Total Instalado</p>
                      <p className="text-3xl font-bold text-emerald-700">{instalacoesFiltradas.length}</p>
                      <p className="text-[10px] text-emerald-600/70">ar-condicionados</p>
                    </div>
                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50">
                      <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Valor Total</p>
                      <p className="text-3xl font-bold text-blue-700">
                        {totalValorInstalado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                      <p className="text-[10px] text-blue-600/70">valor instalado</p>
                    </div>
                    <div className="p-4 rounded-xl border border-purple-200 bg-purple-50">
                      <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider">Ticket Médio</p>
                      <p className="text-3xl font-bold text-purple-700">
                        {ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                      <p className="text-[10px] text-purple-600/70">por instalação</p>
                    </div>
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
                      <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider">Marca Top</p>
                      <p className="text-2xl font-bold text-amber-700 truncate">
                        {contagemPorMarca[0]?.marca || '-'}
                      </p>
                      <p className="text-[10px] text-amber-600/70">{contagemPorMarca[0]?.qtd || 0} unidades</p>
                    </div>
                  </div>

                  {/* Marcas — grid de chips */}
                  {contagemPorMarca.length > 0 && (
                    <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-gray-800 text-sm font-semibold">Distribuição por Marca</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {contagemPorMarca.map(c => (
                            <button
                              key={c.marca}
                              onClick={() => setFiltroMarca(filtroMarca === c.marca ? 'todas' : c.marca)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                filtroMarca === c.marca
                                  ? 'bg-emerald-600 border-emerald-500 text-white'
                                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-emerald-50 hover:border-emerald-300'
                              }`}
                            >
                              {c.marca}
                              <span className={`ml-2 px-1.5 py-0.5 rounded ${
                                filtroMarca === c.marca ? 'bg-white/20' : 'bg-gray-200'
                              }`}>{c.qtd}</span>
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tabela detalhada com filtros locais */}
                  <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <CardTitle className="text-gray-800 text-base font-semibold flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-emerald-500" />
                          {verArquivadas ? 'Instalações Arquivadas (Garantia Confirmada)' : 'Relatório Completo de Instalações'}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => setVerArquivadas(!verArquivadas)}
                            size="sm"
                            variant="outline"
                            className={`h-8 text-xs gap-1.5 rounded-lg ${verArquivadas ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100' : 'border-gray-300'}`}
                          >
                            {verArquivadas ? '📋 Ver Ativas' : `📦 Ver Arquivadas (${qtdArquivadas})`}
                          </Button>
                          <Button onClick={handleExportarExcel} size="sm" className="h-8 text-xs gap-1.5 rounded-lg" style={{ backgroundColor: '#22c55e', color: '#fff' }}>
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Excel
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {verArquivadas
                          ? `Visualizando ${qtdArquivadas} instalação(ões) marcada(s) como concluída(s).`
                          : <>Período: {format(dateRange.start, 'dd/MM/yyyy')} — {format(dateRange.end, 'dd/MM/yyyy')}. Use os filtros do topo da página para ajustar.</>}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {/* Busca por nome/telefone */}
                      <div className="relative mb-3">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                          type="text"
                          value={buscaInstalacao}
                          onChange={e => setBuscaInstalacao(e.target.value)}
                          placeholder="Buscar por nome do cliente ou telefone..."
                          className="pl-9 pr-9 h-9 text-sm bg-slate-800 border-slate-600 text-white placeholder:text-gray-500"
                        />
                        {buscaInstalacao && (
                          <button
                            onClick={() => setBuscaInstalacao('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                            title="Limpar busca"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {/* Filtros locais */}
                      <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Marca:</span>
                          <select
                            value={filtroMarca}
                            onChange={e => setFiltroMarca(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-1.5 text-xs"
                          >
                            <option value="todas">Todas</option>
                            {marcasNoPeriodo.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Equipe:</span>
                          <select
                            value={filtroEquipeInst}
                            onChange={e => setFiltroEquipeInst(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-1.5 text-xs"
                          >
                            <option value="todas">Todas</option>
                            {equipesNoPeriodo.map(eq => (
                              <option key={eq} value={eq}>{eq}</option>
                            ))}
                          </select>
                        </div>
                        <span className="text-xs text-gray-400 ml-auto">
                          {instalacoesFiltradas.length} instalação(ões) · {totalValorInstalado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase bg-gray-50">
                              <th className="text-left py-2.5 px-3">Data</th>
                              <th className="text-left py-2.5 px-3">Cliente / Telefone</th>
                              <th className="text-left py-2.5 px-3">Marca</th>
                              <th className="text-left py-2.5 px-3">Tipo / Local</th>
                              <th className="text-left py-2.5 px-3">Equipe</th>
                              <th className="text-right py-2.5 px-3">Valor</th>
                              <th className="text-center py-2.5 px-3">{verArquivadas ? 'Restaurar' : 'Concluir'}</th>
                              <th className="text-center py-2.5 px-3">Detalhes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {instalacoesFiltradas.map(i => (
                              <tr key={i.key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="py-2.5 px-3 text-gray-600 text-xs whitespace-nowrap">
                                  <div className="font-semibold text-gray-700">
                                    {i.dataConclusao ? format(parseISO(i.dataConclusao), 'dd/MM/yyyy') : '-'}
                                  </div>
                                  {i.os && <div className="text-[10px] text-gray-400">OS {i.os}</div>}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-gray-800">{i.cliente}</div>
                                  {i.telefone && <div className="text-[11px] text-gray-500">{i.telefone}</div>}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                      i.marca === 'Não informada'
                                        ? 'bg-gray-100 text-gray-500'
                                        : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      {i.marca}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setSalvandoMarca(false); // reset caso tenha travado
                                        setEditarMarcaModal({
                                          instalacao: i,
                                          marcaAtual: i.marca === 'Não informada' ? '' : i.marca,
                                          novaMarca: i.marca === 'Não informada' ? '' : i.marca,
                                        });
                                      }}
                                      className="text-gray-400 hover:text-blue-600 transition-colors"
                                      title="Editar marca"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="text-gray-700 text-xs font-medium">{i.tipo}</div>
                                  {i.local && i.local !== '-' && (
                                    <div className="text-[11px] text-gray-500">📍 {i.local}</div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-gray-600 text-xs">{i.equipe}</td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="text-green-600 font-semibold text-sm">
                                    {(i.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </div>
                                  {i.totalItensServico > 1 && (
                                    <div className="text-[10px] text-gray-400" title="Valor rateado entre os itens do serviço">
                                      rateio de {i.totalItensServico} itens
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      // Arquivar: marca a chave NOVA. Desarquivar: limpa
                                      // AMBAS as chaves (nova + legacy) para nao deixar
                                      // residuo de versao antiga.
                                      if (verArquivadas) {
                                        setArquivada(i.key, false);
                                        if (i.legacyKey) setArquivada(i.legacyKey, false);
                                      } else {
                                        setArquivada(i.key, true);
                                      }
                                    }}
                                    className={`h-7 text-xs ${verArquivadas ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                    title={verArquivadas ? 'Restaurar para lista ativa' : 'Marcar como concluída e arquivar'}
                                  >
                                    {verArquivadas ? '↩ Restaurar' : '✓ Concluir'}
                                  </Button>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setInstalacaoDetalhes(i)}
                                    className="h-7 text-xs text-blue-600 hover:bg-blue-50"
                                  >
                                    Ver
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {instalacoesFiltradas.length === 0 && (
                              <tr><td colSpan={8} className="text-center py-8 text-gray-400">
                                {verArquivadas
                                  ? 'Nenhuma instalação arquivada ainda.'
                                  : 'Nenhuma instalação concluída no período com os filtros selecionados.'}
                              </td></tr>
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

                {/* Modal Editar Marca da Instalacao */}
                <Dialog open={!!editarMarcaModal} onOpenChange={() => !salvandoMarca && setEditarMarcaModal(null)}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Pencil className="w-4 h-4 text-blue-500" />
                        Editar Marca do Ar
                      </DialogTitle>
                    </DialogHeader>
                    {editarMarcaModal && (
                      <div className="space-y-3 py-2">
                        <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                          <div><strong>Cliente:</strong> {editarMarcaModal.instalacao.cliente}</div>
                          <div><strong>Tipo:</strong> {editarMarcaModal.instalacao.tipo}</div>
                          <div><strong>Marca atual:</strong> {editarMarcaModal.marcaAtual || <span className="italic text-gray-500">não informada</span>}</div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Nova marca</label>
                          <select
                            value={editarMarcaModal.novaMarca}
                            onChange={e => setEditarMarcaModal(prev => ({ ...prev, novaMarca: e.target.value }))}
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="">— Não informada —</option>
                            {MARCAS_AR.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                            {/* Permite manter marca custom ja salva mesmo nao estando em MARCAS_AR */}
                            {editarMarcaModal.marcaAtual && !MARCAS_AR.includes(editarMarcaModal.marcaAtual) && (
                              <option value={editarMarcaModal.marcaAtual}>{editarMarcaModal.marcaAtual} (atual)</option>
                            )}
                          </select>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Quer outra marca? Digite abaixo:
                          </p>
                          <Input
                            type="text"
                            placeholder="Ou digite uma marca personalizada"
                            value={editarMarcaModal.novaMarca}
                            onChange={e => setEditarMarcaModal(prev => ({ ...prev, novaMarca: e.target.value }))}
                            className="mt-1 text-sm"
                          />
                        </div>
                        <DialogFooter className="gap-2">
                          <Button variant="outline" onClick={() => setEditarMarcaModal(null)} disabled={salvandoMarca}>
                            Cancelar
                          </Button>
                          <Button onClick={handleSalvarMarca} disabled={salvandoMarca} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {salvandoMarca ? '⏳ Salvando...' : 'Salvar marca'}
                          </Button>
                        </DialogFooter>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                {/* Modal de detalhes da instalacao */}
                <Dialog open={!!instalacaoDetalhes} onOpenChange={() => setInstalacaoDetalhes(null)}>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-emerald-500" />
                        Detalhes da Instalação
                      </DialogTitle>
                    </DialogHeader>
                    {instalacaoDetalhes && (
                      <div className="space-y-4 py-2">
                        {/* Banner principal */}
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
                          <p className="text-white/80 text-xs mb-1">{instalacaoDetalhes.tipo}</p>
                          <h3 className="font-bold text-xl">{instalacaoDetalhes.cliente}</h3>
                          <p className="text-2xl font-bold mt-2">
                            {(instalacaoDetalhes.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          {instalacaoDetalhes.totalItensServico > 1 && (
                            <p className="text-white/70 text-[11px] mt-1">
                              Valor rateado de R$ {instalacaoDetalhes.valorTotalServico.toFixed(2)} entre {instalacaoDetalhes.totalItensServico} itens
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <Field label="Marca" value={instalacaoDetalhes.marca} />
                          <Field label="Local / Ambiente" value={instalacaoDetalhes.local !== '-' ? instalacaoDetalhes.local : 'Não informado'} />
                          <Field label="Equipe" value={instalacaoDetalhes.equipe} />
                          <Field label="OS" value={instalacaoDetalhes.os || '-'} />
                          <Field
                            label="Data Programada"
                            value={instalacaoDetalhes.dataProgramada
                              ? format(parseISO(instalacaoDetalhes.dataProgramada), 'dd/MM/yyyy')
                              : '-'}
                          />
                          <Field
                            label="Data Conclusão"
                            value={instalacaoDetalhes.dataConclusao
                              ? format(parseISO(instalacaoDetalhes.dataConclusao), 'dd/MM/yyyy')
                              : '-'}
                          />
                          {instalacaoDetalhes.diaSemana && (
                            <Field label="Dia da Semana" value={instalacaoDetalhes.diaSemana} />
                          )}
                          {instalacaoDetalhes.horario && (
                            <Field label="Horário" value={instalacaoDetalhes.horario} />
                          )}
                          {instalacaoDetalhes.telefone && (
                            <Field label="Telefone" value={instalacaoDetalhes.telefone} />
                          )}
                        </div>

                        {instalacaoDetalhes.endereco && (
                          <div className="rounded-lg bg-gray-50 p-3 border border-gray-100">
                            <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">📍 Endereço</p>
                            <p className="text-gray-700 text-sm">{instalacaoDetalhes.endereco}</p>
                            {instalacaoDetalhes.googleMaps && (
                              <a
                                href={instalacaoDetalhes.googleMaps}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block mt-2 text-xs text-blue-600 underline"
                              >
                                Abrir no Google Maps →
                              </a>
                            )}
                          </div>
                        )}

                        {instalacaoDetalhes.descricao && (
                          <div className="rounded-lg bg-blue-50 p-3 border border-blue-100">
                            <p className="text-xs text-blue-500 mb-1 uppercase tracking-wider">Descrição original</p>
                            <p className="text-gray-700 text-sm whitespace-pre-wrap">{instalacaoDetalhes.descricao}</p>
                          </div>
                        )}

                        {instalacaoDetalhes.observacoesConclusao && (
                          <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
                            <p className="text-xs text-emerald-600 mb-1 uppercase tracking-wider">Observações da Conclusão</p>
                            <p className="text-gray-700 text-sm whitespace-pre-wrap">{instalacaoDetalhes.observacoesConclusao}</p>
                          </div>
                        )}

                        {instalacaoDetalhes.totalItensServico > 1 && (
                          <div className="rounded-lg bg-amber-50 p-3 border border-amber-100">
                            <p className="text-xs text-amber-600 mb-1 uppercase tracking-wider">Serviço completo</p>
                            <p className="text-gray-700 text-xs">{instalacaoDetalhes.tipoServicoOriginal}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInstalacaoDetalhes(null)}>Fechar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                </div>
                );
                }

function Field({ label, value }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-100">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-gray-700 text-sm font-medium mt-0.5">{value || '-'}</p>
    </div>
  );
}