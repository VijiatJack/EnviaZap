const inquirer = require('inquirer');
const chalk = require('chalk');
const { loadContacts, addContact, deactivateContact } = require('../modules/contacts');
const logger = require('../utils/logger');

async function showContactsMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Gerenciar contatos:',
      choices: [
        { name: 'Listar contatos', value: 'list' },
        { name: 'Adicionar contato', value: 'add' },
        { name: 'Desativar contato', value: 'deactivate' },
        { name: '← Voltar ao menu principal', value: 'back' },
      ],
    },
  ]);

  if (action === 'list') await listContacts();
  else if (action === 'add') await addContactFlow();
  else if (action === 'deactivate') await deactivateContactFlow();

  if (action !== 'back') {
    return showContactsMenu();
  }
}

async function listContacts() {
  const contacts = await loadContacts();

  if (contacts.length === 0) {
    logger.warn('Nenhum contato cadastrado ainda.');
    return;
  }

  console.log('');
  console.log(chalk.bold(`${'Nome'.padEnd(25)} ${'Telefone'.padEnd(16)} ${'Grupo'.padEnd(15)} Status`));
  console.log(chalk.gray('─'.repeat(70)));

  for (const c of contacts) {
    const status = c.active ? chalk.green('ativo') : chalk.red('inativo');
    console.log(
      `${String(c.name).padEnd(25)} ${String(c.phone).padEnd(16)} ${String(c.group || '—').padEnd(15)} ${status}`
    );
  }

  const ativos = contacts.filter((c) => c.active).length;
  console.log(chalk.gray('─'.repeat(70)));
  console.log(chalk.cyan(`Total: ${contacts.length} contatos (${ativos} ativos)`));
  console.log('');
}

async function addContactFlow() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Nome do contato:',
      validate: (v) => v.trim() !== '' || 'O nome não pode ser vazio.',
    },
    {
      type: 'input',
      name: 'phone',
      message: 'Telefone (ex: 98 99123-4567 ou 5598991234567):',
      validate: (v) => v.trim() !== '' || 'O telefone não pode ser vazio.',
    },
    {
      type: 'input',
      name: 'group',
      message: 'Grupo/Tag (opcional, deixe vazio para ignorar):',
    },
  ]);

  try {
    const contact = await addContact(answers);
    logger.success(`Contato "${contact.name}" (${contact.phone}) adicionado com sucesso!`);
  } catch (err) {
    logger.error(err.message);
  }
}

async function deactivateContactFlow() {
  const contacts = await loadContacts();
  const ativos = contacts.filter((c) => c.active);

  if (ativos.length === 0) {
    logger.warn('Nenhum contato ativo para desativar.');
    return;
  }

  const { phone } = await inquirer.prompt([
    {
      type: 'list',
      name: 'phone',
      message: 'Selecione o contato para desativar:',
      choices: ativos.map((c) => ({
        name: `${c.name} (${c.phone})${c.group ? ' [' + c.group + ']' : ''}`,
        value: c.phone,
      })),
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Confirmar desativação?',
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Operação cancelada.');
    return;
  }

  try {
    await deactivateContact(phone);
    logger.success('Contato desativado com sucesso.');
  } catch (err) {
    logger.error(err.message);
  }
}

module.exports = { showContactsMenu };
