const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = __dirname;
const port = process.env.PORT || 3000;
const dataFile = path.join(rootDir, 'data', 'content.json');
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'kaptai';
const sessions = new Set();

const ensureDataFile = () => {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([], null, 2), 'utf8');
  }
};

ensureDataFile();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const getCookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((cookie) => {
  const separator = cookie.indexOf('=');
  return [cookie.slice(0, separator).trim(), decodeURIComponent(cookie.slice(separator + 1).trim())];
}));

const isAdmin = (req) => {
  const session = getCookies(req).kaptai_admin;
  return Boolean(session && sessions.has(session));
};

const createSession = () => {
  const session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessions.add(session);
  return session;
};

const parseJsonBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    if (!chunks.length) {
      resolve({});
      return;
    }

    try {
      const raw = Buffer.concat(chunks).toString('utf8');
      resolve(raw ? JSON.parse(raw) : {});
    } catch (error) {
      reject(new Error('Invalid JSON payload'));
    }
  });
  req.on('error', reject);
});

const readData = () => {
  const raw = fs.readFileSync(dataFile, 'utf8');
  return JSON.parse(raw || '[]');
};

const writeData = (entries) => {
  fs.writeFileSync(dataFile, JSON.stringify(entries, null, 2), 'utf8');
};

const runGitCommand = (args) => new Promise((resolve, reject) => {
  const child = spawn('git', ['-C', rootDir, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('close', (code) => {
    if (code === 0) {
      resolve(stdout.trim());
      return;
    }

    reject(new Error(stderr.trim() || `git ${args.join(' ')} failed with code ${code}`));
  });
});

const pushChanges = async () => {
  try {
    const status = await runGitCommand(['status', '--porcelain']);
    if (!status.trim()) {
      return { message: 'No content changes to push.' };
    }

    await runGitCommand(['add', '.']);
    await runGitCommand(['commit', '-m', 'Add web content from admin']);
    await runGitCommand(['push']);

    return { message: 'Content saved and pushed to GitHub.' };
  } catch (error) {
    return {
      message: `Saved locally, but GitHub push was not completed: ${error.message}`,
      warning: true
    };
  }
};

const serveFile = (res, filePath) => {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: 'File not found' });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const type = mimeTypes[extension] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  });
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/api/login') {
    try {
      const body = await parseJsonBody(req);
      if (body.username !== adminUsername || body.password !== adminPassword) {
        sendJson(res, 401, { success: false, error: 'Invalid admin username or password.' });
        return;
      }

      const session = createSession();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `kaptai_admin=${encodeURIComponent(session)}; HttpOnly; SameSite=Strict; Path=/`
      });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const session = getCookies(req).kaptai_admin;
    sessions.delete(session);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': 'kaptai_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/content') {
    if (!isAdmin(req)) {
      sendJson(res, 401, { success: false, error: 'Admin login required.' });
      return;
    }
    sendJson(res, 200, readData());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/content') {
    if (!isAdmin(req)) {
      sendJson(res, 401, { success: false, error: 'Admin login required.' });
      return;
    }
    try {
      const body = await parseJsonBody(req);
      const entries = readData();
      const record = {
        id: Date.now(),
        title: String(body.title || 'New item').trim(),
        category: String(body.category || 'General').trim(),
        description: String(body.description || '').trim(),
        image: String(body.image || '').trim(),
        price: String(body.price || '').trim(),
        status: String(body.status || 'Draft').trim(),
        createdAt: new Date().toISOString()
      };

      entries.push(record);
      writeData(entries);

      const gitResult = await pushChanges();
      sendJson(res, 200, {
        success: true,
        item: record,
        ...gitResult
      });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = path.normalize(requestPath).replace(/^\/+/, '');
  const filePath = path.join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(res, filePath);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  console.log(`Kaptai Farms content manager running at http://localhost:${port}`);
});
