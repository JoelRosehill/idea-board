# ◈ AUTOFLOW — AI Agency Task Board

A self-hosted kanban board for two people, built with Node.js + WebSockets.
Real-time sync, login system, persistent JSON storage.

---

## Quick Start

### 1. Install Node.js
Download from https://nodejs.org (v18 or higher recommended)

### 2. Install dependencies
```bash
cd autoflow
npm install
```

### 3. Start the server
```bash
npm start
```

Open http://localhost:3000 in your browser.

---

## Default Login Credentials

| User | Password     |
|------|-------------|
| JK   | autoflow1   |
| MV   | autoflow2   |

**Change passwords** by editing `data/users.json` after first run:
```json
[
  { "id": "user1", "name": "JK", "fullName": "Your Name", "color": "#7c6aff", "password": "yournewpassword" },
  { "id": "user2", "name": "MV", "fullName": "Colleague Name", "color": "#3ecf6e", "password": "theirpassword" }
]
```
Restart the server after editing.

---

## Port Forwarding (Access from the internet)

1. Start the server: `npm start` (runs on port 3000)
2. In your router settings, forward **external port 3000** → **your PC's local IP:3000**
3. Find your public IP at https://whatismyip.com
4. Share the link: `http://YOUR_PUBLIC_IP:3000`

**Change the port** (optional):
```bash
PORT=8080 npm start
```

---

## Running as a Background Service (so it stays on when you close the terminal)

### Windows — use pm2:
```bash
npm install -g pm2
pm2 start server.js --name autoflow
pm2 save
pm2 startup
```

### Linux/Mac — pm2 or screen:
```bash
# pm2 (recommended)
npm install -g pm2
pm2 start server.js --name autoflow
pm2 startup && pm2 save

# or just screen
screen -S autoflow
npm start
# Ctrl+A then D to detach
```

---

## Data Storage

All tasks are saved in `data/tasks.json` — back this file up to keep your data safe.
Users are in `data/users.json`.

---

## Features

- **Kanban board** — To Do / In Progress / Review columns
- **Drag & drop** tasks between columns
- **Real-time sync** — changes from one user appear instantly on the other's screen
- **Login** — two-user password auth with session tokens
- **Intake checklists** — service-specific onboarding checklists built into each task
- **Filters** — by service type, priority, assignee, status
- **Pipeline value** — tracks estimated revenue per task
- **Keyboard shortcuts** — Ctrl+K new task, Ctrl+F search, Esc close modal
- **Export** — download all tasks as JSON

---

## Project Structure

```
autoflow/
├── server.js          ← Express + WebSocket server
├── package.json
├── data/
│   ├── tasks.json     ← All task data (auto-created)
│   └── users.json     ← User credentials (auto-created)
└── public/
    └── index.html     ← Full frontend app
```
