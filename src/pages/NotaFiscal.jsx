import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { listAll } from '@/lib/utils/listAll';
import { useAuth } from '@/lib/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import TechnicianAccessBlock from '@/components/TechnicianAccessBlock';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { matchClienteSearch, chaveIdentidadeCliente } from '@/lib/utils/buscaCliente';
import {
  Search, FileText, MessageCircle, Copy, Check, Archive,
  RotateCcw, Loader2, Receipt, MapPin, Calendar, CreditCard,
} from 'lucide-react';

// Meios de pagamento que entram no caixa da empresa e, portanto, geram nota.
// Dinheiro fica de fora por decisao do ADM, e o que o tecnico recebe na mao
// tambem (marcado em pago_direto_tecnico no momento do pagamento).
const METODOS_NF = ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Máquina de Cartão', 'Transferência'];
const METODO_DINHEIRO = 'Dinheiro';
const TODOS_METODOS = [...METODOS_NF, METODO_DINHEIRO];

// Data de corte: o ADM decidiu nao emitir nota do que ja passou, entao a fila
// comeca a contar daqui pra frente. Nada foi apagado nem marcado no banco — os
// pagamentos anteriores a esta data simplesmente nao entram nesta tela.
// Para voltar a contar de outra data, basta mudar o valor abaixo (aaaa-mm-dd).
const NF_DATA_INICIO = '2026-10-23';
const nfInicio = new Date(`${NF_DATA_INICIO}T00:00:00`);

const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const formatPhone = (p) => {
  if (!p) return '';
  const c = String(p).replace(/\D/g, '');
  const n = c.length > 11 && c.startsWith('55') ? c.slice(2) : c;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return p;
};

const formatCPF = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return v || '';
};

const getWhatsApp = (phone) => {
  if (!phone) return '#';
  const n = String(phone).replace(/\D/g, '');
  const semDdi = n.length > 11 && n.startsWith('55') ? n.slice(2) : n;
  return `https://wa.me/55${semDdi}`;
};

// O metodo so virou campo proprio agora. Em pagamentos antigos ele foi gravado
// como prefixo da observacao do historico ("PIX | pagou adiantado"), entao aqui
// a gente olha o campo e, se nao houver, garimpa no historico.
function metodoDoPagamento(p) {
  if (p.metodo_pagamento) return p.metodo_pagamento;
  const hist = (p.historico_pagamentos || []).filter(h => !h.agendada && !h.desconto);
  for (let i = hist.length - 1; i >= 0; i--) {
    const obs = hist[i].observacao || '';
    const achado = TODOS_METODOS.find(m => obs.includes(m));
    if (achado) return achado;
  }
  return '';
}

function dataDoPagamento(p) {
  if (p.data_pagamento_completo) {
    try { return parseISO(p.data_pagamento_completo); } catch { /* segue */ }
  }
  const hist = (p.historico_pagamentos || []).filter(h => !h.agendada && !h.desconto);
  const ultima = hist[hist.length - 1]?.data;
  if (ultima) {
    const [dia, mes, ano] = String(ultima).split(' ')[0].split('/');
    if (ano) return new Date(`${ano}-${mes}-${dia}T12:00:00`);
  }
  if (p.data_conclusao) {
    try { return parseISO(p.data_conclusao); } catch { /* segue */ }
  }
  return null;
}

