import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, Calendar, CheckCircle, Clock, Award, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, parseISO, getWeek, getYear, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MeusGanhos() {
  const [user, setUser] = useState(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState('semana-atual');
  const [equipeFilter, setEquipeFilter] = useState('todas');
  const [editandoGanho, setEditandoGanho] = useState(null);
  const [valorEditado, setValorEditado] = useState('');
  const [valoresPagos, setValoresPagos] = useState({});
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: ganhos = [], isLoading } = useQuery({
    queryKey: ['ganhos-tecnicos'],
    queryFn: () => base44.entities.GanhoTecnico.list(),
    enabled: !!user,
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list(),
    enabled: !!user,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  const meuEmail = user?.email;
  const isAdmin = user?.role === 'admin';
  const minhaEquipeId = user?.equipe_id;

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.GanhoTecnico.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganhos-tecnicos'] });
      toast.success('Ganho excluído com sucesso');
    },
    onError: () => {
      toast.error('Erro ao excluir ganho');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GanhoTecnico.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganhos-tecnicos'] });
      setEditandoGanho(null);
      setValorEditado('');
      toast.success('Ganho atualizado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao atualizar ganho');
    }
  });

  const handleEditarGanho = (ganho) => {
    setEditandoGanho(ganho);
    setValorEditado(ganho.valor_servico?.toString() || '');
  };

  const handleSalvarEdicao = () => {
    if (!editandoGanho || !valorEditado) return;
    
    const novoValor = parseFloat(valorEditado);
    if (isNaN(novoValor) || novoValor < 0) {
      toast.error('Digite um valor válido');
      return;
    }

    const novaComissao = (novoValor * (editandoGanho.comissao_percentual || 30)) / 100;
    
    updateMutation.mutate({
      id: editandoGanho.id,
      data: {
        ...editandoGanho,
        valor_servico: novoValor,
        valor_comissao: novaComissao
      }
    });
  };

  const handleExcluirGanho = (ganhoId) => {
    if (confirm('Tem certeza que deseja excluir este ganho?')) {
      deleteMutation.mutate(ganhoId);
    }
  };

  const handleValorPagoChange = (equipeId, valor) => {
    setValoresPagos(prev => ({
      ...prev,
      [equipeId]: valor
    }));
  };

  const handleConfirmarPagamento = (equipeId) => {
    const valor = parseFloat(valoresPagos[equipeId] || 0);
    if (valor <= 0) {
      toast.error('Digite um valor válido');
      return;
    }
    toast.success(`Pagamento de R$ ${valor.toFixed(2)} confirmado`);
  };

  // Filtrar ganhos baseado em permissão
  const ganhosPermitidos = useMemo(() => {
    if (!user) return [];
    
    // Admin vê tudo
    if (isAdmin) return ganhos;
    
    // Técnico vê apenas da sua equipe
    if (minhaEquipeId) {
      const tecnicosEquipe = usuarios.filter(u => u.equipe_id === minhaEquipeId).map(u => u.email);
      return ganhos.filter(g => tecnicosEquipe.includes(g.tecnico_email));
    }
    
    // Se não tem equipe, vê apenas os próprios
    return ganhos.filter(g => g.tecnico_email === meuEmail);
  }, [ganhos, user, isAdmin, minhaEquipeId, usuarios, meuEmail]);

  // Calcular períodos (semana começa na segunda-feira)
  const hoje = new Date();
  const inicioSemanaAtual = startOfWeek(hoje, { weekStartsOn: 1 }); // 1 = Segunda
  const fimSemanaAtual = endOfWeek(hoje, { weekStartsOn: 1 });
  const inicioMesAtual = startOfMonth(hoje);
  const fimMesAtual = endOfMonth(hoje);
  const inicioAnoAtual = startOfYear(hoje);
  const fimAnoAtual = endOfYear(hoje);

  // Filtrar por período e equipe
  const ganhosFiltrados = useMemo(() => {
    let resultado = ganhosPermitidos;
    
    // Filtro de período
    if (filtroPeriodo === 'semana-atual') {
      resultado = resultado.filter(g => {
        const dataGanho = parseISO(g.data_conclusao);
        return isWithinInterval(dataGanho, { start: inicioSemanaAtual, end: fimSemanaAtual });
      });
    } else if (filtroPeriodo === 'mes-atual') {
      resultado = resultado.filter(g => {
        const dataGanho = parseISO(g.data_conclusao);
        return isWithinInterval(dataGanho, { start: inicioMesAtual, end: fimMesAtual });
      });
    } else if (filtroPeriodo === 'ano-atual') {
      resultado = resultado.filter(g => {
        const dataGanho = parseISO(g.data_conclusao);
        return isWithinInterval(dataGanho, { start: inicioAnoAtual, end: fimAnoAtual });
      });
    }
    // 'todos' não filtra
    
    // Filtro de equipe (apenas para admin)
    if (isAdmin && equipeFilter !== 'todas') {
      const tecnicosEquipe = usuarios.filter(u => u.equipe_id === equipeFilter).map(u => u.email);
      resultado = resultado.filter(g => tecnicosEquipe.includes(g.tecnico_email));
    }
    
    return resultado;
  }, [ganhosPermitidos, filtroPeriodo, isAdmin, equipeFilter, usuarios, inicioSemanaAtual, fimSemanaAtual, inicioMesAtual, fimMesAtual, inicioAnoAtual, fimAnoAtual]);



  // Agrupar ganhos por equipe e remover duplicatas (agrupar por cliente + tipo_servico + data)
  const ganhosPorEquipe = useMemo(() => {
    const grupos = {};
    
    // Agrupar ganhos duplicados do mesmo serviço
    const ganhosUnicos = {};
    ganhosFiltrados.forEach(ganho => {
      // Chave única: cliente + tipo_servico + data (sem hora/minuto)
      const dataServico = ganho.data_conclusao ? ganho.data_conclusao.split('T')[0] : 'sem-data';
      const chaveUnica = `${ganho.cliente_nome}-${ganho.tipo_servico}-${dataServico}`;
      
      if (!ganhosUnicos[chaveUnica]) {
        // Usar o valor de comissão já gravado no banco
        ganhosUnicos[chaveUnica] = ganho;
      }
      // Se já existe, não somar (apenas ignorar duplicata)
    });
    
    // Criar grupos por equipe usando os ganhos únicos
    Object.values(ganhosUnicos).forEach(ganho => {
      const usuario = usuarios.find(u => u.email === ganho.tecnico_email);
      const equipeId = usuario?.equipe_id || 'sem-equipe';
      const equipeNome = equipes.find(e => e.id === equipeId)?.nome || 'Sem Equipe';
      
      if (!grupos[equipeId]) {
        grupos[equipeId] = {
          equipeId,
          equipeNome,
          ganhos: [],
          total: 0,
          totalPago: 0,
          totalPendente: 0
        };
      }
      
      grupos[equipeId].ganhos.push(ganho);
      grupos[equipeId].total += ganho.valor_comissao || 0;
      if (ganho.pago) {
        grupos[equipeId].totalPago += ganho.valor_comissao || 0;
      } else {
        grupos[equipeId].totalPendente += ganho.valor_comissao || 0;
      }
    });
    
    return Object.values(grupos);
  }, [ganhosFiltrados, usuarios, equipes]);

  // Calcular totais
  const totalGanhos = ganhosFiltrados.reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
  
  // "Já Recebido" mostra apenas ganhos mensais pagos
  const ganhosMensaisPagos = ganhosPermitidos.filter(g => {
    if (!g.pago) return false;
    const dataGanho = parseISO(g.data_conclusao);
    return isWithinInterval(dataGanho, { start: inicioMesAtual, end: fimMesAtual });
  });
  const totalPagoMensal = ganhosMensaisPagos.reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
  
  // "A Receber" mostra apenas da semana atual (segunda a domingo)
  const ganhosSemanaAtual = ganhosFiltrados.filter(g => {
    if (g.pago) return false;
    const dataGanho = parseISO(g.data_conclusao);
    return isWithinInterval(dataGanho, { start: inicioSemanaAtual, end: fimSemanaAtual });
  });
  const totalPendenteSemanal = ganhosSemanaAtual.reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
  
  // Subtrair valores já pagos do total a receber
  const totalValoresPagos = Object.values(valoresPagos).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  const totalPendenteFinal = totalPendenteSemanal - totalValoresPagos;

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isAdmin ? 'Ganhos das Equipes' : 'Meus Ganhos'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isAdmin ? 'Acompanhe as comissões de todas as equipes' : 'Acompanhe suas comissões semanais'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-5 h-5 text-blue-600" />
          <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana-atual">Semana Atual (Seg-Dom)</SelectItem>
              {isAdmin && (
                <>
                  <SelectItem value="mes-atual">Mês Atual</SelectItem>
                  <SelectItem value="ano-atual">Ano Atual</SelectItem>
                  <SelectItem value="todos">Histórico Completo</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          {isAdmin && equipes.length > 0 && (
            <Select value={equipeFilter} onValueChange={setEquipeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas as Equipes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Equipes</SelectItem>
                {equipes.map(eq => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
              <Award className="w-4 h-4" />
              Total de Ganhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-700">
              R$ {totalGanhos.toFixed(2)}
            </p>
            <p className="text-xs text-green-600 mt-1">{ganhosFiltrados.length} serviços</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Já Recebido (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-700">
              R$ {totalPagoMensal.toFixed(2)}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {ganhosMensaisPagos.length} pagamentos
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              A Receber (Semana)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-700">
              R$ {totalPendenteFinal.toFixed(2)}
            </p>
            <p className="text-xs text-orange-600 mt-1">
              Seg-Dom • {ganhosSemanaAtual.length} pendentes
            </p>
            {totalValoresPagos > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                (R$ {totalPendenteSemanal.toFixed(2)} - R$ {totalValoresPagos.toFixed(2)} pago)
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista de serviços por equipe */}
      {ganhosPorEquipe.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum ganho registrado neste período</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {ganhosPorEquipe.map((grupo) => (
            <Card key={grupo.equipeId} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    {grupo.equipeNome}
                  </CardTitle>
                  <div className="flex gap-4 text-sm items-center">
                    <div className="text-right">
                      <p className="text-blue-100 text-xs">Total</p>
                      <p className="font-bold">R$ {grupo.total.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-100 text-xs">Pago</p>
                      <p className="font-bold">R$ {grupo.totalPago.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-100 text-xs">Pendente</p>
                      <p className="font-bold">R$ {grupo.totalPendente.toFixed(2)}</p>
                    </div>
                    {isAdmin && (
                      <div className="ml-4 flex items-end gap-2">
                        <div>
                          <Label className="text-blue-100 text-xs block mb-1">Valor Pago</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={valoresPagos[grupo.equipeId] || ''}
                            onChange={(e) => handleValorPagoChange(grupo.equipeId, e.target.value)}
                            className="w-28 h-8 text-sm bg-white text-gray-900"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleConfirmarPagamento(grupo.equipeId)}
                          className="h-8 bg-green-600 hover:bg-green-700 text-white"
                        >
                          Confirmar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Cliente</TableHead>
                        <TableHead className="font-semibold">Equipe</TableHead>
                        <TableHead className="font-semibold">Serviço</TableHead>
                        <TableHead className="font-semibold">Data</TableHead>
                        <TableHead className="text-right font-semibold">Valor</TableHead>
                        <TableHead className="text-right font-semibold">Comissão</TableHead>
                        <TableHead className="text-right font-semibold">Ganho</TableHead>
                        <TableHead className="text-center font-semibold">Status</TableHead>
                        {isAdmin && <TableHead className="text-center font-semibold">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupo.ganhos
                        .sort((a, b) => new Date(b.data_conclusao) - new Date(a.data_conclusao))
                        .map((ganho) => {
                          const usuario = usuarios.find(u => u.email === ganho.tecnico_email);
                          const equipeNome = equipes.find(e => e.id === usuario?.equipe_id)?.nome || 'Sem Equipe';
                          
                          return (
                            <TableRow 
                              key={ganho.id}
                              className={ganho.pago ? 'bg-green-50' : 'hover:bg-gray-50'}
                            >
                              <TableCell className="font-medium">{ganho.cliente_nome}</TableCell>
                              <TableCell className="text-sm text-blue-600">{equipeNome}</TableCell>
                              <TableCell className="text-sm">{ganho.tipo_servico}</TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {format(parseISO(ganho.data_conclusao), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              R$ {(ganho.valor_servico || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-gray-600">
                              {ganho.comissao_percentual || 0}%
                            </TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                              R$ {(ganho.valor_comissao || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              {ganho.pago ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                                  <CheckCircle className="w-3 h-3" />
                                  Pago
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                                  <Clock className="w-3 h-3" />
                                  Pendente
                                </span>
                              )}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => handleEditarGanho(ganho)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleExcluirGanho(ganho.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de edição */}
      <Dialog open={!!editandoGanho} onOpenChange={() => setEditandoGanho(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Valor do Serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input value={editandoGanho?.cliente_nome || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Serviço</Label>
              <Input value={editandoGanho?.tipo_servico || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Valor do Serviço (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valorEditado}
                onChange={(e) => setValorEditado(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500">
                Comissão ({editandoGanho?.comissao_percentual || 30}%): R$ {
                  valorEditado ? ((parseFloat(valorEditado) * (editandoGanho?.comissao_percentual || 30)) / 100).toFixed(2) : '0.00'
                }
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditandoGanho(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarEdicao} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}