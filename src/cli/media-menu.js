const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { loadTemplates } = require('../modules/messages');
const logger = require('../utils/logger');

const MEDIA_DIR = path.join(process.cwd(), 'media');
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.3gp', '.mp3', '.m4a', '.aac', '.wav', '.ogg'];

function ensureMediaDir() {
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

function listMediaFiles(type) {
  if (!fs.existsSync(MEDIA_DIR)) return [];
  const exts = type === 'image'
    ? ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    : type === 'video'
    ? ['.mp4', '.3gp']
    : type === 'audio'
    ? ['.mp3', '.m4a', '.aac', '.wav', '.ogg']
    : ALLOWED_EXTS;
  return fs.readdirSync(MEDIA_DIR).filter((f) => exts.includes(path.extname(f).toLowerCase()));
}

async function getMediaInUse() {
  const templates = await loadTemplates();
  return templates
    .filter((t) => t.media && t.media.path)
    .map((t) => path.basename(t.media.path));
}

/**
 * Abre o seletor de arquivos nativo do Windows via PowerShell.
 * Usa EncodedCommand para evitar problemas com escaping de aspas.
 */
function openFileDialog() {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    $d = New-Object System.Windows.Forms.OpenFileDialog
    $d.Filter = 'Imagens e Videos|*.jpg;*.jpeg;*.png;*.gif;*.webp|Videos|*.mp4;*.3gp|Audios|*.mp3;*.m4a;*.aac;*.wav;*.ogg|Todos os arquivos|*.*'
    $d.Title = 'EnviaZap - Selecionar Midia'
    if ($d.ShowDialog() -eq 'OK') { Write-Output $d.FileName }
  `;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  try {
    const result = execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, {
      encoding: 'utf8',
      timeout: 60000,
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

async function showMediaMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Gerenciar mídias:',
      choices: [
        { name: 'Listar mídias disponíveis', value: 'list' },
        { name: 'Adicionar nova mídia', value: 'add' },
        { name: 'Remover mídia', value: 'remove' },
        { name: '← Voltar ao menu principal', value: 'back' },
      ],
    },
  ]);

  if (action === 'list') await listMedia();
  else if (action === 'add') await addMedia();
  else if (action === 'remove') await removeMedia();

  if (action !== 'back') return showMediaMenu();
}

async function listMedia() {
  const files = listMediaFiles();
  const inUse = await getMediaInUse();

  if (files.length === 0) {
    logger.warn('Nenhuma mídia disponível na pasta "media/".');
    return;
  }

  console.log('');
  for (const f of files) {
    const stat = fs.statSync(path.join(MEDIA_DIR, f));
    const size = stat.size < 1024 * 1024
      ? (stat.size / 1024).toFixed(1) + ' KB'
      : (stat.size / (1024 * 1024)).toFixed(1) + ' MB';
    const tag = inUse.includes(f) ? chalk.yellow(' [em uso]') : '';
    console.log(`  ${chalk.cyan(f)}${tag}  ${chalk.gray(size)}`);
  }
  console.log('');
}

async function addMedia() {
  logger.info('Abrindo seleção de arquivo...');

  const selectedPath = openFileDialog();
  if (!selectedPath) {
    logger.warn('Nenhum arquivo selecionado.');
    return;
  }

  const ext = path.extname(selectedPath).toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) {
    logger.error(`Formato não suportado: "${ext}". Formatos aceitos: ${ALLOWED_EXTS.join(', ')}`);
    return;
  }

  const originalName = path.basename(selectedPath);

  const { rename } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'rename',
      message: `Arquivo selecionado: "${originalName}". Deseja renomeá-lo antes de salvar?`,
      default: false,
    },
  ]);

  let destName = originalName;
  if (rename) {
    const { newName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newName',
        message: 'Novo nome (sem extensão):',
        validate: (v) => v.trim() !== '' || 'O nome não pode ser vazio.',
      },
    ]);
    destName = newName.trim() + ext;
  }

  ensureMediaDir();
  const destPath = path.join(MEDIA_DIR, destName);

  if (fs.existsSync(destPath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Já existe um arquivo "${destName}". Substituir?`,
        default: false,
      },
    ]);
    if (!overwrite) {
      logger.info('Operação cancelada.');
      return;
    }
  }

  fs.copyFileSync(selectedPath, destPath);
  logger.success(`Mídia salva em "media/${destName}".`);
}

async function removeMedia() {
  const files = listMediaFiles();
  if (files.length === 0) {
    logger.warn('Nenhuma mídia disponível para remover.');
    return;
  }

  const inUse = await getMediaInUse();
  const removable = files.filter((f) => !inUse.includes(f));
  const blocked = files.filter((f) => inUse.includes(f));

  if (blocked.length > 0) {
    logger.warn(`Em uso por templates (não removível): ${blocked.map((f) => chalk.yellow(f)).join(', ')}`);
  }

  if (removable.length === 0) {
    logger.warn('Todas as mídias estão sendo usadas por templates. Remova os templates primeiro.');
    return;
  }

  const { file } = await inquirer.prompt([
    {
      type: 'list',
      name: 'file',
      message: 'Selecione a mídia para remover:',
      choices: removable,
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Confirmar remoção de "${file}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Operação cancelada.');
    return;
  }

  fs.unlinkSync(path.join(MEDIA_DIR, file));
  logger.success(`"${file}" removido com sucesso.`);
}

module.exports = { showMediaMenu, listMediaFiles, addMedia };
