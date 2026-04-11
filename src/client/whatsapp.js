const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');

const INIT_TIMEOUT_MS = 90_000;

let client = null;
let isReady = false;

function initializeClient() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(
        'Tempo limite de inicialização excedido (90s). ' +
        'Encerre processos Chrome manualmente e tente novamente.'
      ));
    }, INIT_TIMEOUT_MS);

    client = new Client({
      authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
      puppeteer: {
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-extensions',
        ],
      },
    });

    client.on('qr', (qr) => {
      logger.info('QR Code gerado. Escaneie com o WhatsApp:');
      console.log('');
      qrcode.generate(qr, { small: true });
      console.log('');
      logger.info('No celular: WhatsApp > Dispositivos conectados > Conectar dispositivo');
    });

    client.on('ready', () => {
      clearTimeout(timeout);
      isReady = true;
      logger.success('WhatsApp conectado com sucesso!');
      resolve();
    });

    client.on('authenticated', () => {
      logger.info('Autenticação realizada. Aguardando conexão...');
    });

    client.on('auth_failure', (msg) => {
      clearTimeout(timeout);
      logger.error(`Falha de autenticação: ${msg}`);
      logger.warn('Apague a pasta .wwebjs_auth e reinicie para gerar um novo QR Code.');
      reject(new Error(`Falha de autenticação: ${msg}`));
    });

    client.on('disconnected', (reason) => {
      isReady = false;
      logger.warn(`WhatsApp desconectado: ${reason}`);
      logger.warn('Reinicie o bot para reconectar.');
      process.exit(1);
    });

    client.initialize();
  });
}

function getClient() {
  if (!client || !isReady) {
    throw new Error('Cliente WhatsApp não está pronto. Aguarde a conexão.');
  }
  return client;
}

function isClientReady() {
  return isReady;
}

async function destroyClient() {
  if (client) {
    try {
      const proc = client.pupBrowser?.process();
      if (client.pupPage && !client.pupPage.isClosed()) {
        await client.pupPage.close();
      }
      await client.destroy();
      if (proc && !proc.killed) proc.kill('SIGKILL');
    } catch {
      // ignora erros no encerramento
    }
    client = null;
    isReady = false;
  }
}

module.exports = { initializeClient, getClient, isClientReady, destroyClient };
