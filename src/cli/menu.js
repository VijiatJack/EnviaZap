const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const { sendBulkMessages, sendBulkToGroups } = require('../modules/bulk-sender');
const { loadTemplates } = require('../modules/messages');
const { getActiveContacts } = require('../modules/contacts');
const { fetchGroups } = require('../modules/groups');
const { showContactsMenu } = require('./contacts-menu');
const { showMessagesMenu, addTemplateFlow } = require('./messages-menu');
const { showMediaMenu } = require('./media-menu');
const { showGroupsMenu } = require('./groups-menu');
const { destroyClient } = require('../client/whatsapp');
const logger = require('../utils/logger');

async function showMainMenu() {
  console.log('');
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Menu principal — o que deseja fazer?',
      choices: [
        { name: '📨  Enviar mensagem em massa (contatos)', value: 'send' },
        { name: '📢  Enviar mensagem para grupos', value: 'send-groups' },
        { name: '👥  Gerenciar contatos', value: 'contacts' },
        { name: '💬  Gerenciar grupos', value: 'groups' },
        { name: '📝  Gerenciar mensagens', value: 'messages' },
        { name: '🖼️   Gerenciar mídias', value: 'media' },
        { name: '🚪  Sair', value: 'exit' },
      ],
    },
  ]);

  if (action === 'send') await showBulkSendWizard();
  else if (action === 'send-groups') await showGroupSendWizard();
  else if (action === 'contacts') await showContactsMenu();
  else if (action === 'groups') await showGroupsMenu();
  else if (action === 'messages') await showMessagesMenu();
  else if (action === 'media') await showMediaMenu();
  else if (action === 'exit') {
    logger.info('Encerrando o bot...');
    await destroyClient();
    process.exit(0);
  }

  return showMainMenu();
}

async function showBulkSendWizard() {
  const templates = await loadTemplates();

  // Passo 1: selecionar template (ou criar um novo)
  const choices = [
    ...templates.map((t) => ({
      name: `${t.name}${t.media ? chalk.magenta(' [com mídia]') : ''}`,
      value: t.id,
    })),
    ...(templates.length > 0 ? [new inquirer.Separator()] : []),
    { name: '➕  Criar novo template', value: '__new__' },
  ];

  const { templateId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'templateId',
      message: 'Selecione o template de mensagem:',
      choices,
    },
  ]);

  if (templateId === '__new__') {
    await addTemplateFlow();
    return showBulkSendWizard();
  }

  // Passo 2: filtrar por grupo (opcional)
  const { group } = await inquirer.prompt([
    {
      type: 'input',
      name: 'group',
      message: 'Filtrar por grupo/tag? (deixe vazio para enviar a todos):',
    },
  ]);

  // Passo 3: confirmar quantidade
  const contacts = await getActiveContacts(group || undefined);

  if (contacts.length === 0) {
    logger.warn(
      group
        ? `Nenhum contato ativo no grupo "${group}".`
        : 'Nenhum contato ativo cadastrado.'
    );
    return;
  }

  const template = templates.find((t) => t.id === templateId);
  console.log('');
  console.log(chalk.bold('─── Resumo do envio ───────────────────────────'));
  console.log(`  Template:      ${template.name}`);
  if (template.media) {
    console.log(`  Mídia:         [${template.media.type}] ${template.media.path}`);
  }
  console.log(`  Destinatários: ${chalk.cyan(contacts.length)} contatos`);
  if (group) {
    console.log(`  Grupo:         ${group}`);
  }
  console.log(chalk.bold('───────────────────────────────────────────────'));
  console.log('');

  // Passo 4: confirmar envio
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Confirmar envio para ${contacts.length} contatos?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Envio cancelado.');
    return;
  }

  // Passo 5: enviar
  console.log('');
  logger.info('Iniciando envio... (delay de 3–8s entre cada mensagem)');
  console.log('');

  let results;
  try {
    results = await sendBulkMessages(templateId, { group: group || undefined });
  } catch (err) {
    logger.error(`Erro ao iniciar envio: ${err.message}`);
    return;
  }

  // Passo 6: relatório final
  const sent = results.filter((r) => r.status === 'sent');
  const failed = results.filter((r) => r.status === 'failed');

  console.log('');
  console.log(chalk.bold('─── Relatório Final ────────────────────────────'));
  console.log(`  ${chalk.green('Enviados:')}  ${sent.length}`);
  console.log(`  ${chalk.red('Falhos:')}    ${failed.length}`);

  if (failed.length > 0) {
    console.log('');
    console.log(chalk.red('  Falhas:'));
    for (const r of failed) {
      console.log(chalk.red(`    • ${r.name} (${r.phone}): ${r.error}`));
    }
  }

  console.log(chalk.bold('────────────────────────────────────────────────'));
  console.log('');
}

