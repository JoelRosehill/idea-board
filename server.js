const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tasks.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Ensure data dir + files exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks: [], lastUpdated: Date.now() }));
}
if (!fs.existsSync(USERS_FILE)) {
  // Default two users — change passwords in users.json after first run
  const defaultUsers = [
    { id: 'user1', name: 'JK', fullName: 'You', color: '#7c6aff', password: 'autoflow1' },
    { id: 'user2', name: 'MV', fullName: 'Colleague', color: '#3ecf6e', password: 'autoflow2' }
  ];
  fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
}

// Helpers
function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch(e) { return { tasks: [], lastUpdated: Date.now() }; }
}
function writeData(data) {
  data.lastUpdated = Date.now();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch(e) { return []; }
}

// Sessions (in-memory, simple)
const sessions = new Map();
function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { userId, created: Date.now() });
  return token;
}
function getSession(token) {
  return sessions.get(token) || null;
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.headers['x-session'] || req.query.token;
  if (!token || !getSession(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const session = getSession(token);
  const users = readUsers();
  req.user = users.find(u => u.id === session.userId);
  next();
}

// AUTH ROUTES
app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.name === name && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = createSession(user.id);
  const { password: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers['x-session'];
  sessions.delete(token);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const { password: _, ...safeUser } = req.user;
  res.json(safeUser);
});

app.get('/api/users', requireAuth, (req, res) => {
  const users = readUsers().map(({ password: _, ...u }) => u);
  res.json(users);
});

// TASK ROUTES
app.get('/api/tasks', requireAuth, (req, res) => {
  const data = readData();
  res.json(data);
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const data = readData();
  const task = {
    id: crypto.randomBytes(8).toString('hex'),
    created: Date.now(),
    createdBy: req.user.id,
    ...req.body
  };
  data.tasks.unshift(task);
  writeData(data);
  broadcast({ type: 'TASK_ADDED', task, by: req.user.name });
  res.json(task);
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const data = readData();
  const idx = data.tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.tasks[idx] = { ...data.tasks[idx], ...req.body, id: req.params.id };
  writeData(data);
  broadcast({ type: 'TASK_UPDATED', task: data.tasks[idx], by: req.user.name });
  res.json(data.tasks[idx]);
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const data = readData();
  const idx = data.tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.tasks.splice(idx, 1);
  writeData(data);
  broadcast({ type: 'TASK_DELETED', id: req.params.id, by: req.user.name });
  res.json({ ok: true });
});

// Bulk export
app.get('/api/export', requireAuth, (req, res) => {
  const data = readData();
  res.setHeader('Content-Disposition', 'attachment; filename="autoflow-export.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

// WebSocket — broadcast changes to all connected clients
const clients = new Set();

wss.on('connection', (ws, req) => {
  // Validate via token in query
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  if (!token || !getSession(token)) {
    ws.close(1008, 'Unauthorized');
    return;
  }
  const session = getSession(token);
  const users = readUsers();
  const user = users.find(u => u.id === session.userId);
  ws.userId = session.userId;
  ws.userName = user ? user.name : 'unknown';

  clients.add(ws);
  console.log(`[WS] ${ws.userName} connected. Total: ${clients.size}`);

  // Send online users list to everyone
  broadcastPresence();

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }));
    } catch(e) {}
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] ${ws.userName} disconnected. Total: ${clients.size}`);
    broadcastPresence();
  });
});

function broadcast(msg, excludeWs = null) {
  const str = JSON.stringify(msg);
  clients.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(str);
    }
  });
}

function broadcastPresence() {
  const online = [...clients].map(ws => ws.userName);
  broadcast({ type: 'PRESENCE', online });
}

server.listen(PORT, () => {
  console.log(`\n🚀 AUTOFLOW running on http://localhost:${PORT}`);
  console.log(`   Data stored in: ${DATA_FILE}`);
  console.log(`   Edit data/users.json to change passwords\n`);
});
