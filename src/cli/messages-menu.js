const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { loadTemplates, addTemplate, deleteTemplate } = require('../modules/messages');
const { listMediaFiles, addMedia } = require('./media-menu');
const logger = require('../utils/logger');

const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_VIDEO_EXTS = ['.mp4', '.3gp'];
const ALLOWED_AUDIO_EXTS = ['.mp3', '.m4a', '.aac', '.wav', '.ogg'];

async function showMessagesMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Gerenciar mensagens:',
      choices: [
        { name: 'Listar templates', value: 'list' },
        { name: 'Criar novo template', value: 'add' },
        { name: 'Excluir template', value: 'delete' },
        { name: '← Voltar ao menu principal', value: 'back' },
      ],
    },
  ]);

  if (action === 'list') await listTemplates();
  else if (action === 'add') await addTemplateFlow();
  else if (action === 'delete') await deleteTemplateFlow();

  if (action !== 'back') {
    return showMessagesMenu();
  }
}

async function listTemplates() {
  const templates = await loadTemplates();

  if (templates.length === 0) {
    logger.warn('Nenhum template cadastrado ainda.');
    return;
  }

  console.log('');
  for (const t of templates) {
    console.log(chalk.bold(`[${t.id.slice(0, 8)}...] ${t.name}`));
    if (t.content) {
      console.log(chalk.gray(`  Texto: ${t.content.slice(0, 80)}${t.content.length > 80 ? '...' : ''}`));
    }
    if (t.media) {
      const voiceTag = t.media.type === 'audio' && t.media.asVoice ? ' · mensagem de voz' : '';
      console.log(chalk.magenta(`  Mídia: [${t.media.type}${voiceTag}] ${t.media.path}`));
      if (t.media.caption) {
        console.log(chalk.gray(`  Legenda: ${t.media.caption.slice(0, 80)}`));
      }
    }
    if (t.variables && t.variables.length > 0) {
      console.log(chalk.cyan(`  Variáveis: ${t.variables.map((v) => `{${v}}`).join(', ')}`));
    }
    console.log('');
  }
}

async function addTemplateFlow() {
  const { name } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Nome do template:',
      validate: (v) => v.trim() !== '' || 'O nome não pode ser vazio.',
    },
  ]);

  const { hasText } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'hasText',
      message: 'Deseja incluir uma mensagem de texto?',
      default: true,
    },
  ]);

  let content = '';
  if (hasText) {
    const ans = await inquirer.prompt([
      {
        type: 'editor',
        name: 'content',
        message: 'Digite o texto da mensagem (use {name}, {phone}, {group} como variáveis):',
      },
    ]);
    content = ans.content;
  }

  const { mediaChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mediaChoice',
      message: 'Deseja anexar mídia?',
      choices: [
        { name: 'Não', value: 'none' },
        { name: 'Imagem (jpg, png, gif)', value: 'image' },
        { name: 'Vídeo (mp4)', value: 'video' },
        { name: 'Áudio (mp3, ogg, m4a...)', value: 'audio' },
      ],
    },
  ]);

  let mediaPath = '';
  let mediaType = '';
  let caption = '';
  let asVoice = false;

  if (mediaChoice !== 'none') {
    mediaType = mediaChoice;
    mediaPath = await pickOrAddMediaFile(mediaChoice);

    if (mediaPath) {
      if (mediaChoice === 'audio') {
        const { asVoiceAns } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'asVoiceAns',
            message: 'Enviar como mensagem de voz? (aparece com ícone de microfone)',
            default: false,
          },
        ]);
        asVoice = asVoiceAns;
      } else {
        const { captionAns } = await inquirer.prompt([
          {
            type: 'input',
            name: 'captionAns',
            message: 'Legenda da mídia (opcional, suporta {name}, {phone}, {group}):',
          },
        ]);
        caption = captionAns;
      }
    }
  }

  try {
    const template = await addTemplate(name, content, mediaPath, mediaType, caption, asVoice);
    logger.success(`Template "${template.name}" criado com sucesso! (id: ${template.id.slice(0, 8)}...)`);
  } catch (err) {
    logger.error(err.message);
  }
}

/**
 * Exibe a lista de mídias disponíveis do tipo solicitado.
 * Oferece opções para selecionar um arquivo existente, adicionar uma nova mídia,
 * ou informar o caminho manualmente.
 */
async function pickOrAddMediaFile(type) {
  const mediaFiles = listMediaFiles(type);

  const choices = [
    ...mediaFiles.map((f) => ({ name: f, value: path.join('media', f) })),
    new inquirer.Separator(),
    { name: '➕  Adicionar nova mídia da minha máquina', value: '__add__' },
    { name: '✏️   Informar caminho manualmente', value: '__manual__' },
  ];

  const { fileChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'fileChoice',
      message: mediaFiles.length > 0
        ? 'Selecione a mídia:'
        : 'Nenhuma mídia encontrada em "media/". O que deseja fazer?',
      choices,
    },
  ]);

  if (fileChoice === '__add__') {
    await addMedia();
    // Após adicionar, tenta selecionar novamente da lista atualizada
    return pickOrAddMediaFile(type);
  }

  if (fileChoice === '__manual__') {
    return askMediaPath(type);
  }

  return fileChoice;
}

async function askMediaPath(mediaChoice) {
  const allowedExts = mediaChoice === 'image'
    ? ALLOWED_IMAGE_EXTS
    : mediaChoice === 'video'
    ? ALLOWED_VIDEO_EXTS
    : ALLOWED_AUDIO_EXTS;
  const { filePath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'filePath',
      message: 'Caminho do arquivo (ex: media/imagem.jpg):',
      validate: (v) => {
        if (!v.trim()) return 'O caminho não pode ser vazio.';
        const ext = path.extname(v).toLowerCase();
        if (!allowedExts.includes(ext)) {
          return `Extensão inválida. Use: ${allowedExts.join(', ')}`;
        }
        return true;
      },
    },
  ]);
  return filePath;
}

async function deleteTemplateFlow() {
  const templates = await loadTemplates();

  if (templates.length === 0) {
    logger.warn('Nenhum template cadastrado para excluir.');
    return;
  }

  const { id } = await inquirer.prompt([
    {
      type: 'list',
      name: 'id',
      message: 'Selecione o template para excluir:',
      choices: templates.map((t) => ({
        name: `${t.name}${t.media ? ' [com mídia]' : ''}`,
        value: t.id,
      })),
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Confirmar exclusão?',
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Operação cancelada.');
    return;
  }

  try {
    await deleteTemplate(id);
    logger.success('Template excluído com sucesso.');
  } catch (err) {
    logger.error(err.message);
  }
}

module.exports = { showMessagesMenu, addTemplateFlow };
