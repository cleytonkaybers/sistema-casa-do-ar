import { format, parse, startOfWeek, endOfWeek, addDays, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Timezone do app: America/Manaus (UTC-4)
const TIMEZONE = 'America/Manaus';

/**
 * Obtém a data atual no timezone do app
 */
export function getLocalDate() {
  const now = new Date();
  // Criar data no timezone local sem conversão
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
}

/**
 * Converte uma data para o timezone do app
 */
export function toLocalDate(date) {
  if (!date) return null;
  
  // Se já é um objeto Date válido, retornar como está
  if (date instanceof Date && isValid(date)) {
    return date;
  }
  
  // Se é string, fazer parse
  if (typeof date === 'string') {
    const d = parseISO(date);
    if (!isValid(d)) return null;
    return d;
  }
  
  return null;
}

/**
 * Obtém o início da semana atual (segunda-feira 00:00:00)
 */
export function getStartOfWeek(date = null) {
  const baseDate = date ? toLocalDate(date) : getLocalDate();
  const start = startOfWeek(baseDate, { weekStartsOn: 1, locale: ptBR });
  return startOfDay(start);
}

/**
 * Obtém o fim da semana atual (domingo 23:59:59)
 */
export function getEndOfWeek(date = null) {
  const baseDate = date ? toLocalDate(date) : getLocalDate();
  const end = endOfWeek(baseDate, { weekStartsOn: 1, locale: ptBR });
  return endOfDay(end);
}

/**
 * Formata uma data para exibição
 */
export function formatDate(date, formatStr = "dd/MM/yyyy") {
  if (!date) return '';
  const d = toLocalDate(date);
  if (!d) return '';
  return format(d, formatStr, { locale: ptBR });
}

/**
 * Formata uma data para ISO string (YYYY-MM-DD)
 */
export function toISODate(date) {
  if (!date) return '';
  const d = toLocalDate(date);
  if (!d) return '';
  return format(d, 'yyyy-MM-dd');
}

/**
 * Verifica se uma data está na semana atual
 */
export function isInCurrentWeek(date) {
  if (!date) return false;
  const d = toLocalDate(date);
  if (!d) return false;
  
  const start = getStartOfWeek();
  const end = getEndOfWeek();
  
  return d >= start && d <= end;
}

/**
 * Obtém o nome do dia da semana
 */
export function getDayName(date) {
  const d = toLocalDate(date);
  if (!d) return '';
  return format(d, 'EEEE', { locale: ptBR });
}

/**
 * Adiciona dias a uma data
 */
export function addDaysToDate(date, days) {
  const d = toLocalDate(date);
  if (!d) return null;
  return addDays(d, days);
}

/**
 * Faz parse de qualquer formato comum: dd/MM/yyyy [HH:mm], ISO, Date.
 * Usado principalmente para historico_pagamentos[].data que é salvo como "dd/MM/yyyy HH:mm".
 */
export function parseHistoricoData(value) {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const fmt = s.length > 10 ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
    const d = parse(s, fmt, new Date());
    return isValid(d) ? d : null;
  }
  const iso = parseISO(s);
  return isValid(iso) ? iso : null;
}

/**
 * Cria Date a partir de "YYYY-MM-DD" (ou ISO completa) sem dupla concatenação de 'T'.
 * Evita strings inválidas como "2026-04-20T00:00:00T12:00:00".
 */
export function toLocalDateSafe(value, defaultTime = '12:00:00') {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const s = String(value).trim();
  if (!s) return null;
  const iso = s.includes('T') ? s : `${s}T${defaultTime}`;
  const d = new Date(iso);
  return isValid(d) ? d : null;
}