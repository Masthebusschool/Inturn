import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import http from 'node:http';
import dns from 'node:dns';

// Boots a real HTTP server wrapping `router` behind express.json(), on an ephemeral port.
// Tests hit it with fetch(`${base}/...`). Mirrors how index.js wires a router, minus logging.
export async function startTestServer(mountPath, router) {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { base: `http://127.0.0.1:${port}${mountPath}`, close: () => new Promise((r) => server.close(r)) };
}

let connected = false;
export async function ensureDb() {
  if (connected) return;
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not set — copy server/.env.example to server/.env and fill it in before running tests.');
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    // Same Windows DNS quirk config/db.js works around: the default resolver
    // sometimes misreports as 127.0.0.1 (ECONNREFUSED on SRV lookups) even
    // though the OS resolves fine. Retry once via public resolvers.
    if (err?.code !== 'ECONNREFUSED' || !/^query/i.test(err?.syscall || String(err?.message || ''))) throw err;
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  }
  connected = true;
}
