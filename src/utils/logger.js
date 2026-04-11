const chalk = require('chalk');

function timestamp() {
  return new Date().toLocaleTimeString('pt-BR');
}

function info(message) {
  console.log(chalk.blue(`[${timestamp()}] [INFO] ${message}`));
}

function success(message) {
  console.log(chalk.green(`[${timestamp()}] [OK] ${message}`));
}

function warn(message) {
  console.log(chalk.yellow(`[${timestamp()}] [AVISO] ${message}`));
}

function error(message) {
  console.log(chalk.red(`[${timestamp()}] [ERRO] ${message}`));
}

function progress(current, total, name) {
  const percent = Math.round((current / total) * 100);
  console.log(chalk.cyan(`[${current}/${total}] (${percent}%) Enviando para ${name}...`));
}

module.exports = { info, success, warn, error, progress };
