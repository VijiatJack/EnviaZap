'use strict';

const fs = require('fs');

jest.mock('whatsapp-web.js', () => ({
  MessageMedia: { fromFilePath: jest.fn() },
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), success: jest.fn(), progress: jest.fn(),
}));

// interpolate retorna o texto sem alteração para simplificar as asserções
jest.mock('../../src/modules/messages', () => ({
  getTemplateById: jest.fn(),
  interpolate: jest.fn((t) => t || ''),
}));

jest.mock('../../src/modules/contacts', () => ({
  getActiveContacts: jest.fn(),
}));

const mockSendMessage = jest.fn();
jest.mock('../../src/client/whatsapp', () => ({
  getClient: jest.fn(() => ({ sendMessage: mockSendMessage })),
}));

const { MessageMedia } = require('whatsapp-web.js');
const { sendTemplateMessage, sendBulkMessages, sendSingleMessage, sendBulkToGroups } = require('../../src/modules/bulk-sender');
const { getTemplateById } = require('../../src/modules/messages');
const { getActiveContacts } = require('../../src/modules/contacts');

const mockClient = { sendMessage: mockSendMessage };
const contact = { name: 'Alice', phone: '5511999000001', group: '#test' };
const chatId = '5511999000001@c.us';

describe('sendTemplateMessage', () => {
  beforeEach(() => {
    mockSendMessage.mockResolvedValue({ id: { id: 'msg-id-123' } });
    MessageMedia.fromFilePath.mockReturnValue({ mimetype: 'image/jpeg', data: 'b64data' });
  });

  test('template somente-texto: chama sendMessage uma vez com footer do bot', async () => {
    const template = { content: 'Olá, {name}!', media: null };
    await sendTemplateMessage(mockClient, chatId, template, contact);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0]).toBe(chatId);
    expect(mockSendMessage.mock.calls[0][1]).toContain('🤖');
  });

  test('template de imagem: chama sendMessage uma vez com objeto media e caption', async () => {
    const template = {
      content: '',
      media: { type: 'image', path: 'media/test.jpg', caption: 'Veja isso' },
    };
    await sendTemplateMessage(mockClient, chatId, template, contact);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(
      expect.stringContaining('test.jpg')
    );
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][2]).toHaveProperty('caption');
  });

  test('template de áudio com content: 2 chamadas (texto+footer, depois áudio)', async () => {
    const template = {
      content: 'Mensagem de áudio',
      media: { type: 'audio', path: 'media/audio.ogg', asVoice: true },
    };
    await sendTemplateMessage(mockClient, chatId, template, contact);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    // Primeira chamada: texto
    expect(typeof mockSendMessage.mock.calls[0][1]).toBe('string');
    // Segunda chamada: áudio
    expect(mockSendMessage.mock.calls[1][2]).toHaveProperty('sendAudioAsVoice', true);
  });

  test('template de áudio sem content: 2 chamadas (áudio, depois footer separado)', async () => {
    const template = {
      content: '',
      media: { type: 'audio', path: 'media/audio.ogg', asVoice: false },
    };
    await sendTemplateMessage(mockClient, chatId, template, contact);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    // Primeira chamada: áudio (objeto media)
    expect(mockSendMessage.mock.calls[0][1]).toEqual(
      expect.objectContaining({ mimetype: 'image/jpeg' })
    );
    // Segunda chamada: footer em texto
    expect(typeof mockSendMessage.mock.calls[1][1]).toBe('string');
  });
});

