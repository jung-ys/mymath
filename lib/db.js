'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function emptyDb() {
  return {
    admin: { passwordHash: null },
    students: [],
    dailyTests: [],
    levelExams: [],
    levelUps: [],
  };
}

function load() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const fresh = emptyDb();
      save(fresh);
      return fresh;
    }
    throw err;
  }
}

let db = load();

function save(next) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

function persist() {
  save(db);
}

function id() {
  return crypto.randomBytes(9).toString('hex');
}

module.exports = {
  get raw() {
    return db;
  },
  persist,
  id,
  reload() {
    db = load();
    return db;
  },
};
