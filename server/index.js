const path = require('path');
const fs = require('fs');

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'app-state.db');
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..');

async function ensureDatabase() {
  await fs.promises.mkdir(path.dirname(DB_PATH), { recursive: true });
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

async function createServer() {
  const db = await ensureDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  const loadState = async () => {
    const row = await db.get('SELECT data FROM app_state WHERE id = 1');
    if (!row) return null;
    try {
      return JSON.parse(row.data);
    } catch (error) {
      console.error('Failed to parse stored state', error);
      return null;
    }
  };

  const saveState = async (state) => {
    const payload = JSON.stringify(state ?? {});
    await db.run(
      `
        INSERT INTO app_state (id, data, updated_at)
        VALUES (1, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
      `,
      payload,
    );
  };

  const deleteState = async () => {
    await db.run('DELETE FROM app_state WHERE id = 1');
  };

  app.get('/healthz', (req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/state', async (req, res) => {
    try {
      const state = await loadState();
      res.json({ state });
    } catch (error) {
      console.error('Failed to load state', error);
      res.status(500).json({ message: 'Failed to load state' });
    }
  });

  app.put('/api/state', async (req, res) => {
    try {
      const { state } = req.body || {};
      if (typeof state !== 'object' || state === null) {
        return res.status(400).json({ message: 'state payload is required' });
      }
      await saveState(state);
      res.status(204).end();
    } catch (error) {
      console.error('Failed to save state', error);
      res.status(500).json({ message: 'Failed to save state' });
    }
  });

  app.delete('/api/state', async (req, res) => {
    try {
      await deleteState();
      res.status(204).end();
    } catch (error) {
      console.error('Failed to delete state', error);
      res.status(500).json({ message: 'Failed to delete state' });
    }
  });

  app.use(express.static(STATIC_DIR));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ message: 'Not Found' });
    }
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`DB file located at ${DB_PATH}`);
  });
}

createServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
