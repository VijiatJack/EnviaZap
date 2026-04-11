/**
 * Remove todos os caracteres não-numéricos e formata o número para o padrão brasileiro.
 * Entrada aceita: (98) 99123-4567, 98991234567, +5598991234567, 5598991234567
 * Saída: 5598991234567 (DDI 55 + DDD + número, sem símbolos)
 */
function formatBrazilianPhone(raw) {
  const digits = String(raw).replace(/\D/g, '');

  // Já no formato completo com DDI
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Apenas DDD + número (10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }

  throw new Error(
    `Número de telefone inválido: "${raw}". ` +
    `Informe no formato (DDD) XXXXX-XXXX ou 55DDXXXXXXXXX.`
  );
}

function validatePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return digits.startsWith('55') && (digits.length === 12 || digits.length === 13);
}

module.exports = { formatBrazilianPhone, validatePhone };
