import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Calendar, User, DollarSign, CheckCircle2, Clock, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { gerarPDFCliente, gerarPDFTodos } from '@/components/utils/HistoricoDownload';

export default function HistoricoClientes() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list('-data_programada'),
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list('-data_atendimento'),
  });

  // Combinar histórico
  const historico = [
    ...servicos.map(s => ({
      id: `s-${s.id}`,
      tipo: 'Serviço',
      cliente: s.cliente_nome,
      descricao: s.tipo_servico,
      data: s.data_programada,
      status: s.status,
      valor: s.valor,
      usuario: s.usuario_atualizacao_status,
      data_atualizacao: s.data_atualizacao_status
    })),
    ...atendimentos.map(a => ({
      id: `a-${a.id}`,
      tipo: 'Atendimento',
      cliente: a.cliente_nome,
      descricao: a.tipo_servico,
      data: a.data_atendimento,
      status: a.status,
      valor: a.valor,
      usuario: a.usuario_atualizacao_status,
      data_atualizacao: a.data_atualizacao_status
    }))
  ];

  // Agrupar por cliente
  const clientesAgrupados = useMemo(() => {
    const grupos = {};
    
    historico.forEach(item => {
      if (!item.cliente) return;
      
      if (!grupos[item.cliente]) {
        grupos[item.cliente] = [];
      }
      grupos[item.cliente].push(item);
    });

    // Ordenar itens dentro de cada cliente e filtrar
    Object.keys(grupos).forEach(cliente => {
      grupos[cliente].sort((a, b) => new Date(b.data_atualizacao || b.data) - new Date(a.data_atualizacao || a.data));
    });

    // Filtrar clientes que correspondem ao termo de busca
    const clientesFiltrados = {};
    Object.keys(grupos).forEach(cliente => {
      if (cliente.toLowerCase().includes(searchTerm.toLowerCase())) {
        clientesFiltrados[cliente] = grupos[cliente];
      } else {
        // Filtrar itens dentro do cliente
        const itens = grupos[cliente].filter(item =>
          item.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (itens.length > 0) {
          clientesFiltrados[cliente] = itens;
        }
      }
    });

    return clientesFiltrados;
  }, [historico, searchTerm]);

  const statusCores = {
    'aberto': 'bg-gray-100 text-gray-700',
    'andamento': 'bg-blue-100 text-blue-700',
    'concluido': 'bg-green-100 text-green-700',
    'pausado': 'bg-yellow-100 text-yellow-700',
    'Aberto': 'bg-gray-100 text-gray-700',
    'Em Andamento': 'bg-blue-100 text-blue-700',
    'Concluído': 'bg-green-100 text-green-700',
    'Pausado': 'bg-yellow-100 text-yellow-700'
  };

  const totalServiços = historico.length;
  const totalValor = historico.reduce((sum, item) => sum + (item.valor || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">📋 Histórico de Clientes</h1>
        <p className="text-gray-500 mt-1">Garantia e proteção - Histórico completo de técnicos, serviços e datas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Serviços</p>
                <p className="text-2xl font-bold text-blue-600">{totalServiços}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valor Total</p>
                <p className="text-2xl font-bold text-green-600">R$ {totalValor.toLocaleString('pt-BR')}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Clientes</p>
                <p className="text-2xl font-bold text-purple-600">{Object.keys(clientesAgrupados).length}</p>
              </div>
              <User className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search e Botão Download */}
      <div className="flex gap-4 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Buscar por cliente ou serviço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 bg-white border-gray-200"
          />
        </div>
        <Button
          onClick={() => gerarPDFTodos(clientesAgrupados)}
          className="bg-green-600 hover:bg-green-700 whitespace-nowrap gap-2"
        >
          <FileText className="w-4 h-4" />
          Baixar Todos
        </Button>
      </div>

      {/* Cliente Cards */}
      <div className="space-y-6">
        {Object.keys(clientesAgrupados).length === 0 ? (
          <Card className="bg-white border-0 shadow-md">
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">Nenhum histórico encontrado</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(clientesAgrupados).map(([cliente, itens]) => (
            <Card key={cliente} className="bg-white border-0 shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                      {cliente?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{cliente}</CardTitle>
                      <p className="text-sm text-slate-300 mt-1">{itens.length} serviço(s) registrado(s) | Total: R$ {itens.reduce((sum, item) => sum + (item.valor || 0), 0).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-cyan-500 text-white border-0">{itens.length}</Badge>
                    <Button
                      onClick={() => gerarPDFCliente(cliente, 
                        servicos.filter(s => s.cliente_nome === cliente),
                        atendimentos.filter(a => a.cliente_nome === cliente)
                      )}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 gap-1"
                    >
                      <Download className="w-4 h-4" />
                      PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="space-y-4">
                  {itens.map((item, index) => (
                    <div key={item.id} className="relative">
                      {/* Timeline line */}
                      {index !== itens.length - 1 && (
                        <div className="absolute left-6 top-16 w-0.5 h-8 bg-gradient-to-b from-blue-200 to-transparent" />
                      )}

                      <div className="flex gap-4">
                        {/* Timeline dot */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                          item.status === 'concluido' || item.status === 'Concluído'
                            ? 'bg-green-100'
                            : item.status === 'andamento' || item.status === 'Em Andamento'
                            ? 'bg-blue-100'
                            : 'bg-gray-100'
                        }`}>
                          <CheckCircle2 className={`w-6 h-6 ${
                            item.status === 'concluido' || item.status === 'Concluído'
                              ? 'text-green-600'
                              : item.status === 'andamento' || item.status === 'Em Andamento'
                              ? 'text-blue-600'
                              : 'text-gray-600'
                          }`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-100">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-gray-800">{item.descricao}</h4>
                              <Badge className={`${statusCores[item.status]} border text-xs mt-2`}>
                                {item.status}
                              </Badge>
                            </div>
                            {item.valor && (
                              <span className="font-bold text-green-600">
                                R$ {item.valor.toLocaleString('pt-BR')}
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-500" />
                              <span><strong>Data do Serviço:</strong> {format(new Date(item.data), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            </div>

                            {item.data_atualizacao && (
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-purple-500" />
                                <span><strong>Última Atualização:</strong> {format(new Date(item.data_atualizacao), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}</span>
                              </div>
                            )}

                            {item.usuario && (
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-orange-500" />
                                <span><strong>Técnico:</strong> {item.usuario}</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                              {item.tipo}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}