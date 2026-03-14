import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Calendar, Filter, DollarSign, Users, Loader2 } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function RelatoriosGanhos() {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('todas');
  const [filtroTecnico, setFiltroTecnico] = useState('todos');
  const [gerando, setGerando] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: ganhos = [] } = useQuery({
    queryKey: ['ganhos-relatorio'],
    queryFn: () => base44.entities.GanhoTecnico.list('-data_conclusao'),
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const isAdmin = user?.role === 'admin';

  // Filtrar ganhos
  const ganhosFiltrados = ganhos.filter(g => {
    // Filtro de data
    if (dataInicio && dataFim) {
      const dataGanho = parseISO(g.data_conclusao);
      const inicio = new Date(dataInicio);
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      
      if (!isWithinInterval(dataGanho, { start: inicio, end: fim })) {
        return false;
      }
    }

    // Filtro de equipe
    if (filtroEquipe !== 'todas' && g.equipe_id !== filtroEquipe) {
      return false;
    }

    // Filtro de técnico
    if (filtroTecnico !== 'todos' && g.tecnico_email !== filtroTecnico) {
      return false;
    }

    return true;
  });

  // Estatísticas
  const totalServicos = ganhosFiltrados.length;
  const totalValor = ganhosFiltrados.reduce((sum, g) => sum + (g.valor_servico || 0), 0);
  const totalComissao = ganhosFiltrados.reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
  const totalPago = ganhosFiltrados.filter(g => g.pago).reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
  const totalPendente = totalComissao - totalPago;

  // Agrupar por técnico
  const ganhosPorTecnico = ganhosFiltrados.reduce((acc, ganho) => {
    const email = ganho.tecnico_email || 'sistema@app.com';
    if (!acc[email]) {
      acc[email] = {
        nome: ganho.tecnico_nome || 'Sistema',
        email,
        ganhos: [],
        total: 0,
        pago: 0,
        pendente: 0
      };
    }
    acc[email].ganhos.push(ganho);
    acc[email].total += ganho.valor_comissao || 0;
    if (ganho.pago) {
      acc[email].pago += ganho.valor_comissao || 0;
    } else {
      acc[email].pendente += ganho.valor_comissao || 0;
    }
    return acc;
  }, {});

  const tecnicos = Object.values(ganhosPorTecnico).sort((a, b) => b.total - a.total);

  const handleGerarPDF = async () => {
    if (!dataInicio || !dataFim) {
      toast.error('Selecione o período do relatório');
      return;
    }

    setGerando(true);
    try {
      const response = await base44.functions.invoke('gerarRelatorioPDFGanhos', {
        dataInicio,
        dataFim,
        filtroEquipe,
        filtroTecnico,
        ganhos: ganhosFiltrados,
        tecnicos: tecnicos,
        resumo: {
          totalServicos,
          totalValor,
          totalComissao,
          totalPago,
          totalPendente
        }
      });

      if (response.data.pdfUrl) {
        window.open(response.data.pdfUrl, '_blank');
        toast.success('Relatório PDF gerado com sucesso!');
      } else {
        toast.error('Erro ao gerar PDF');
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar relatório: ' + error.message);
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios de Ganhos</h1>
          <p className="text-gray-600 mt-1">Gere relatórios detalhados em PDF com filtros personalizados</p>
        </div>
        <FileText className="w-10 h-10 text-blue-600" />
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Data Início *</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Data Fim *</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Equipe</Label>
                <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Equipes</SelectItem>
                    {equipes.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Técnico</Label>
                <Select value={filtroTecnico} onValueChange={setFiltroTecnico}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Técnicos</SelectItem>
                    {usuarios.filter(u => u.role !== 'admin').map(u => (
                      <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button 
            onClick={handleGerarPDF}
            disabled={gerando || !dataInicio || !dataFim}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {gerando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Gerar Relatório PDF
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview dos Dados */}
      {ganhosFiltrados.length > 0 && (
        <>
          {/* Resumo Geral */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Total Serviços</p>
                  <p className="text-3xl font-bold text-blue-600">{totalServicos}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Valor Total</p>
                  <p className="text-2xl font-bold text-gray-900">R$ {totalValor.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Comissão Total</p>
                  <p className="text-2xl font-bold text-purple-600">R$ {totalComissao.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Pago</p>
                  <p className="text-2xl font-bold text-green-600">R$ {totalPago.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Pendente</p>
                  <p className="text-2xl font-bold text-orange-600">R$ {totalPendente.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumo por Técnico */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Resumo por Técnico ({tecnicos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tecnicos.map(tecnico => (
                  <div key={tecnico.email} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-gray-900">{tecnico.nome}</p>
                        <p className="text-sm text-gray-600">{tecnico.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">{tecnico.ganhos.length} serviços</p>
                        <p className="text-lg font-bold text-blue-600">R$ {tecnico.total.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-green-100 rounded p-2 text-center">
                        <p className="text-xs text-green-700">Pago</p>
                        <p className="font-bold text-green-700">R$ {tecnico.pago.toFixed(2)}</p>
                      </div>
                      <div className="bg-orange-100 rounded p-2 text-center">
                        <p className="text-xs text-orange-700">Pendente</p>
                        <p className="font-bold text-orange-700">R$ {tecnico.pendente.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {ganhosFiltrados.length === 0 && dataInicio && dataFim && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum ganho encontrado no período selecionado</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}