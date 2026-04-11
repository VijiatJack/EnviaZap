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

async function sendSingleMessage(phone, message) {
  const client = getClient();
  try {
    await client.sendMessage(toChatId(phone), message);
    return { phone, status: 'sent', sentAt: new Date().toISOString() };
  } catch (err) {
    return { phone, status: 'failed', error: err.message };
  }
}

async function sendBulkMessages(templateId, options = {}) {
  const { delayMin = 3000, delayMax = 8000, group } = options;

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

  const client = getClient();
  const results = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    logger.progress(i + 1, contacts.length, contact.name);

    try {
      const chatId = toChatId(contact.phone);

      let msg;
      if (template.media && template.media.path) {
        const mediaAbsPath = path.resolve(process.cwd(), template.media.path);
        const media = MessageMedia.fromFilePath(mediaAbsPath);
        const caption = interpolate(template.media.caption || template.content, contact);
        msg = await client.sendMessage(chatId, media, { caption });
      } else {
        const text = interpolate(template.content, contact);
        msg = await client.sendMessage(chatId, text);
      }

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

module.exports = { sendBulkMessages, sendSingleMessage, randomDelay };
