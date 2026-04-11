# EnviaZap

Bot WhatsApp para envio de mensagens em massa com suporte a texto, imagens e vídeos.

## Funcionalidades

- Envio em massa para lista de contatos (CSV)
- Suporte a texto, imagens (jpg, png, gif) e vídeos (mp4)
- Variáveis dinâmicas nas mensagens: `{name}`, `{phone}`, `{group}`
- Gerenciamento de contatos (adicionar, listar, desativar)
- Gerenciamento de templates de mensagens com mídia
- Delay automático entre envios ajustado ao volume da lista (anti-ban)
- Sessão persistente via QR Code (sem novo QR a cada reinício)

## Requisitos

- Node.js 18+
- Conta WhatsApp ativa no celular

## Instalação

```bash
npm install
```

## Uso

```bash
node index.js
```

Na primeira execução, um QR Code será exibido no terminal.

**No celular:** WhatsApp → Dispositivos conectados → Conectar dispositivo → escaneie o QR.

A sessão é salva localmente. Execuções seguintes reconectam automaticamente.

## Estrutura do projeto

```
├── index.js              # Entry point
├── src/
│   ├── client/
│   │   └── whatsapp.js   # Gerenciamento do cliente WhatsApp
│   ├── modules/
│   │   ├── contacts.js   # CRUD de contatos (CSV)
│   │   ├── messages.js   # CRUD de templates (JSON)
│   │   └── bulk-sender.js# Envio em massa
│   ├── cli/
│   │   ├── menu.js       # Menu principal
│   │   ├── contacts-menu.js
│   │   └── messages-menu.js
│   └── utils/
│       ├── logger.js     # Log colorido
│       └── formatter.js  # Validação de telefone BR
├── data/                 # Gerado automaticamente (gitignored)
│   ├── contacts.csv
│   └── messages.json
└── media/                # Coloque imagens e vídeos aqui (gitignored)
```

## Formato dos contatos (CSV)

| Campo      | Exemplo              | Descrição                          |
|------------|----------------------|------------------------------------|
| name       | João Silva           | Nome do contato                    |
| phone      | 5511991234567        | DDI + DDD + número (sem +)         |
| group      | turma-2024           | Tag opcional para filtro de envio  |
| active     | true                 | Se deve receber mensagens          |

## Variáveis nas mensagens

Use `{name}`, `{phone}` e `{group}` no texto ou legenda da mídia. Elas são substituídas pelos dados de cada contato no momento do envio.

## Delay entre envios (anti-ban)

O bot ajusta automaticamente o intervalo de espera entre mensagens com base no número de destinatários da lista.

| Contatos   | Delay automático | Risco estimado |
|------------|------------------|----------------|
| Menos de 30      | 2–5s             | Baixo          |
| 30 a 100   | 3–8s             | Baixo          |
| 101 a 300  | 5–15s            | Médio          |
| Mais de 300      | 10–20s           | Alto           |

O maior fator de risco não é apenas a velocidade, mas a combinação de volume + frequência de uso + histórico do número. Números novos têm risco maior de ban do que números já estabelecidos.

> Nunca use o bot para enviar mensagens não solicitadas. Contatos que não conhecem o remetente podem marcar a mensagem como spam, aumentando o risco de banimento.

## Observações

- A pasta `data/` e `media/` são ignoradas pelo git (dados pessoais)
- A pasta `.wwebjs_auth/` (sessão WhatsApp) também é ignorada
- Nunca compartilhe a pasta `.wwebjs_auth/` — ela contém suas credenciais de sessão
