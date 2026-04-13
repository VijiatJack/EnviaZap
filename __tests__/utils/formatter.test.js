'use strict';

const { formatBrazilianPhone, validatePhone } = require('../../src/utils/formatter');

describe('formatBrazilianPhone', () => {
  test('aceita número já no formato completo DDI+DDD+9 dígitos (13 dígitos)', () => {
    expect(formatBrazilianPhone('5598991234567')).toBe('5598991234567');
  });

  test('aceita número no formato completo DDI+DDD+8 dígitos (12 dígitos)', () => {
    expect(formatBrazilianPhone('559891234567')).toBe('559891234567');
  });

  test('prepend 55 a número DDD+9 dígitos (11 dígitos)', () => {
    expect(formatBrazilianPhone('98991234567')).toBe('5598991234567');
  });

  test('prepend 55 a número DDD+8 dígitos (10 dígitos)', () => {
    expect(formatBrazilianPhone('9891234567')).toBe('559891234567');
  });

  test('remove formatação: (98) 99123-4567', () => {
    expect(formatBrazilianPhone('(98) 99123-4567')).toBe('5598991234567');
  });

  test('remove prefixo + de +5598991234567', () => {
    expect(formatBrazilianPhone('+5598991234567')).toBe('5598991234567');
  });

  test('aceita input numérico (não-string) via coerção String(raw)', () => {
    expect(formatBrazilianPhone(98991234567)).toBe('5598991234567');
  });

  test('lança erro para número muito curto (9 dígitos após strip)', () => {
    expect(() => formatBrazilianPhone('989912345')).toThrow('Número de telefone inválido');
  });

  test('lança erro para número muito longo (14 dígitos após strip)', () => {
    expect(() => formatBrazilianPhone('559899123456789')).toThrow('Número de telefone inválido');
  });

  test('lança erro para string vazia', () => {
    expect(() => formatBrazilianPhone('')).toThrow('Número de telefone inválido');
  });

  test('lança erro para somente letras', () => {
    expect(() => formatBrazilianPhone('abcde')).toThrow('Número de telefone inválido');
  });

  test('número de 12 dígitos não iniciando com 55 recebe prepend e vira 14 dígitos → lança erro', () => {
    // 119912345678 → 12 dígitos, não começa com 55; não é 10/11 dígitos → lança
    expect(() => formatBrazilianPhone('119912345678')).toThrow('Número de telefone inválido');
  });
});

describe('validatePhone', () => {
  test('retorna true para número de 13 dígitos iniciando com 55', () => {
    expect(validatePhone('5598991234567')).toBe(true);
  });

  test('retorna true para número de 12 dígitos iniciando com 55', () => {
    expect(validatePhone('559891234567')).toBe(true);
  });

  test('retorna true para input formatado que resulta em número válido', () => {
    expect(validatePhone('55 (98) 99123-4567')).toBe(true);
  });

  test('retorna false para número sem prefixo 55', () => {
    expect(validatePhone('98991234567')).toBe(false);
  });

  test('retorna false para número com 55 mas muito curto', () => {
    expect(validatePhone('5598991234')).toBe(false);
  });

  test('retorna false para string vazia', () => {
    expect(validatePhone('')).toBe(false);
  });
});
