'use strict';

const fs = require('fs');
const crypto = require('crypto');

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), success: jest.fn(), progress: jest.fn(),
}));

const {
  loadTemplates,
  addTemplate,
  getTemplateById,
  deleteTemplate,
} = require('../../src/modules/messages');

const fakeTemplate = {
  id: 'uuid-1234',
  name: 'Template Teste',
  content: 'Olá {name}!',
  variables: ['name'],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('loadTemplates', () => {
  afterEach(() => jest.restoreAllMocks());

  test('retorna array de templates do arquivo JSON', async () => {
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(
      JSON.stringify({ templates: [fakeTemplate] })
    );
    const templates = await loadTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('Template Teste');
  });

  test('retorna array vazio quando arquivo não existe (ENOENT)', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    jest.spyOn(fs.promises, 'readFile').mockRejectedValue(err);
    await expect(loadTemplates()).resolves.toEqual([]);
  });

  test('relança erros que não sejam ENOENT', async () => {
    const err = Object.assign(new Error('Permissão negada'), { code: 'EACCES' });
    jest.spyOn(fs.promises, 'readFile').mockRejectedValue(err);
    await expect(loadTemplates()).rejects.toThrow('Permissão negada');
  });

  test('retorna array vazio quando chave "templates" está ausente no JSON', async () => {
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify({}));
    await expect(loadTemplates()).resolves.toEqual([]);
  });
});

describe('addTemplate', () => {
  beforeEach(() => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    jest.spyOn(fs.promises, 'readFile').mockRejectedValue(err);
    jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('mock-uuid-0000');
  });

  afterEach(() => jest.restoreAllMocks());

  test('cria template somente-texto com estrutura correta', async () => {
    const t = await addTemplate('Meu Template', 'Olá {name}', null, null, null, false);
    expect(t.id).toBe('mock-uuid-0000');
    expect(t.name).toBe('Meu Template');
    expect(t.content).toBe('Olá {name}');
    expect(t.variables).toContain('name');
    expect(t.media).toBeUndefined();
  });

  test('cria template de imagem com objeto media correto', async () => {
    const t = await addTemplate('Imagem', 'Texto', 'media/img.jpg', 'image', 'Legenda aqui', false);
    expect(t.media).toBeDefined();
    expect(t.media.type).toBe('image');
    expect(t.media.path).toBe('media/img.jpg');
    expect(t.media.caption).toBe('Legenda aqui');
    expect(t.media.asVoice).toBeUndefined();
  });

  test('cria template de áudio com propriedade asVoice', async () => {
    const t = await addTemplate('Áudio', '', 'media/audio.ogg', 'audio', null, true);
    expect(t.media.type).toBe('audio');
    expect(t.media.asVoice).toBe(true);
    expect(t.media.caption).toBeUndefined();
  });

  test('lança erro quando nome é vazio', async () => {
    await expect(addTemplate('', 'conteúdo', null, null, null)).rejects.toThrow('nome');
  });

  test('lança erro quando não há texto nem mídia', async () => {
    await expect(addTemplate('Nome', '', null, null, null)).rejects.toThrow('texto ou mídia');
  });

  test('extrai variáveis únicas de conteúdo e legenda', async () => {
    const t = await addTemplate(
      'Vars',
      '{name} {phone}',
      'media/x.jpg',
      'image',
      '{group} {name}',
      false
    );
    expect(t.variables).toEqual(expect.arrayContaining(['name', 'phone', 'group']));
    expect(new Set(t.variables).size).toBe(t.variables.length);
  });

  test('grava o template serializado via fs.promises.writeFile', async () => {
    await addTemplate('T', 'Olá', null, null, null);
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('messages.json'),
      expect.stringContaining('"templates"'),
      'utf8'
    );
  });
});

describe('getTemplateById', () => {
  afterEach(() => jest.restoreAllMocks());

  test('retorna o template correspondente ao id', async () => {
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(
      JSON.stringify({ templates: [fakeTemplate] })
    );
    const result = await getTemplateById('uuid-1234');
    expect(result).toEqual(fakeTemplate);
  });

  test('retorna null quando id não encontrado', async () => {
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(
      JSON.stringify({ templates: [fakeTemplate] })
    );
    const result = await getTemplateById('nao-existe');
    expect(result).toBeNull();
  });
});

describe('deleteTemplate', () => {
  afterEach(() => jest.restoreAllMocks());

  test('remove o template e grava a lista atualizada', async () => {
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(
      JSON.stringify({ templates: [fakeTemplate] })
    );
    jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);

    await deleteTemplate('uuid-1234');

    const writtenArg = fs.promises.writeFile.mock.calls[0][1];
    const written = JSON.parse(writtenArg);
    expect(written.templates).toHaveLength(0);
  });

  test('lança erro quando id não encontrado', async () => {
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(
      JSON.stringify({ templates: [] })
    );
    await expect(deleteTemplate('nao-existe')).rejects.toThrow('não encontrado');
  });
});
