const { getClient } = require('../client/whatsapp');

/**
 * Retorna todos os grupos do WhatsApp que o número participa.
 * Cada item: { id, name, participantCount, description }
 */
async function fetchGroups() {
  const client = getClient();
  const chats = await client.getChats();
  return chats
    .filter((c) => c.isGroup)
    .map((c) => ({
      id: c.id._serialized,
      name: c.name,
      participantCount: c.participants ? c.participants.length : 0,
      description: c.description || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Retorna os participantes de um grupo pelo groupId.
 * Cada item: { phone, name, isAdmin }
 */
async function fetchGroupParticipants(groupId) {
  const client = getClient();
  const chat = await client.getChatById(groupId);
  if (!chat || !chat.isGroup) {
    throw new Error(`Chat "${groupId}" não é um grupo.`);
  }
  return chat.participants.map((p) => ({
    phone: p.id.user,
    name: p.id.user,
    isAdmin: p.isAdmin || p.isSuperAdmin || false,
  }));
}

/**
 * Cria um novo grupo no WhatsApp.
 * @param {string} name - Nome do grupo
 * @param {string[]} phones - Array de telefones no formato 559898XXXXXX
 * @returns {{ groupId, inviteCode, failedParticipants }}
 */
async function createGroup(name, phones) {
  const client = getClient();
  const participants = phones.map((p) => `${p}@c.us`);
  const result = await client.createGroup(name, participants);
  return {
    groupId: result.gid._serialized,
    inviteCode: result.inviteCode,
    failedParticipants: result.participants
      ? result.participants
          .filter((p) => p.error)
          .map((p) => p.id.user)
      : [],
  };
}

module.exports = { fetchGroups, fetchGroupParticipants, createGroup };
