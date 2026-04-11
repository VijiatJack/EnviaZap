const chalk = require('chalk');
const { initializeClient, destroyClient } = require('./src/client/whatsapp');
const { showMainMenu } = require('./src/cli/menu');
const logger = require('./src/utils/logger');

function printBanner() {
  console.log('');
  console.log(chalk.green('╔══════════════════════════════════════════╗'));
  console.log(chalk.green('║') + chalk.bold('        🤖  EnviaZap - WhatsApp Bot      ') + chalk.green('║'));
  console.log(chalk.green('║') + chalk.gray('     Envio em massa com suporte a mídia  ') + chalk.green('║'));
  console.log(chalk.green('╚══════════════════════════════════════════╝'));
  console.log('');
}

async function main() {
  printBanner();

  logger.info('Iniciando cliente WhatsApp...');
  logger.info('Se for a primeira vez, um QR Code será exibido para autenticação.');
  console.log('');

  try {
    await initializeClient();
  } catch (err) {
    logger.error(`Não foi possível conectar ao WhatsApp: ${err.message}`);
    process.exit(1);
  }

  await showMainMenu();
}

// Encerramento limpo ao pressionar Ctrl+C ou receber sinal do SO
async function shutdown(signal) {
  console.log('');
  logger.info(`Sinal ${signal} recebido. Encerrando...`);
  await destroyClient();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', async (err) => {
  logger.error(`Erro inesperado: ${err.message}`);
  await destroyClient().catch(() => {});
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Promise não tratada: ${reason}`);
});

main();
