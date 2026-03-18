import { z } from 'zod';

export const servicoSchema = z.object({
  cliente_nome: z.string().min(3, 'Nome do cliente é obrigatório'),
  telefone: z.string().min(10, 'Telefone inválido'),
  endereco: z.string().min(5, 'Endereço é obrigatório'),
  tipo_servico: z.string().min(1, 'Tipo de serviço é obrigatório'),
  data_programada: z.string().min(1, 'Data é obrigatória'),
  valor: z.number().min(0, 'Valor inválido'),
  equipe_id: z.string().optional(),
  cpf: z.string().optional(),
  horario: z.string().optional(),
  descricao: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const clienteSchema = z.object({
  nome: z.string().min(3, 'Nome é obrigatório'),
  telefone: z.string().min(10, 'Telefone inválido'),
  endereco: z.string().optional(),
  cpf: z.string().optional(),
  observacoes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const pagamentoSchema = z.object({
  tecnico_id: z.string().min(1, 'Técnico é obrigatório'),
  valor_pago: z.number().min(0.01, 'Valor deve ser maior que zero'),
  data_pagamento: z.string().min(1, 'Data é obrigatória'),
  metodo_pagamento: z.string().min(1, 'Método de pagamento é obrigatório'),
  observacao: z.string().optional(),
  lancamentos_id: z.array(z.string()).min(1, 'Selecione ao menos um lançamento'),
});