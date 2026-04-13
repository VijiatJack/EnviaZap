'use strict';

const fs = require('fs');
const { Readable } = require('stream');

jest.mock('csv-writer', () => ({
  createObjectCsvWriter: jest.fn(),
}));

const { createObjectCsvWriter } = require('csv-writer');

const {
  loadContacts,
  addContact,
  getActiveContacts,
  deactivateContact,
} = require('../../src/modules/contacts');

// Constrói uma string CSV a partir de linhas
function buildCsv(...rows) {
  const header = 'name,phone,group,active,added_at';
  const lines = rows.map(
    (r) => `${r.name},${r.phone},${r.group},${r.active},${r.added_at}`
  );
  return [header, ...lines].join('\n');
}

describe('loadContacts', () => {
  afterEach(() => jest.restoreAllMocks());

  test('retorna array vazio quando o arquivo CSV não existe', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    await expect(loadContacts()).resolves.toEqual([]);
  });

  test('retorna contatos parsed com active=true como boolean', async () => {
    const csv = buildCsv({
      name: 'Alice',
      phone: '5598991234567',
      group: '#test',
      active: 'true',
      added_at: '2026-01-01T00:00:00.000Z',
    });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'createReadStream').mockReturnValue(Readable.from([csv]));

    const contacts = await loadContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0].active).toBe(true);
    expect(contacts[0].name).toBe('Alice');
    expect(contacts[0].phone).toBe('5598991234567');
  });

  test('retorna contatos com active=false como boolean', async () => {
    const csv = buildCsv({
      name: 'Bob',
      phone: '5511888888888',
      group: '#x',
      active: 'false',
      added_at: '2026-01-01T00:00:00.000Z',
    });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'createReadStream').mockReturnValue(Readable.from([csv]));

    const contacts = await loadContacts();
    expect(contacts[0].active).toBe(false);
  });

  test('retorna array vazio para CSV com apenas cabeçalho (sem linhas de dados)', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'createReadStream').mockReturnValue(
      Readable.from(['name,phone,group,active,added_at'])
    );
    await expect(loadContacts()).resolves.toEqual([]);
  });
});

describe('addContact', () => {
  let mockWriteRecords;

  beforeEach(() => {
    mockWriteRecords = jest.fn().mockResolvedValue(undefined);
    createObjectCsvWriter.mockReturnValue({ writeRecords: mockWriteRecords });
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  test('adiciona novo contato e chama writeRecords com o shape correto', async () => {
    const result = await addContact({ name: 'Alice', phone: '98991234567', group: '#test' });
    expect(result.phone).toBe('5598991234567');
    expect(result.name).toBe('Alice');
    expect(result.group).toBe('#test');
    expect(result.active).toBe(true);
    expect(result.added_at).toBeDefined();
    expect(mockWriteRecords).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ phone: '5598991234567', name: 'Alice' }),
      ])
    );
  });

  test('lança erro para telefone duplicado', async () => {
    const csv = buildCsv({
      name: 'Alice',
      phone: '5598991234567',
      group: '',
      active: 'true',
      added_at: '2026-01-01T00:00:00.000Z',
    });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'createReadStream').mockReturnValue(Readable.from([csv]));

    await expect(addContact({ name: 'Bob', phone: '5598991234567' })).rejects.toThrow('já existe');
  });

  test('lança erro para formato de telefone inválido', async () => {
    await expect(addContact({ name: 'X', phone: '123' })).rejects.toThrow(
      'Número de telefone inválido'
    );
  });

  test('faz trim no nome antes de salvar', async () => {
    const result = await addContact({ name: '  Alice  ', phone: '98991234567' });
    expect(result.name).toBe('Alice');
  });
});

describe('getActiveContacts', () => {
  afterEach(() => jest.restoreAllMocks());

  const sampleCsv = buildCsv(
    { name: 'A', phone: '5598000000001', group: '#g1', active: 'true', added_at: '' },
    { name: 'B', phone: '5598000000002', group: '#g2', active: 'true', added_at: '' },
    { name: 'C', phone: '5598000000003', group: '#g1', active: 'false', added_at: '' }
  );

  function setupCsv() {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'createReadStream').mockReturnValue(Readable.from([sampleCsv]));
  }

  test('retorna todos os contatos ativos quando não há filtro de grupo', async () => {
    setupCsv();
    const result = await getActiveContacts();
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.active)).toBe(true);
  });

  test('filtra por grupo e exclui inativos', async () => {
    setupCsv();
    const result = await getActiveContacts('#g1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });

  test('retorna array vazio quando grupo não tem contatos ativos', async () => {
    setupCsv();
    const result = await getActiveContacts('#inexistente');
    expect(result).toEqual([]);
  });
});

describe('deactivateContact', () => {
  let mockWriteRecords;

  beforeEach(() => {
    mockWriteRecords = jest.fn().mockResolvedValue(undefined);
    createObjectCsvWriter.mockReturnValue({ writeRecords: mockWriteRecords });
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  test('define active=false para o contato correspondente', async () => {
    const csv = buildCsv({
      name: 'A',
      phone: '5598000000001',
      group: '',
      active: 'true',
      added_at: '',
    });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'createReadStream').mockReturnValue(Readable.from([csv]));

    await deactivateContact('5598000000001');

    const written = mockWriteRecords.mock.calls[0][0];
    expect(written[0].active).toBe(false);
  });

  test('lança erro quando telefone não encontrado', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    await expect(deactivateContact('5598000000099')).rejects.toThrow('não encontrado');
  });
});
