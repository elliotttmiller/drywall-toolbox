/* eslint-env node */
/* global process */
import fs from 'fs';
import path from 'path';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'reviews_store.json');

function readStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to read store', e);
    return {};
  }
}

function writeStore(store) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write store', e);
  }
}

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
  socket.on('subscribe', (productId) => {
    socket.join(`product:${productId}`);
  });
});

app.get('/api/reviews/:productId', (req, res) => {
  const store = readStore();
  const productId = req.params.productId;
  res.json({ reviews: store[productId] || [] });
});

app.post('/api/reviews/:productId', (req, res) => {
  const productId = req.params.productId;
  const { author, rating, text } = req.body || {};
  if (!text || !productId) return res.status(400).json({ error: 'Missing productId or text' });

  const review = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    author: (author || 'Anonymous'),
    rating: Number(rating) || 5,
    text: String(text),
    createdAt: new Date().toISOString(),
  };

  const store = readStore();
  store[productId] = store[productId] || [];
  store[productId].unshift(review);
  writeStore(store);

  // broadcast to sockets in the room
  io.to(`product:${productId}`).emit('reviewAdded', { productId, review, reviews: store[productId] });

  res.json({ ok: true, review });
});

const PORT = process.env.PORT || 4001;
server.listen(PORT, () => console.log(`Reviews server running on http://localhost:${PORT}`));
