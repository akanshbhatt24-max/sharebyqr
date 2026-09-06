import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

interface StoredEncryptedShare {
  id: string;
  ciphertext: string;
  encryptionMeta: {
    algorithm: string;
    hasPassphrase: boolean;
    iv: string;
    salt?: string;
    fingerprint: string;
  };
  createdAt: number;
  expiresAt?: number | null;
  burnAfterReading?: boolean;
  maxAccessCount?: number;
  accessCount: number;
}

const DATA_FILE = path.join(process.cwd(), 'shares.json');

// Load existing shares from disk on startup
function loadShares(): Map<string, StoredEncryptedShare> {
  const map = new Map<string, StoredEncryptedShare>();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const now = Date.now();
        for (const item of arr) {
          if (!item.expiresAt || now <= item.expiresAt) {
            map.set(item.id, item);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load shares from disk:', e);
  }
  return map;
}

// In-memory store backed by disk persistence
const sharesStore = loadShares();

function saveSharesToDisk() {
  try {
    const arr = Array.from(sharesStore.values());
    fs.writeFileSync(DATA_FILE, JSON.stringify(arr), 'utf-8');
  } catch (e) {
    console.warn('Failed to save shares to disk:', e);
  }
}

// Helper to generate short unique ID
function generateShareId(): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHGHJKLMNPQRSTUVWXYZ';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Periodic cleanup of expired shares (runs every 60s)
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [id, share] of sharesStore.entries()) {
    if (share.expiresAt && now > share.expiresAt) {
      sharesStore.delete(id);
      changed = true;
    }
  }
  if (changed) {
    saveSharesToDisk();
  }
}, 60000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS support for all incoming requests / preview iframes
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (_req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Body parsers with generous limits
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Middleware to catch body parser JSON syntax or size errors
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error('Payload Parser Error:', err.message);
      return res.status(err.status || 400).json({
        error: err.type === 'entity.too.large' 
          ? 'File or payload is too large. Please select a file under 15MB.' 
          : err.message || 'Invalid payload data format.'
      });
    }
    next();
  });

  // Serve static files from public directory (e.g. Google Search Console HTML verification files)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // API Health Check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      activeShares: sharesStore.size,
      timestamp: Date.now(),
    });
  });

  // Create Encrypted Share Endpoint
  app.post('/api/shares', (req, res) => {
    try {
      const { ciphertext, encryptionMeta, expiresAt, burnAfterReading, maxAccessCount } = req.body || {};

      if (!ciphertext || !encryptionMeta || !encryptionMeta.iv) {
        console.warn('POST /api/shares missing required parameters');
        return res.status(400).json({ error: 'Invalid encrypted payload parameters. Ciphertext and IV are required.' });
      }

      const id = generateShareId();
      const newShare: StoredEncryptedShare = {
        id,
        ciphertext,
        encryptionMeta,
        createdAt: Date.now(),
        expiresAt: expiresAt ? Number(expiresAt) : null,
        burnAfterReading: Boolean(burnAfterReading),
        maxAccessCount: maxAccessCount ? Number(maxAccessCount) : undefined,
        accessCount: 0,
      };

      sharesStore.set(id, newShare);
      saveSharesToDisk();

      return res.status(201).json({
        success: true,
        id,
        createdAt: newShare.createdAt,
        expiresAt: newShare.expiresAt,
        burnAfterReading: newShare.burnAfterReading,
      });
    } catch (err: any) {
      console.error('Error creating share in server vault:', err);
      return res.status(500).json({ error: err.message || 'Server error while saving encrypted share' });
    }
  });

  // Get Encrypted Share Endpoint
  app.get('/api/shares/:id', (req, res) => {
    const { id } = req.params;
    const share = sharesStore.get(id);

    if (!share) {
      return res.status(404).json({ error: 'Share payload not found or expired' });
    }

    const now = Date.now();
    if (share.expiresAt && now > share.expiresAt) {
      sharesStore.delete(id);
      return res.status(410).json({ error: 'Share payload has expired and was deleted' });
    }

    if (share.maxAccessCount && share.accessCount >= share.maxAccessCount) {
      sharesStore.delete(id);
      return res.status(410).json({ error: 'Maximum download limit reached for this item' });
    }

    share.accessCount += 1;

    // Send payload
    res.json({
      id: share.id,
      ciphertext: share.ciphertext,
      encryptionMeta: share.encryptionMeta,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      burnAfterReading: share.burnAfterReading,
      accessCount: share.accessCount,
    });

    // If "burn after reading" is enabled, purge immediately after sending
    if (share.burnAfterReading) {
      sharesStore.delete(id);
    }
  });

  // Delete Share Endpoint
  app.delete('/api/shares/:id', (req, res) => {
    const { id } = req.params;
    if (sharesStore.has(id)) {
      sharesStore.delete(id);
      return res.json({ success: true, message: 'Share deleted successfully' });
    }
    res.status(404).json({ error: 'Share not found' });
  });

  // Serve Vite in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