function BotaoCopiar({ valor, rotulo }) {
  const [copiado, setCopiado] = useState(false);
  if (!valor) return null;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(String(valor));
    } catch {
      // Navegador sem permissao de area de transferencia: usa o caminho antigo.
      const ta = document.createElement('textarea');
      ta.value = String(valor);
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignora */ }
      document.body.removeChild(ta);
    }
    setCopiado(true);
    toast.success(`${rotulo} copiado!`);
    setTimeout(() => setCopiado(false), 1800);
  };
  return (
    <button
      onClick={copiar}
      className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 flex-shrink-0"
      title={`Copiar ${rotulo}`}
    >
      {copiado ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function LinhaNF({ item, emitida, onMarcar, onDesmarcar, processando }) {
  const [aberto, setAberto] = useState(false);
  const data = dataDoPagamento(item);

  return (
    <div className={`border-2 rounded-lg transition-all ${
      aberto ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div
        onClick={() => setAberto(!aberto)}
        className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
          aberto ? 'bg-white border-b border-blue-200' : 'hover:bg-gray-50/50'
        }`}
      >
        {/* Confirmacao de NF — fica na frente das informacoes */}
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {emitida ? (
            <button
              onClick={() => onDesmarcar(item)}
              disabled={processando}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              title="Desfazer — volta para a fila de notas a emitir"
            >
              {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              <span className="hidden sm:inline">Desfazer</span>
            </button>
          ) : (
            <button
              onClick={() => onMarcar(item)}
              disabled={processando}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50"
              title="Confirmar que a nota fiscal deste cliente já foi gerada"
            >
              {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              NF gerada
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
            emitida ? 'bg-gray-400' : 'bg-blue-500'
          }`}>
            {item.cliente_nome?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-gray-800 truncate">{item.cliente_nome || 'Sem nome'}</p>
            <p className="text-xs text-gray-500 truncate">{formatPhone(item.telefone) || 'sem telefone'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="text-left flex-shrink-0">
            <p className="text-xs text-gray-400">Valor pago</p>
            <p className="font-semibold text-sm text-gray-800">{formatCurrency(item.valor_pago)}</p>
          </div>
          <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-xs whitespace-nowrap">
            {metodoDoPagamento(item) || 'não informado'}
          </Badge>
          {!item._quitado && (
            <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs">Parcial</Badge>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {item.telefone && (
            <a
              href={getWhatsApp(item.telefone)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
              title="WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          )}
        </div>
      </div>

      {aberto && (
        <div className="px-4 py-3 bg-white border-t border-blue-200 space-y-2 text-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-gray-600 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> CPF / CNPJ:</span>
            <span className="flex items-center gap-1">
              <span className={`font-mono font-medium ${item._cpf ? 'text-gray-800' : 'text-amber-600'}`}>
                {item._cpf ? formatCPF(item._cpf) : 'não cadastrado'}
              </span>
              <BotaoCopiar valor={item._cpf} rotulo="CPF" />
            </span>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-gray-600 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Telefone:</span>
            <span className="flex items-center gap-1">
              <span className="font-medium text-gray-800">{formatPhone(item.telefone) || '-'}</span>
              <BotaoCopiar valor={formatPhone(item.telefone)} rotulo="Telefone" />
            </span>
          </div>

          <div className="flex items-start justify-between flex-wrap gap-2">
            <span className="text-gray-600 flex items-center gap-1.5 flex-shrink-0"><FileText className="w-3.5 h-3.5" /> Nome completo:</span>
            <span className="flex items-center gap-1 min-w-0">
              <span className="font-medium text-gray-800 text-right break-words">{item.cliente_nome || '-'}</span>
              <BotaoCopiar valor={item.cliente_nome} rotulo="Nome" />
            </span>
          </div>

          {item._endereco && (
            <div className="flex items-start justify-between flex-wrap gap-2">
              <span className="text-gray-600 flex items-center gap-1.5 flex-shrink-0"><MapPin className="w-3.5 h-3.5" /> Endereço:</span>
              <span className="flex items-center gap-1 min-w-0">
                <span className="font-medium text-gray-800 text-right break-words">{item._endereco}</span>
                <BotaoCopiar valor={item._endereco} rotulo="Endereço" />
              </span>
            </div>
          )}

          <div className="flex items-start justify-between flex-wrap gap-2">
            <span className="text-gray-600 flex-shrink-0">Serviço:</span>
            <span className="font-medium text-gray-800 text-right break-words">{item.tipo_servico || '-'}</span>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-gray-600 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Pagamento:</span>
            <span className="font-medium text-gray-800">
              {formatCurrency(item.valor_pago)} via {metodoDoPagamento(item) || 'não informado'}
              {item.valor_total > 0 && ` (total ${formatCurrency(item.valor_total)})`}
            </span>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-gray-600 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Data do pagamento:</span>
            <span className="font-medium text-gray-800">
              {data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : '-'}
            </span>
          </div>

          {emitida && item.nf_gerada_em && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 font-semibold">
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                NF marcada como gerada em {format(parseISO(item.nf_gerada_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                {item.nf_gerada_por ? ` por ${item.nf_gerada_por}` : ''}
              </span>
            </div>
          )}

          <div className="pt-1">
            <button
              onClick={async () => {
                const texto = [
                  item.cliente_nome || '',
                  item._cpf ? `CPF/CNPJ: ${formatCPF(item._cpf)}` : '',
                  item.telefone ? `Tel: ${formatPhone(item.telefone)}` : '',
                  item._endereco ? `Endereço: ${item._endereco}` : '',
                  `Serviço: ${item.tipo_servico || '-'}`,
                  `Valor: ${formatCurrency(item.valor_pago)} via ${metodoDoPagamento(item) || 'não informado'}`,
                  data ? `Data: ${format(data, 'dd/MM/yyyy')}` : '',
                ].filter(Boolean).join('\n');
                try {
                  await navigator.clipboard.writeText(texto);
                  toast.success('Dados do cliente copiados!');
                } catch {
                  toast.error('Não foi possível copiar. Copie os campos um a um.');
                }
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar todos os dados para a nota
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotaFiscal() {
  return (
    <TechnicianAccessBlock>
      <NotaFiscalContent />
    </TechnicianAccessBlock>
  );
}

function NotaFiscalContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [aba, setAba] = useState('emitir');
  const [busca, setBusca] = useState('');
  const buscaDebounced = useDebounce(busca);
  const [processandoId, setProcessandoId] = useState(null);

  // Mesma chave das outras telas: se a tabela ja estiver em cache, nao baixa de novo.
  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ['pagamentos-clientes'],
    queryFn: () => listAll('PagamentoCliente', '-data_conclusao'),
  });

  // Clientes entram so por causa do CPF/endereco, que nao ficam na cobranca.
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-nf'],
    queryFn: () => listAll('Cliente', '-created_date').catch(() => []),
  });

  const dadosCadastrais = useMemo(() => {
    const mapa = new Map();
    clientes.forEach(c => {
      const k = chaveIdentidadeCliente(c.nome, c.telefone);
      if (k && !mapa.has(k)) mapa.set(k, { cpf: c.cpf || '', endereco: c.endereco || '' });
    });
    return mapa;
  }, [clientes]);

  // Entra na fila quem teve dinheiro entrando no caixa da empresa por um meio
  // que gera nota. Fora: dinheiro vivo e valor recebido direto pelo tecnico.
  const elegiveis = useMemo(() => {
    return pagamentos
      .filter(p => {
        if ((p.valor_pago || 0) <= 0.01) return false;
        if (p.pago_direto_tecnico === true) return false;
        if (!METODOS_NF.includes(metodoDoPagamento(p))) return false;
        // Corte historico: so pagamentos a partir de NF_DATA_INICIO.
        const quando = dataDoPagamento(p);
        if (!quando || quando < nfInicio) return false;
        return true;
      })
      .map(p => {
        const cad = dadosCadastrais.get(chaveIdentidadeCliente(p.cliente_nome, p.telefone)) || {};
        return {
          ...p,
          _cpf: cad.cpf || '',
          _endereco: cad.endereco || '',
          _quitado: (p.valor_pago || 0) >= (p.valor_total || 0) - 0.01,
        };
      });
  }, [pagamentos, dadosCadastrais]);

  const filtrarBusca = (lista) => {
    if (!buscaDebounced) return lista;
    return lista.filter(p => matchClienteSearch(p.cliente_nome, p.telefone, buscaDebounced));
  };

  const aEmitir = useMemo(
    () => filtrarBusca(elegiveis.filter(p => p.nf_gerada !== true)),
    [elegiveis, buscaDebounced]
  );
  const emitidas = useMemo(
    () => filtrarBusca(elegiveis.filter(p => p.nf_gerada === true)),
    [elegiveis, buscaDebounced]
  );

  const totalAEmitir = aEmitir.reduce((s, p) => s + (p.valor_pago || 0), 0);

  const gravar = async (item, dados, mensagem) => {
    setProcessandoId(item.id);
    try {
      await base44.entities.PagamentoCliente.update(item.id, dados);
      queryClient.setQueryData(['pagamentos-clientes'], (antigos) => (
        Array.isArray(antigos) ? antigos.map(p => (p.id === item.id ? { ...p, ...dados } : p)) : antigos
      ));
      toast.success(mensagem);
    } catch (err) {
      console.error('[nota-fiscal] falha ao gravar', err);
      toast.error('Não foi possível salvar. Publique a versão nova do app e tente de novo.');
    } finally {
      setProcessandoId(null);
    }
  };

  const handleMarcar = (item) => gravar(
    item,
    { nf_gerada: true, nf_gerada_em: new Date().toISOString(), nf_gerada_por: user?.full_name || user?.email || '' },
    `✅ NF de ${item.cliente_nome || 'cliente'} marcada como gerada — movida para o arquivo.`
  );

  // Desfazer mexe so na marcacao. A data antiga fica guardada (e sobrescrita
  // na proxima marcacao) porque limpar um campo de data no Base44 pode ser
  // recusado e travar o desfazer justamente quando ele e mais necessario.
  const handleDesmarcar = (item) => gravar(
    item,
    { nf_gerada: false },
    `↩ ${item.cliente_nome || 'Cliente'} voltou para a fila de notas a emitir.`
  );

  const lista = aba === 'emitir' ? aEmitir : emitidas;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Nota Fiscal
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Pagamentos que entraram no caixa da empresa por PIX, cartão, máquina ou transferência.
            Dinheiro e valores recebidos direto pelo técnico não aparecem aqui.
            <br />
            <span className="text-gray-400">
              Contando a partir de {format(nfInicio, "dd/MM/yyyy", { locale: ptBR })} — pagamentos anteriores não entram nesta lista.
            </span>
          </p>
        </div>
        {aba === 'emitir' && aEmitir.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-gray-400">A emitir</p>
            <p className="font-bold text-blue-600">{formatCurrency(totalAEmitir)}</p>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente por nome ou telefone..."
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setAba('emitir')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            aba === 'emitir' ? 'bg-blue-600 text-white shadow' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          A emitir
          <span className={`px-1.5 py-0.5 rounded text-xs ${aba === 'emitir' ? 'bg-white/25' : 'bg-gray-100'}`}>
            {aEmitir.length}
          </span>
        </button>
        <button
          onClick={() => setAba('arquivo')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            aba === 'arquivo' ? 'bg-emerald-600 text-white shadow' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Archive className="w-4 h-4" />
          NF já gerada
          <span className={`px-1.5 py-0.5 rounded text-xs ${aba === 'arquivo' ? 'bg-white/25' : 'bg-gray-100'}`}>
            {emitidas.length}
          </span>
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin opacity-40" />
          <p className="text-sm">Carregando...</p>
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-14 text-gray-400 bg-white rounded-lg border border-gray-200">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {aba === 'emitir'
              ? (busca ? 'Nenhum cliente encontrado nesta busca.' : 'Nenhuma nota pendente — tudo em dia!')
              : (busca ? 'Nenhum cliente encontrado nesta busca.' : 'Nenhuma nota marcada como gerada ainda.')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map(item => (
            <LinhaNF
              key={item.id}
              item={item}
              emitida={aba === 'arquivo'}
              onMarcar={handleMarcar}
              onDesmarcar={handleDesmarcar}
              processando={processandoId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
