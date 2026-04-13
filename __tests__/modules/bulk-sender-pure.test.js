'use strict';

// Mocka dependências externas para permitir o require de bulk-sender sem efeitos colaterais
jest.mock('whatsapp-web.js', () => ({ MessageMedia: { fromFilePath: jest.fn() } }));
jest.mock('../../src/client/whatsapp', () => ({ getClient: jest.fn() }));
jest.mock('../../src/modules/contacts', () => ({ getActiveContacts: jest.fn() }));
jest.mock('../../src/modules/messages', () => ({ getTemplateById: jest.fn(), interpolate: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), success: jest.fn(), progress: jest.fn(),
}));

const { toChatId, getDelayRange } = require('../../src/modules/bulk-sender');

describe('toChatId', () => {
  test('adiciona sufixo @c.us ao telefone', () => {
    expect(toChatId('5511999999999')).toBe('5511999999999@c.us');
  });

  test('funciona com qualquer string', () => {
    expect(toChatId('98765')).toBe('98765@c.us');
  });
});

describe('getDelayRange', () => {
  test('retorna {min:1500, max:3000} para 0 contatos', () => {
    expect(getDelayRange(0)).toEqual({ min: 1500, max: 3000 });
  });

  test('retorna {min:1500, max:3000} para 29 contatos (< 30)', () => {
    expect(getDelayRange(29)).toEqual({ min: 1500, max: 3000 });
  });

  test('retorna {min:3000, max:8000} para exatamente 30 contatos', () => {
    expect(getDelayRange(30)).toEqual({ min: 3000, max: 8000 });
  });

  test('retorna {min:3000, max:8000} para 100 contatos (<= 100)', () => {
    expect(getDelayRange(100)).toEqual({ min: 3000, max: 8000 });
  });

  test('retorna {min:5000, max:15000} para 101 contatos', () => {
    expect(getDelayRange(101)).toEqual({ min: 5000, max: 15000 });
  });

  test('retorna {min:5000, max:15000} para 300 contatos (<= 300)', () => {
    expect(getDelayRange(300)).toEqual({ min: 5000, max: 15000 });
  });

  test('retorna {min:10000, max:20000} para 301 contatos (> 300)', () => {
    expect(getDelayRange(301)).toEqual({ min: 10000, max: 20000 });
  });

  test('retorna {min:10000, max:20000} para volume muito alto', () => {
    expect(getDelayRange(10000)).toEqual({ min: 10000, max: 20000 });
  });
});
