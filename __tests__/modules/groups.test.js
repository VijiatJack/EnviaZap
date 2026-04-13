'use strict';

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), success: jest.fn(), progress: jest.fn(),
}));

const mockGetChats = jest.fn();
const mockGetChatById = jest.fn();
const mockCreateGroup = jest.fn();

jest.mock('../../src/client/whatsapp', () => ({
  getClient: jest.fn(() => ({
    getChats: mockGetChats,
    getChatById: mockGetChatById,
    createGroup: mockCreateGroup,
  })),
}));

const { fetchGroups, fetchGroupParticipants, createGroup } = require('../../src/modules/groups');

describe('fetchGroups', () => {
  test('retorna somente chats de grupo', async () => {
    mockGetChats.mockResolvedValue([
      { isGroup: true,  id: { _serialized: 'g1@g.us' }, name: 'Zeta',   participants: [{}, {}], description: '' },
      { isGroup: false, id: { _serialized: 'p1@c.us' }, name: 'Privado', participants: [],       description: '' },
      { isGroup: true,  id: { _serialized: 'g2@g.us' }, name: 'Alpha',  participants: [{}],     description: 'Desc' },
    ]);
    const groups = await fetchGroups();
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.id.endsWith('@g.us'))).toBe(true);
  });

  test('ordena os grupos por nome ascendente', async () => {
    mockGetChats.mockResolvedValue([
      { isGroup: true, id: { _serialized: 'g1@g.us' }, name: 'Zeta',  participants: [], description: '' },
      { isGroup: true, id: { _serialized: 'g2@g.us' }, name: 'Alpha', participants: [], description: '' },
      { isGroup: true, id: { _serialized: 'g3@g.us' }, name: 'Melo',  participants: [], description: '' },
    ]);
    const groups = await fetchGroups();
    expect(groups.map((g) => g.name)).toEqual(['Alpha', 'Melo', 'Zeta']);
  });

  test('mapeia participantCount corretamente', async () => {
    mockGetChats.mockResolvedValue([
      { isGroup: true, id: { _serialized: 'g@g.us' }, name: 'G', participants: [{}, {}, {}], description: '' },
    ]);
    const groups = await fetchGroups();
    expect(groups[0].participantCount).toBe(3);
  });

  test('participantCount=0 quando participants é undefined', async () => {
    mockGetChats.mockResolvedValue([
      { isGroup: true, id: { _serialized: 'g@g.us' }, name: 'G', participants: undefined, description: '' },
    ]);
    const groups = await fetchGroups();
    expect(groups[0].participantCount).toBe(0);
  });

  test('retorna array vazio quando não há grupos', async () => {
    mockGetChats.mockResolvedValue([
      { isGroup: false, id: { _serialized: 'p@c.us' }, name: 'Privado', participants: [], description: '' },
    ]);
    const groups = await fetchGroups();
    expect(groups).toEqual([]);
  });
});

describe('fetchGroupParticipants', () => {
  test('retorna participantes com shape correto incluindo isAdmin', async () => {
    mockGetChatById.mockResolvedValue({
      isGroup: true,
      participants: [
        { id: { user: '5511999000001' }, isAdmin: true,  isSuperAdmin: false },
        { id: { user: '5511888000002' }, isAdmin: false, isSuperAdmin: false },
      ],
    });
    const participants = await fetchGroupParticipants('g1@g.us');
    expect(participants).toHaveLength(2);
    expect(participants[0]).toEqual({ phone: '5511999000001', name: '5511999000001', isAdmin: true });
    expect(participants[1].isAdmin).toBe(false);
  });

  test('reconhece isSuperAdmin como isAdmin=true', async () => {
    mockGetChatById.mockResolvedValue({
      isGroup: true,
      participants: [
        { id: { user: '5511999000001' }, isAdmin: false, isSuperAdmin: true },
      ],
    });
    const participants = await fetchGroupParticipants('g1@g.us');
    expect(participants[0].isAdmin).toBe(true);
  });

  test('lança erro quando o chat não é um grupo', async () => {
    mockGetChatById.mockResolvedValue({ isGroup: false });
    await expect(fetchGroupParticipants('p1@c.us')).rejects.toThrow('não é um grupo');
  });

  test('lança erro quando getChatById retorna null', async () => {
    mockGetChatById.mockResolvedValue(null);
    await expect(fetchGroupParticipants('id-invalido')).rejects.toThrow();
  });
});

describe('createGroup', () => {
  test('cria grupo e retorna groupId, inviteCode e failedParticipants', async () => {
    mockCreateGroup.mockResolvedValue({
      gid: { _serialized: 'new-group@g.us' },
      inviteCode: 'abc123',
      participants: [
        { id: { user: '5511111' }, error: null },
        { id: { user: '5511222' }, error: 403 },
      ],
    });
    const result = await createGroup('Meu Grupo', ['5511111', '5511222']);
    expect(result.groupId).toBe('new-group@g.us');
    expect(result.inviteCode).toBe('abc123');
    expect(result.failedParticipants).toEqual(['5511222']);
  });

  test('retorna failedParticipants vazio quando todos foram adicionados', async () => {
    mockCreateGroup.mockResolvedValue({
      gid: { _serialized: 'g@g.us' },
      inviteCode: 'xyz',
      participants: [{ id: { user: '5511111' }, error: null }],
    });
    const result = await createGroup('Grupo', ['5511111']);
    expect(result.failedParticipants).toEqual([]);
  });

  test('retorna failedParticipants vazio quando participants é undefined', async () => {
    mockCreateGroup.mockResolvedValue({
      gid: { _serialized: 'g@g.us' },
      inviteCode: 'xyz',
      participants: undefined,
    });
    const result = await createGroup('Grupo', ['5511111']);
    expect(result.failedParticipants).toEqual([]);
  });
});
