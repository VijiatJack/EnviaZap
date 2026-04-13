const inquirer = require('inquirer');
const chalk = require('chalk');
const { fetchGroups, fetchGroupParticipants, createGroup } = require('../modules/groups');
const { loadContacts } = require('../modules/contacts');
const { formatBrazilianPhone } = require('../utils/formatter');
const logger = require('../utils/logger');

async function showGroupsMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Gerenciar grupos:',
      choices: [
        { name: 'Listar grupos que participo', value: 'list' },
        { name: 'Ver participantes de um grupo', value: 'participants' },
        { name: 'Criar novo grupo', value: 'create' },
        { name: '← Voltar ao menu principal', value: 'back' },
      ],
    },
  ]);

  if (action === 'list') await listGroups();
  else if (action === 'participants') await showParticipants();
  else if (action === 'create') await createGroupFlow();

  if (action !== 'back') return showGroupsMenu();
}

async function listGroups() {
  logger.info('Buscando grupos...');
  const groups = await fetchGroups();

  if (groups.length === 0) {
    logger.warn('Nenhum grupo encontrado.');
    return;
  }

  console.log('');
  console.log(chalk.bold(`${'Nome'.padEnd(40)} Participantes`));
  console.log(chalk.gray('─'.repeat(56)));
  for (const g of groups) {
    console.log(`${String(g.name).padEnd(40)} ${chalk.cyan(g.participantCount)}`);
  }
  console.log(chalk.gray('─'.repeat(56)));
  console.log(chalk.cyan(`Total: ${groups.length} grupos`));
  console.log('');
}

async function showParticipants() {
  logger.info('Buscando grupos...');
  const groups = await fetchGroups();

  if (groups.length === 0) {
    logger.warn('Nenhum grupo encontrado.');
    return;
  }

  const { groupId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'groupId',
      message: 'Selecione o grupo:',
      choices: groups.map((g) => ({
        name: `${g.name} (${g.participantCount} participantes)`,
        value: g.id,
      })),
    },
  ]);

  logger.info('Buscando participantes...');
  const participants = await fetchGroupParticipants(groupId);

  console.log('');
  for (const p of participants) {
    const adminTag = p.isAdmin ? chalk.yellow(' [admin]') : '';
    console.log(`  +${p.phone}${adminTag}`);
  }
  console.log(chalk.gray(`\n  Total: ${participants.length} participantes`));
  console.log('');
}

async function createGroupFlow() {
  const { name } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Nome do novo grupo:',
      validate: (v) => v.trim() !== '' || 'O nome não pode ser vazio.',
    },
  ]);

  const phones = [];

  // --- Origem 1: contatos do CSV ---
  const { addFromCsv } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addFromCsv',
      message: 'Adicionar contatos da sua lista (CSV)?',
      default: true,
    },
  ]);

  if (addFromCsv) {
    const contacts = await loadContacts();
    const active = contacts.filter((c) => c.active);

    if (active.length === 0) {
      logger.warn('Nenhum contato ativo na lista.');
    } else {
      // Pergunta se quer filtrar por tag ou selecionar individualmente
      const { csvMode } = await inquirer.prompt([
        {
          type: 'list',
          name: 'csvMode',
          message: 'Como deseja selecionar os contatos do CSV?',
          choices: [
            { name: 'Selecionar individualmente', value: 'individual' },
            { name: 'Por tag/grupo', value: 'tag' },
          ],
        },
      ]);

      if (csvMode === 'individual') {
        const { selected } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selected',
            message: 'Selecione os contatos (espaço para marcar):',
            choices: active.map((c) => ({
              name: `${c.name} (${c.phone})${c.group ? ' [' + c.group + ']' : ''}`,
              value: c.phone,
            })),
          },
        ]);
        phones.push(...selected);
      } else {
        const tags = [...new Set(active.map((c) => c.group).filter(Boolean))];
        if (tags.length === 0) {
          logger.warn('Nenhuma tag cadastrada. Selecione individualmente.');
        } else {
          const { selectedTags } = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'selectedTags',
              message: 'Selecione as tags:',
              choices: tags,
            },
          ]);
          const filtered = active
            .filter((c) => selectedTags.includes(c.group))
            .map((c) => c.phone);
          phones.push(...filtered);
          logger.info(`${filtered.length} contatos adicionados das tags selecionadas.`);
        }
      }
    }
  }

  // --- Origem 2: participantes de outro grupo ---
  const { addFromGroup } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addFromGroup',
      message: 'Adicionar participantes de outro grupo?',
      default: false,
    },
  ]);

  if (addFromGroup) {
    logger.info('Buscando grupos...');
    const groups = await fetchGroups();

    if (groups.length === 0) {
      logger.warn('Nenhum grupo encontrado.');
    } else {
      const { sourceGroupId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'sourceGroupId',
          message: 'Selecione o grupo de origem:',
          choices: groups.map((g) => ({
            name: `${g.name} (${g.participantCount} participantes)`,
            value: g.id,
          })),
        },
      ]);

      logger.info('Buscando participantes...');
      const participants = await fetchGroupParticipants(sourceGroupId);

      const { selectedParticipants } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedParticipants',
          message: 'Selecione os participantes a incluir (espaço para marcar):',
          choices: participants.map((p) => ({
            name: `+${p.phone}${p.isAdmin ? ' [admin]' : ''}`,
            value: p.phone,
          })),
        },
      ]);
      phones.push(...selectedParticipants);
      logger.info(`${selectedParticipants.length} participantes adicionados do grupo.`);
    }
  }

  // --- Origem 3: números avulsos ---
  let addingManual = true;
  while (addingManual) {
    const { addManual } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addManual',
        message: 'Adicionar número manualmente?',
        default: false,
      },
    ]);

    if (!addManual) {
      addingManual = false;
    } else {
      const { phone } = await inquirer.prompt([
        {
          type: 'input',
          name: 'phone',
          message: 'Número (ex: 98 99123-4567 ou 5598991234567):',
          validate: (v) => v.trim() !== '' || 'Informe um número.',
        },
      ]);
      try {
        const formatted = formatBrazilianPhone(phone);
        phones.push(formatted);
        logger.success(`${formatted} adicionado.`);
      } catch (err) {
        logger.error(err.message);
      }
    }
  }

  // Remove duplicatas
  const unique = [...new Set(phones)];

  if (unique.length === 0) {
    logger.warn('Nenhum participante selecionado. Criação cancelada.');
    return;
  }

  console.log('');
  console.log(chalk.bold('─── Resumo ────────────────────────────────'));
  console.log(`  Nome:          ${name}`);
  console.log(`  Participantes: ${chalk.cyan(unique.length)}`);
  console.log(chalk.bold('────────────────────────────────────────────'));
  console.log('');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Confirmar criação do grupo?',
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Operação cancelada.');
    return;
  }

  logger.info('Criando grupo...');
  try {
    const result = await createGroup(name, unique);
    logger.success(`Grupo "${name}" criado! (${result.groupId})`);
    if (result.failedParticipants.length > 0) {
      logger.warn(`Não foi possível adicionar: ${result.failedParticipants.join(', ')}`);
    }
  } catch (err) {
    logger.error(`Falha ao criar grupo: ${err.message}`);
  }
}

module.exports = { showGroupsMenu };