async function showGroupSendWizard() {
  const templates = await loadTemplates();

  // Passo 1: selecionar template (ou criar novo)
  const templateChoices = [
    ...templates.map((t) => ({
      name: `${t.name}${t.media ? chalk.magenta(' [com mídia]') : ''}`,
      value: t.id,
    })),
    ...(templates.length > 0 ? [new inquirer.Separator()] : []),
    { name: '➕  Criar novo template', value: '__new__' },
  ];

  const { templateId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'templateId',
      message: 'Selecione o template de mensagem:',
      choices: templateChoices,
    },
  ]);

  if (templateId === '__new__') {
    await addTemplateFlow();
    return showGroupSendWizard();
  }

  // Passo 2: buscar e selecionar grupos (múltipla escolha)
  logger.info('Buscando grupos do WhatsApp...');
  const groups = await fetchGroups();

  if (groups.length === 0) {
    logger.warn('Nenhum grupo encontrado. Participe de ao menos um grupo no WhatsApp.');
    return;
  }

  const { selectedGroupIds } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedGroupIds',
      message: 'Selecione os grupos destinatários (espaço para marcar):',
      choices: groups.map((g) => ({
        name: `${g.name} (${g.participantCount} participantes)`,
        value: g.id,
      })),
      validate: (v) => v.length > 0 || 'Selecione ao menos um grupo.',
    },
  ]);

  const selectedGroups = groups.filter((g) => selectedGroupIds.includes(g.id));
  const template = templates.find((t) => t.id === templateId);

  // Passo 3: resumo e confirmação
  console.log('');
  console.log(chalk.bold('─── Resumo do envio ───────────────────────────'));
  console.log(`  Template:  ${template.name}`);
  if (template.media) {
    console.log(`  Mídia:     [${template.media.type}] ${template.media.path}`);
  }
  console.log(`  Grupos:    ${chalk.cyan(selectedGroups.length)}`);
  for (const g of selectedGroups) {
    console.log(`    • ${g.name} (${g.participantCount} participantes)`);
  }
  console.log(chalk.bold('───────────────────────────────────────────────'));
  console.log('');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Confirmar envio para ${selectedGroups.length} grupo(s)?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Envio cancelado.');
    return;
  }

  // Passo 4: enviar
  console.log('');
  logger.info('Iniciando envio para grupos...');
  console.log('');

  let results;
  try {
    results = await sendBulkToGroups(templateId, selectedGroups);
  } catch (err) {
    logger.error(`Erro ao iniciar envio: ${err.message}`);
    return;
  }

  // Passo 5: relatório final
  const sent = results.filter((r) => r.status === 'sent');
  const failed = results.filter((r) => r.status === 'failed');

  console.log('');
  console.log(chalk.bold('─── Relatório Final ────────────────────────────'));
  console.log(`  ${chalk.green('Enviados:')}  ${sent.length} grupo(s)`);
  console.log(`  ${chalk.red('Falhos:')}    ${failed.length} grupo(s)`);

  if (failed.length > 0) {
    console.log('');
    console.log(chalk.red('  Falhas:'));
    for (const r of failed) {
      console.log(chalk.red(`    • ${r.name}: ${r.error}`));
    }
  }

  console.log(chalk.bold('────────────────────────────────────────────────'));
  console.log('');
}

module.exports = { showMainMenu, showBulkSendWizard, showGroupSendWizard };
