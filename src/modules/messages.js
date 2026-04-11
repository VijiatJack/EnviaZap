const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_PATH = path.join(process.cwd(), 'data', 'messages.json');

function ensureDataDir() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function loadTemplates() {
  try {
    const raw = await fs.promises.readFile(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.templates || [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function saveTemplates(templates) {
  ensureDataDir();
  await fs.promises.writeFile(DATA_PATH, JSON.stringify({ templates }, null, 2), 'utf8');
}

async function addTemplate(name, content, mediaPath, mediaType, caption, asVoice = false) {
  if (!name || !name.trim()) throw new Error('O nome do template não pode ser vazio.');

  const hasMedia = mediaPath && mediaPath.trim() !== '';
  const hasText = content && content.trim() !== '';

  if (!hasText && !hasMedia) {
    throw new Error('O template precisa ter texto ou mídia (ou ambos).');
  }

  const allText = [content || '', caption || ''].join(' ');
  const variables = [...new Set([...allText.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];

  const template = {
    id: crypto.randomUUID(),
    name: name.trim(),
    content: hasText ? content.trim() : '',
    variables,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (hasMedia) {
    template.media = {
      type: mediaType || 'image',
      path: mediaPath.trim(),
      ...(mediaType === 'audio'
        ? { asVoice: Boolean(asVoice) }
        : { caption: caption ? caption.trim() : '' }),
    };
  }

  const templates = await loadTemplates();
  templates.push(template);
  await saveTemplates(templates);
  return template;
}

async function getTemplateById(id) {
  const templates = await loadTemplates();
  return templates.find((t) => t.id === id) || null;
}

async function deleteTemplate(id) {
  const templates = await loadTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  if (filtered.length === templates.length) {
    throw new Error(`Template com id "${id}" não encontrado.`);
  }
  await saveTemplates(filtered);
}

/**
 * Substitui variáveis {name}, {phone}, {group} pelo valor do contato.
 * Função pura — sem I/O.
 */
function interpolate(text, contact) {
  if (!text) return '';
  return text
    .replace(/\{name\}/g, contact.name || '')
    .replace(/\{phone\}/g, contact.phone || '')
    .replace(/\{group\}/g, contact.group || '');
}

module.exports = { loadTemplates, saveTemplates, addTemplate, getTemplateById, deleteTemplate, interpolate };
