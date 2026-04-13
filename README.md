# EnviaZap

Bot WhatsApp para envio de mensagens em massa via CLI, com suporte a texto, imagens, vídeos, áudio, templates com variáveis dinâmicas e gerenciamento completo de contatos, grupos e mídias.

---

## Funcionalidades

- **Envio em massa para contatos** — lista gerenciada via arquivo CSV com filtro por tag/grupo
- **Envio em massa para grupos** — selecione múltiplos grupos do WhatsApp de uma vez
- **Templates de mensagem** — salve e reutilize mensagens com variáveis `{name}`, `{phone}` e `{group}`
- **Suporte completo a mídia** — imagens (jpg, png, gif, webp), vídeos (mp4, 3gp) e áudio (mp3, m4a, ogg, wav, aac)
- **Mensagem de voz** — áudio enviado com ícone de microfone (via `asVoice`)
- **Gerenciamento de contatos** — adicionar, listar e desativar contatos pelo CLI
- **Gerenciamento de grupos** — listar grupos, ver participantes e criar novos grupos diretamente pelo bot
- **Gerenciador de mídias** — adicione arquivos via seletor de arquivo nativo do Windows, liste e remova
- **Delay automático anti-ban** — intervalo entre envios ajustado proporcionalmente ao volume da lista
- **Sessão persistente** — autenticação por QR Code salva localmente; reconexão automática nas próximas execuções
- **Relatório de envio** — exibe contagem de enviados/falhos com detalhes de cada erro ao final de cada campanha

---

## Requisitos

- **Node.js 18+**
- **Conta WhatsApp ativa** conectada ao celular (necessária para o QR Code)
- Sistema operacional: Windows (o seletor de mídia usa PowerShell), mas o núcleo funciona em qualquer OS

---

## Instalação

```bash
git clone <url-do-repositorio>
cd ufma_bot
npm install
```

---

## Uso

```bash
npm start
```

Na primeira execução, um QR Code será exibido no terminal.

**No celular:** WhatsApp → Dispositivos conectados → Conectar dispositivo → escaneie o QR.

A sessão é salva em `.wwebjs_auth/`. Execuções seguintes reconectam automaticamente sem novo QR.

---

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o bot em modo normal (navegador headless) |
| `npm run start:visible` | Inicia com o Chrome visível (útil para depuração) |
| `npm run dev` | Inicia com `--watch` (reinicia automaticamente ao salvar) |
| `npm run debug` | Inicia com inspetor Node.js (`--inspect`) |
| `npm test` | Executa todos os testes unitários |
| `npm run test:watch` | Testes em modo watch (reexecuta ao salvar) |
| `npm run test:coverage` | Testes com relatório de cobertura de código |
| `npm run kill-chrome` | Encerra processos Chrome presos (Windows) |

---

## Estrutura do projeto

```
├── index.js                    # Entry point: inicializa o cliente e o menu
├── src/
│   ├── client/
│   │   └── whatsapp.js         # Lifecycle do cliente whatsapp-web.js
│   ├── modules/
│   │   ├── contacts.js         # CRUD de contatos (CSV)
│   │   ├── messages.js         # CRUD de templates + interpolate()
│   │   ├── bulk-sender.js      # Lógica de envio em massa e delay
│   │   └── groups.js           # Operações com grupos do WhatsApp
│   ├── cli/
│   │   ├── menu.js             # Menu principal + wizards de envio
│   │   ├── contacts-menu.js    # Sub-menu de contatos
│   │   ├── messages-menu.js    # Sub-menu de templates
│   │   ├── groups-menu.js      # Sub-menu de grupos
│   │   └── media-menu.js       # Sub-menu de mídias
│   └── utils/
│       ├── logger.js           # Log colorido no terminal
│       └── formatter.js        # Validação e formatação de telefone BR
├── __tests__/                  # Testes unitários (Jest)
│   ├── utils/
│   │   └── formatter.test.js
│   └── modules/
│       ├── contacts.test.js
│       ├── messages-pure.test.js
│       ├── messages-io.test.js
│       ├── bulk-sender-pure.test.js
│       ├── bulk-sender-send.test.js
│       └── groups.test.js
├── data/                       # Gerado automaticamente — gitignored
│   ├── contacts.csv
│   └── messages.json
└── media/                      # Coloque imagens, vídeos e áudios aqui — gitignored
```

---

## Fluxo de uso

### Envio para contatos

1. Selecione ou crie um template de mensagem
2. Filtre por tag/grupo (opcional — vazio envia a todos os contatos ativos)
3. Confirme a quantidade de destinatários
4. O bot envia com delay automático e exibe um relatório ao final

### Envio para grupos

1. Selecione um template
2. Escolha um ou mais grupos do WhatsApp (múltipla escolha)
3. Confirme e o bot envia para cada grupo selecionado

> Nos templates enviados para grupos, `{name}` é substituído por **"Grupo"** no início de parágrafo e **"grupo"** no restante do texto.

### Gerenciar contatos