describe('sendBulkMessages', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSendMessage.mockResolvedValue({ id: { id: 'msg-abc' } });
    MessageMedia.fromFilePath.mockReturnValue({ mimetype: 'image/jpeg', data: 'b64' });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('lança erro quando template não encontrado', async () => {
    getTemplateById.mockResolvedValue(null);
    await expect(sendBulkMessages('id-invalido')).rejects.toThrow('não encontrado');
  });

  test('retorna array vazio quando não há contatos ativos', async () => {
    getTemplateById.mockResolvedValue({ id: '1', content: 'Oi', media: null });
    getActiveContacts.mockResolvedValue([]);

    const results = await sendBulkMessages('1');
    expect(results).toEqual([]);
  });

  test('envia para todos os contatos e retorna status=sent', async () => {
    getTemplateById.mockResolvedValue({ id: 'tmpl-1', content: 'Oi {name}', media: null });
    getActiveContacts.mockResolvedValue([
      { name: 'Alice', phone: '5511111111111', group: '#g' },
      { name: 'Bob', phone: '5511222222222', group: '#g' },
    ]);

    const promise = sendBulkMessages('tmpl-1');
    await jest.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'sent')).toBe(true);
  });

  test('registra status=failed quando sendMessage lança erro', async () => {
    getTemplateById.mockResolvedValue({ id: 'x', content: 'Oi', media: null });
    getActiveContacts.mockResolvedValue([
      { name: 'Alice', phone: '5511111111111', group: '' },
    ]);
    mockSendMessage.mockRejectedValueOnce(new Error('Erro de rede'));

    const promise = sendBulkMessages('x');
    await jest.runAllTimersAsync();
    const results = await promise;

    expect(results[0].status).toBe('failed');
    expect(results[0].error).toBe('Erro de rede');
  });

  test('lança erro antes de enviar quando arquivo de mídia não existe', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    getTemplateById.mockResolvedValue({
      id: 'x',
      content: '',
      media: { type: 'image', path: 'media/nao-existe.jpg', caption: '' },
    });

    await expect(sendBulkMessages('x')).rejects.toThrow('Arquivo de mídia não encontrado');
  });
});

describe('sendSingleMessage', () => {
  beforeEach(() => {
    mockSendMessage.mockResolvedValue({ id: { id: 'msg-single' } });
  });

  test('retorna status=sent com phone e sentAt', async () => {
    const result = await sendSingleMessage('5511999000001', 'Olá!');
    expect(result.phone).toBe('5511999000001');
    expect(result.status).toBe('sent');
    expect(result.sentAt).toBeDefined();
    expect(mockSendMessage).toHaveBeenCalledWith('5511999000001@c.us', 'Olá!');
  });

  test('retorna status=failed quando sendMessage lança erro', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('Timeout'));
    const result = await sendSingleMessage('5511999000001', 'Olá!');
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Timeout');
  });
});

describe('sendBulkToGroups', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSendMessage.mockResolvedValue({ id: { id: 'msg-group' } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('lança erro quando template não encontrado', async () => {
    getTemplateById.mockResolvedValue(null);
    await expect(sendBulkToGroups('id-invalido', [])).rejects.toThrow('não encontrado');
  });

  test('retorna array vazio quando lista de grupos é vazia', async () => {
    getTemplateById.mockResolvedValue({ id: '1', content: 'Oi', media: null });
    const results = await sendBulkToGroups('1', []);
    expect(results).toEqual([]);
  });

  test('envia para todos os grupos e retorna status=sent', async () => {
    getTemplateById.mockResolvedValue({ id: 'tmpl-g', content: '{name}, novidade!', media: null });
    const groups = [
      { id: 'g1@g.us', name: 'Grupo 1' },
      { id: 'g2@g.us', name: 'Grupo 2' },
    ];
    const promise = sendBulkToGroups('tmpl-g', groups);
    await jest.runAllTimersAsync();
    const results = await promise;
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'sent')).toBe(true);
  });

  test('registra status=failed quando envio ao grupo falha', async () => {
    getTemplateById.mockResolvedValue({ id: 'x', content: 'Oi', media: null });
    mockSendMessage.mockRejectedValueOnce(new Error('Grupo bloqueado'));
    const groups = [{ id: 'g1@g.us', name: 'Grupo 1' }];
    const promise = sendBulkToGroups('x', groups);
    await jest.runAllTimersAsync();
    const results = await promise;
    expect(results[0].status).toBe('failed');
    expect(results[0].error).toBe('Grupo bloqueado');
  });
});
