import { format, startOfWeek, endOfWeek, addDays, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Timezone do app: America/Manaus (UTC-4)
const TIMEZONE = 'America/Manaus';

/**
 * Obtém a data atual no timezone do app
 */
export function getLocalDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Converte uma data para o timezone do app
 */
export function toLocalDate(date) {
  if (!date) return null;
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return null;
  return new Date(d.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Obtém o início da semana atual (segunda-feira)
 */
export function getStartOfWeek(date = null) {
  const baseDate = date ? toLocalDate(date) : getLocalDate();
  return startOfWeek(baseDate, { weekStartsOn: 1 }); // 1 = segunda-feira
}

/**
 * Obtém o fim da semana atual (domingo)
 */
export function getEndOfWeek(date = null) {
  const baseDate = date ? toLocalDate(date) : getLocalDate();
  return endOfWeek(baseDate, { weekStartsOn: 1 });
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