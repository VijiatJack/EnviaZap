const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const { getClient } = require('../client/whatsapp');
const { getActiveContacts } = require('./contacts');
const { getTemplateById, interpolate } = require('./messages');
const logger = require('../utils/logger');

function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toChatId(phone) {
  return `${phone}@c.us`;
}

/**
 * Retorna o intervalo de delay (ms) adequado para o volume de contatos.
 *
 * | Contatos   | Min   | Max    | Risco  |
 * |------------|-------|--------|--------|
 * | < 30       | 1500  | 3000   | Baixo  |
 * | 30 – 100   | 3000  | 8000   | Baixo  |
 * | 101 – 300  | 5000  | 15000  | Médio  |
 * | > 300      | 10000 | 20000  | Alto   |
 */
function getDelayRange(contactCount) {
  if (contactCount < 30)  return { min: 1500,  max: 3000  };
  if (contactCount <= 100) return { min: 3000,  max: 8000  };
  if (contactCount <= 300) return { min: 5000,  max: 15000 };
  return                          { min: 10000, max: 20000 };
}

async function sendSingleMessage(phone, message) {
  const client = getClient();
  try {
    await client.sendMessage(toChatId(phone), message);
    return { phone, status: 'sent', sentAt: new Date().toISOString() };
  } catch (err) {
    return { phone, status: 'failed', error: err.message };
  }
}

/**
 * Envia uma mensagem (com ou sem mídia) para um chatId já resolvido.
 * Reutilizado tanto pelo envio a contatos quanto por grupos.
 * O parâmetro `label` é usado apenas para log.
 */
async function sendTemplateMessage(client, chatId, template, contact) {
  const footer = '\n\n🤖 _Mensagem enviada pelo Bot EnviaZap_';

  if (template.media && template.media.path) {
    const mediaAbsPath = path.resolve(process.cwd(), template.media.path);
    const media = MessageMedia.fromFilePath(mediaAbsPath);

    if (template.media.type === 'audio') {
      if (template.content) {
        const text = interpolate(template.content, contact) + footer;
        await client.sendMessage(chatId, text);
      }
      const msg = await client.sendMessage(chatId, media, {
        sendAudioAsVoice: template.media.asVoice || false,
      });
      if (!template.content) {
        await client.sendMessage(chatId, footer.trim());
      }
      return msg;
    } else {
      const caption = interpolate(template.media.caption || template.content, contact) + footer;
      return await client.sendMessage(chatId, media, { caption });
    }
  } else {
    const text = interpolate(template.content, contact) + footer;
    return await client.sendMessage(chatId, text);
  }
}

async function sendBulkMessages(templateId, options = {}) {
  const { group } = options;

  const template = await getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template com id "${templateId}" não encontrado.`);
  }

  // Valida o arquivo de mídia antes de iniciar o envio
  if (template.media && template.media.path) {
    const mediaAbsPath = path.resolve(process.cwd(), template.media.path);
    if (!fs.existsSync(mediaAbsPath)) {
      throw new Error(
        `Arquivo de mídia não encontrado: "${template.media.path}". ` +
        `Coloque o arquivo na pasta "media/" e tente novamente.`
      );
    }
  }

  const contacts = await getActiveContacts(group);
  if (contacts.length === 0) {
    logger.warn('Nenhum contato ativo encontrado para os filtros informados.');
    return [];
  }

  const { min: delayMin, max: delayMax } = getDelayRange(contacts.length);
  logger.info(`Delay automático: ${delayMin / 1000}–${delayMax / 1000}s por envio (${contacts.length} contatos)`);

  const client = getClient();
  const results = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    logger.progress(i + 1, contacts.length, contact.name);

    try {
      const chatId = toChatId(contact.phone);
      const msg = await sendTemplateMessage(client, chatId, template, contact);
      logger.success(`Enviado para ${contact.name} (${contact.phone}) — id: ${msg.id.id}`);
      results.push({
        phone: contact.phone,
        name: contact.name,
        status: 'sent',
        sentAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(`Falha ao enviar para ${contact.name} (${contact.phone}): ${err.message}`);
      results.push({
        phone: contact.phone,
        name: contact.name,
        status: 'failed',
        error: err.message,
      });
    }

    // Delay entre envios (não aplica após o último)
    if (i < contacts.length - 1) {
      const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
      logger.info(`Aguardando ${(delay / 1000).toFixed(1)}s antes do próximo envio...`);
      await randomDelay(delayMin, delayMax);
    }
  }

  return results;
}

/**
 * Envia uma mensagem de um template para múltiplos grupos do WhatsApp.
 * @param {string} templateId
 * @param {{ id: string, name: string }[]} groups - Lista de grupos selecionados
 * @returns {SendResult[]}
 */
async function sendBulkToGroups(templateId, groups) {
  const template = await getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template com id "${templateId}" não encontrado.`);
  }

  if (template.media && template.media.path) {
    const mediaAbsPath = path.resolve(process.cwd(), template.media.path);
    if (!fs.existsSync(mediaAbsPath)) {
      throw new Error(
        `Arquivo de mídia não encontrado: "${template.media.path}". ` +
        `Coloque o arquivo na pasta "media/" e tente novamente.`
      );
    }
  }

  if (groups.length === 0) {
    logger.warn('Nenhum grupo selecionado.');
    return [];
  }

  // Para grupos usamos delay fixo curto — um grupo é um único envio
  const { min: delayMin, max: delayMax } = getDelayRange(groups.length);
  logger.info(`Delay automático: ${delayMin / 1000}–${delayMax / 1000}s entre grupos (${groups.length} grupos)`);

  const client = getClient();
  const results = [];
  // name: null sinaliza contexto de grupo para interpolate()
  // ({name} vira "Grupo"/"grupo" conforme posição no texto)
  const groupContact = { name: null, phone: '', group: '' };

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    logger.progress(i + 1, groups.length, group.name);

    try {
      const msg = await sendTemplateMessage(client, group.id, template, groupContact);
      logger.success(`Enviado para o grupo "${group.name}" — id: ${msg.id.id}`);
      results.push({ id: group.id, name: group.name, status: 'sent', sentAt: new Date().toISOString() });
    } catch (err) {
      logger.error(`Falha ao enviar para o grupo "${group.name}": ${err.message}`);
      results.push({ id: group.id, name: group.name, status: 'failed', error: err.message });
    }

    if (i < groups.length - 1) {
      const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
      logger.info(`Aguardando ${(delay / 1000).toFixed(1)}s antes do próximo grupo...`);
      await randomDelay(delayMin, delayMax);
    }
  }

  return results;
}

module.exports = { sendBulkMessages, sendBulkToGroups, sendSingleMessage, randomDelay };