| Ação | Descrição |
|---|---|
| Listar contatos | Exibe tabela com nome, telefone, tag e status |
| Adicionar contato | Nome, telefone e tag (opcional); telefone é normalizado automaticamente |
| Desativar contato | Remove da lista de envio sem apagar o registro |

### Gerenciar templates

| Ação | Descrição |
|---|---|
| Listar templates | Exibe nome, prévia do texto, mídia e variáveis detectadas |
| Criar template | Wizard: texto (editor), tipo de mídia, legenda/voz, variáveis extraídas automaticamente |
| Excluir template | Remove o template (a mídia em disco não é apagada) |

### Gerenciar grupos

| Ação | Descrição |
|---|---|
| Listar grupos | Exibe todos os grupos que o número participa |
| Ver participantes | Lista participantes com indicação de admins |
| Criar novo grupo | Adiciona participantes da sua lista CSV, de outro grupo ou manualmente |

### Gerenciar mídias

| Ação | Descrição |
|---|---|
| Listar mídias | Exibe arquivos em `media/` com tamanho e status de uso por templates |
| Adicionar mídia | Abre seletor de arquivo nativo do Windows (PowerShell) e copia para `media/` |
| Remover mídia | Remove arquivos que não estejam em uso por nenhum template |

---

## Variáveis dinâmicas

Use estas variáveis no texto ou na legenda da mídia dos templates:

| Variável | Contatos | Grupos |
|---|---|---|
| `{name}` | Nome do contato | `"Grupo"` (início de parágrafo) / `"grupo"` (demais posições) |
| `{phone}` | Telefone do contato | vazio |
| `{group}` | Tag do contato | vazio |

**Exemplo de template:**

```
{name}, tudo bem?

Gostaríamos de informar {name} sobre nossa promoção.
Entre em contato pelo {phone}.
```

Enviado para João (5511999...) → `"João, tudo bem?\n\nGostaríamos de informar João sobre..."`

Enviado para um grupo → `"Grupo, tudo bem?\n\nGostaríamos de informar grupo sobre..."`

---

## Formatos de mídia suportados

| Tipo | Extensões |
|---|---|
| Imagem | `.jpg` `.jpeg` `.png` `.gif` `.webp` |
| Vídeo | `.mp4` `.3gp` |
| Áudio | `.mp3` `.m4a` `.aac` `.wav` `.ogg` |

Coloque os arquivos na pasta `media/` antes de criar um template. O gerenciador de mídias cuida disso automaticamente.

---

## Delay anti-ban

O bot calcula automaticamente o intervalo entre envios com base no número de destinatários:

| Volume | Delay por envio | Risco estimado |
|---|---|---|
| Menos de 30 | 1,5 – 3 s | Baixo |
| 30 a 100 | 3 – 8 s | Baixo |
| 101 a 300 | 5 – 15 s | Médio |
| Mais de 300 | 10 – 20 s | Alto |

> O maior fator de risco não é só a velocidade — é a combinação de volume + frequência + histórico do número. Números novos têm risco maior.
>
> **Nunca use o bot para spam.** Destinatários que não conhecem o remetente podem marcar como spam e aumentar a chance de banimento.

---

## Testes unitários

O projeto usa **Jest 29** com cobertura de ~98% dos módulos de lógica de negócio.

```bash
npm test                  # todos os testes
npm run test:coverage     # relatório de cobertura
npm run test:watch        # modo watch (desenvolvimento)
```

### Estratégia de mocks

- **Funções puras** (`interpolate`, `formatBrazilianPhone`, `getDelayRange`, `toChatId`): sem mocks
- **I/O de arquivo** (`contacts.js`, `messages.js`): `jest.spyOn` em `fs` e `fs.promises`; stream CSV mockado com `Readable.from()` + `csv-parser` real
- **WhatsApp Client** (`bulk-sender.js`, `groups.js`): `jest.mock` em `whatsapp-web.js` e `src/client/whatsapp`
- **Timers** (`sendBulkMessages`, `sendBulkToGroups`): `jest.useFakeTimers()` + `jest.runAllTimersAsync()` para evitar esperas reais entre envios

---

## Referência de funções

### `src/modules/contacts.js`

| Função | Descrição |
|---|---|
| `loadContacts()` | Lê e retorna todos os contatos do CSV. `active` é convertido para `boolean`. Retorna `[]` se o arquivo não existir. |
| `saveContacts(contacts)` | Persiste o array de contatos no CSV (sobrescreve). |
| `addContact({ name, phone, group })` | Valida e formata o telefone, verifica duplicatas, salva e retorna o novo contato. |
| `getActiveContacts(group?)` | Retorna contatos ativos. Se `group` for informado, filtra pela tag. |
| `deactivateContact(phone)` | Marca o contato como inativo (`active: false`) sem removê-lo. |

---

### `src/modules/messages.js`

