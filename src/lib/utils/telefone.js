// Formatação de telefone BR para os formulários (Cliente e Serviço).
//
// Bug que originou este helper: os campos tinham maxLength={14} e o navegador
// TRUNCAVA o texto colado antes do JS ver — colar "+55 66 98112-6209" (17
// caracteres) virava "+55 66 98112-6", e o número era salvo com 2 dígitos a
// menos. Aqui o limite é aplicado sobre os DÍGITOS já normalizados, nunca
// sobre o texto bruto colado.

// Extrai só os dígitos de um telefone BR, removendo prefixo internacional
// (00) e DDI 55, e limita a 11 dígitos (DDD + 9). Aceita colar com ou sem
// +55: se o DDI já vier, não é duplicado depois.
export function digitosTelefoneBR(value) {
  let d = (value || '').replace(/\D/g, '');
  if (!d) return '';
  // Prefixo de discagem internacional: 00 55 66 ...
  if (d.startsWith('00')) d = d.slice(2);
  // DDI 55 — só remove quando sobra um número BR plausível (10 ou 11 dígitos).
  // Não remove de "55 9xxxx-xxxx" (DDD 55 do RS, 11 dígitos), que é válido.
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  // Colagens com lixo (ex.: link do WhatsApp) podem trazer dígitos extras
  return d.slice(0, 11);
}

// Máscara de exibição: "66 98112-6209" / "66 8116-3084"
export function formatarTelefoneBR(value) {
  const d = digitosTelefoneBR(value);
  if (!d) return '';
  if (d.length <= 2) return d;
  if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2)}`;
  if (d.length <= 10) return `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

// Valor para gravar no banco: E.164 sem duplicar o DDI (+55DDDNÚMERO)
export function telefoneParaSalvar(value) {
  const d = digitosTelefoneBR(value);
  return d ? `+55${d}` : '';
}
