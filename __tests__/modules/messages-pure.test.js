'use strict';

const { interpolate } = require('../../src/modules/messages');

describe('interpolate', () => {
  describe('substituições básicas', () => {
    test('substitui {name} pelo nome do contato', () => {
      expect(interpolate('Olá, {name}!', { name: 'Maria', phone: '559899', group: '' }))
        .toBe('Olá, Maria!');
    });

    test('substitui {phone} pelo telefone do contato', () => {
      expect(interpolate('Seu número: {phone}', { name: 'X', phone: '5511999', group: '' }))
        .toBe('Seu número: 5511999');
    });

    test('substitui {group} pelo grupo do contato', () => {
      expect(interpolate('Grupo: {group}', { name: 'X', phone: '5511', group: '#vendas' }))
        .toBe('Grupo: #vendas');
    });

    test('substitui as três variáveis em um mesmo texto', () => {
      const result = interpolate('{name} / {phone} / {group}', {
        name: 'Ana',
        phone: '559899',
        group: '#test',
      });
      expect(result).toBe('Ana / 559899 / #test');
    });

    test('substitui múltiplas ocorrências da mesma variável', () => {
      expect(interpolate('{name} e {name}', { name: 'Bob', phone: '', group: '' }))
        .toBe('Bob e Bob');
    });

    test('retorna string vazia quando text é null', () => {
      expect(interpolate(null, { name: 'X', phone: '', group: '' })).toBe('');
    });

    test('retorna string vazia quando text é vazio', () => {
      expect(interpolate('', { name: 'X', phone: '', group: '' })).toBe('');
    });

    test('usa {phone} como fallback quando contact.name é string vazia', () => {
      expect(interpolate('{name}', { name: '', phone: '559899', group: '' })).toBe('559899');
    });

    test('texto sem variáveis retorna inalterado', () => {
      expect(interpolate('Sem variáveis aqui.', { name: 'X', phone: '5511', group: '#g' }))
        .toBe('Sem variáveis aqui.');
    });
  });

  describe('contexto de grupo (contact.name === null)', () => {
    test('{name} no início do texto → "Grupo" (maiúsculo)', () => {
      expect(interpolate('{name}, tudo bem?', { name: null, phone: '', group: '' }))
        .toBe('Grupo, tudo bem?');
    });

    test('{name} no meio da frase → "grupo" (minúsculo)', () => {
      expect(interpolate('Olá {name}, bem-vindo!', { name: null, phone: '', group: '' }))
        .toBe('Olá grupo, bem-vindo!');
    });

    test('{name} logo após \\n → "Grupo" (início de parágrafo)', () => {
      const text = 'Primeira linha.\n{name}, segunda linha.';
      expect(interpolate(text, { name: null, phone: '', group: '' }))
        .toBe('Primeira linha.\nGrupo, segunda linha.');
    });

    test('{name} após \\n com espaços iniciais → "Grupo" (início de parágrafo)', () => {
      const text = 'Linha1.\n  {name} segue.';
      expect(interpolate(text, { name: null, phone: '', group: '' }))
        .toBe('Linha1.\n  Grupo segue.');
    });

    test('múltiplos {name} em posições mistas', () => {
      const text = '{name} foi convidado. Bem-vindo, {name}!';
      expect(interpolate(text, { name: null, phone: '', group: '' }))
        .toBe('Grupo foi convidado. Bem-vindo, grupo!');
    });
  });
});
