import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata data para padrão brasileiro
 */
export const formatDate = (date, pattern = "dd/MM/yyyy") => {
  if (!date) return '-';
  try {
    return format(new Date(date), pattern, { locale: ptBR });
  } catch {
    return '-';
  }
};

/**
 * Formata data e hora
 */
export const formatDateTime = (date) => {
  return formatDate(date, "dd/MM/yyyy HH:mm");
};

/**
 * Formata valor monetário
 */
export const formatCurrency = (value) => {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

/**
 * Formata telefone
 */
export const formatPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
};

/**
 * Formata CPF
 */
export const formatCPF = (cpf) => {
  if (!cpf) return '';
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

/**
 * Calcula dias da semana em português
 */
export const getDiaSemana = (date) => {
  if (!date) return '';
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return dias[new Date(date).getDay()];
};