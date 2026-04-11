const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const { formatBrazilianPhone } = require('../utils/formatter');

const DATA_PATH = path.join(process.cwd(), 'data', 'contacts.csv');
const HEADERS = [
  { id: 'name', title: 'name' },
  { id: 'phone', title: 'phone' },
  { id: 'group', title: 'group' },
  { id: 'active', title: 'active' },
  { id: 'added_at', title: 'added_at' },
];

function ensureDataDir() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadContacts() {
  return new Promise((resolve) => {
    if (!fs.existsSync(DATA_PATH)) {
      return resolve([]);
    }

    const results = [];
    fs.createReadStream(DATA_PATH)
      .pipe(csv())
      .on('data', (row) => {
        results.push({
          ...row,
          active: row.active === 'true',
        });
      })
      .on('end', () => resolve(results))
      .on('error', () => resolve([]));
  });
}

async function saveContacts(contacts) {
  ensureDataDir();
  const writer = createObjectCsvWriter({
    path: DATA_PATH,
    header: HEADERS,
  });
  await writer.writeRecords(contacts);
}

async function addContact({ name, phone, group = '' }) {
  const formattedPhone = formatBrazilianPhone(phone);

  const contacts = await loadContacts();

  const duplicate = contacts.find((c) => c.phone === formattedPhone);
  if (duplicate) {
    throw new Error(`Contato com o número ${formattedPhone} já existe (${duplicate.name}).`);
  }

  const newContact = {
    name: String(name).trim(),
    phone: formattedPhone,
    group: String(group).trim(),
    active: true,
    added_at: new Date().toISOString(),
  };

  contacts.push(newContact);
  await saveContacts(contacts);
  return newContact;
}

async function getActiveContacts(group) {
  const contacts = await loadContacts();
  return contacts.filter((c) => {
    if (!c.active) return false;
    if (group && group.trim() !== '') return c.group === group.trim();
    return true;
  });
}

async function deactivateContact(phone) {
  const contacts = await loadContacts();
  const contact = contacts.find((c) => c.phone === phone);
  if (!contact) {
    throw new Error(`Contato com número ${phone} não encontrado.`);
  }
  contact.active = false;
  await saveContacts(contacts);
}

module.exports = { loadContacts, saveContacts, addContact, getActiveContacts, deactivateContact };