| Função | Descrição |
|---|---|
| `loadTemplates()` | Lê e retorna o array de templates do JSON. Retorna `[]` se o arquivo não existir. |
| `saveTemplates(templates)` | Persiste o array de templates no JSON (sobrescreve). |
| `addTemplate(name, content, mediaPath, mediaType, caption, asVoice)` | Valida, extrai variáveis automaticamente, cria e persiste o template. |
| `getTemplateById(id)` | Retorna o template pelo UUID ou `null` se não encontrado. |
| `deleteTemplate(id)` | Remove o template pelo UUID. Lança erro se não encontrado. |
| `interpolate(text, contact)` | Substitui `{name}`, `{phone}` e `{group}` pelo valor do contato. Função pura — sem I/O. Trata contexto de grupo (`contact.name === null`). |

---

### `src/modules/bulk-sender.js`

| Função | Descrição |
|---|---|
| `sendBulkMessages(templateId, options?)` | Envia um template para todos os contatos ativos (filtro por grupo opcional). Retorna array de resultados `{ phone, name, status, sentAt?, error? }`. |
| `sendBulkToGroups(templateId, groups)` | Envia um template para os grupos fornecidos. Retorna resultados `{ id, name, status, sentAt?, error? }`. |
| `sendSingleMessage(phone, message)` | Envia uma mensagem de texto simples para um número. Retorna `{ phone, status, sentAt? }`. |
| `sendTemplateMessage(client, chatId, template, contact)` | Envia um template resolvido (com mídia se houver) para um `chatId`. Usada internamente pelos métodos bulk. |
| `getDelayRange(contactCount)` | Retorna `{ min, max }` de delay em ms com base no volume de envio. Função pura. |
| `toChatId(phone)` | Converte um telefone para o formato de chat ID do WhatsApp (`phone@c.us`). Função pura. |
| `randomDelay(min, max)` | Retorna uma Promise que resolve após um intervalo aleatório entre `min` e `max` ms. |

---

### `src/modules/groups.js`

| Função | Descrição |
|---|---|
| `fetchGroups()` | Retorna todos os grupos que o número participa, ordenados por nome. Cada item: `{ id, name, participantCount, description }`. |
| `fetchGroupParticipants(groupId)` | Retorna os participantes de um grupo. Cada item: `{ phone, name, isAdmin }`. |
| `createGroup(name, phones)` | Cria um novo grupo no WhatsApp. Retorna `{ groupId, inviteCode, failedParticipants }`. |

---

### `src/utils/formatter.js`

| Função | Descrição |
|---|---|
| `formatBrazilianPhone(raw)` | Normaliza qualquer formato de telefone brasileiro para `55DDXXXXXXXXX`. Aceita 10–13 dígitos (com ou sem DDI/formatação). Lança erro em formatos inválidos. |
| `validatePhone(phone)` | Retorna `true` se o telefone já está no formato normalizado válido (`55` + 12 ou 13 dígitos). Função pura. |

---

## Estrutura de dados

### Contato (`data/contacts.csv`)

```csv
name,phone,group,active,added_at
João Silva,5511991234567,turma-2024,true,2026-01-01T00:00:00.000Z
```

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | string | Nome do contato |
| `phone` | string | DDI + DDD + número, sem símbolos (ex: `5511991234567`) |
| `group` | string | Tag opcional para segmentação |
| `active` | boolean | `true` para incluir nos envios |
| `added_at` | ISO 8601 | Data de cadastro |

### Template (`data/messages.json`)

```json
{
  "templates": [
    {
      "id": "uuid-v4",
      "name": "Promoção Verão",
      "content": "Olá, {name}! Temos uma novidade para você.",
      "variables": ["name"],
      "media": {
        "type": "image",
        "path": "media/promo.jpg",
        "caption": "Confira, {name}!"
      },
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

O campo `media` é omitido em templates somente-texto. Para áudio, `caption` é substituído por `asVoice: true/false`.

---

## Contribuindo

Contribuições são bem-vindas via pull requests.

### Configuração local

```bash
git clone <url-do-fork>
cd ufma_bot
npm install
npm test        # garanta que todos os testes passam antes de começar
```

### Diretrizes

- Escreva ou atualize testes para qualquer função modificada em `src/modules/` ou `src/utils/`
- Execute `npm run test:coverage` e verifique que a cobertura não regrediu
- Mantenha a compatibilidade com Node.js 18+
- Não faça commit de arquivos em `data/`, `media/` ou `.wwebjs_auth/`
- Mensagens de commit em português ou inglês — seja descritivo

### Estrutura para novas features

- Lógica de negócio → `src/modules/`
- Interação com o usuário → `src/cli/`
- Utilitários puros → `src/utils/`
- Testes unitários → `__tests__/modules/` ou `__tests__/utils/`

---

## Segurança e avisos

- A pasta `.wwebjs_auth/` contém sua sessão autenticada do WhatsApp — **nunca faça commit nem compartilhe**
- As pastas `data/` e `media/` são ignoradas pelo git por conterem dados pessoais
- O bot age em nome do seu número — o WhatsApp pode banir contas que fazem envios em massa agressivos
- Respeite as políticas de uso do WhatsApp e obtenha consentimento dos destinatários antes de enviar
