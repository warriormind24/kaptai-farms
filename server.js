const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = __dirname;
const port = process.env.PORT || 3000;
const dataFile = path.join(rootDir, 'data', 'content.json');
const submissionsFile = path.join(rootDir, 'data', 'submissions.json');
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const githubOwner = process.env.GITHUB_OWNER || 'warriormind24';
const githubRepo = process.env.GITHUB_REPO || 'kaptai-farms';
const githubBranch = process.env.GITHUB_BRANCH || 'main';
const githubToken = process.env.GITHUB_TOKEN;
const sessionSecret = process.env.SESSION_SECRET;

const ensureDataFile = () => {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(submissionsFile)) {
    fs.writeFileSync(submissionsFile, JSON.stringify([], null, 2), 'utf8');
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
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': 'null',
    'Access-Control-Allow-Credentials': 'true'
  });
  res.end(JSON.stringify(payload));
};

const getCookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((cookie) => {
  const separator = cookie.indexOf('=');
  return [cookie.slice(0, separator).trim(), decodeURIComponent(cookie.slice(separator + 1).trim())];
}));

const isAdmin = (req) => {
  const [timestamp, signature] = (getCookies(req).kaptai_admin || '').split('.');
  if (!sessionSecret || !timestamp || !signature || Date.now() - Number(timestamp) > 86400000) return false;
  const expected = crypto.createHmac('sha256', sessionSecret).update(timestamp).digest('hex');
  return signature === expected;
};

const createSession = () => {
  const timestamp = String(Date.now());
  const signature = crypto.createHmac('sha256', sessionSecret || '').update(timestamp).digest('hex');
  return `${timestamp}.${signature}`;
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

const githubRequest = async (filePath, options = {}) => {
  if (!githubToken) throw new Error('GITHUB_TOKEN is not configured on Render.');
  const response = await fetch(`https://api.github.com/repos/${githubOwner}/${githubRepo}${filePath}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || `GitHub API error ${response.status}`);
  return body;
};

const readRepoJson = async (filePath) => {
  try {
    const file = await githubRequest(`/contents/${filePath}?ref=${githubBranch}`);
    return { data: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')), sha: file.sha };
  } catch (error) {
    if (error.message.includes('Not Found')) return { data: [], sha: undefined };
    throw error;
  }
};

const writeRepoJson = async (filePath, data, sha, message) => {
  const body = {
    message,
    content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`).toString('base64'),
    branch: githubBranch
  };
  if (sha) body.sha = sha;
  await githubRequest(`/contents/${filePath}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
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

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': 'null',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    try {
      const body = await parseJsonBody(req);
      if (!adminUsername || !adminPassword) {
        sendJson(res, 503, { success: false, error: 'Admin credentials are not configured on the server.' });
        return;
      }
      if (body.username !== adminUsername || body.password !== adminPassword) {
        sendJson(res, 401, { success: false, error: 'Invalid admin username or password.' });
        return;
      }

      const session = createSession();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': 'null',
        'Access-Control-Allow-Credentials': 'true',
        'Set-Cookie': `kaptai_admin=${encodeURIComponent(session)}; HttpOnly; SameSite=Strict; Path=/`
      });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'null',
      'Access-Control-Allow-Credentials': 'true',
      'Set-Cookie': 'kaptai_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/submissions') {
    try {
      const body = await parseJsonBody(req);
      if (!String(body.title || '').trim() || !String(body.category || '').trim()) {
        sendJson(res, 400, { success: false, error: 'Title and category are required.' });
        return;
      }

      const submissionsFileData = await readRepoJson('data/submissions.json');
      const submissions = submissionsFileData.data;
      const record = {
        id: Date.now(),
        title: String(body.title).trim(),
        category: String(body.category).trim(),
        description: String(body.description || '').trim(),
        image: String(body.image || '').trim(),
        price: String(body.price || '').trim(),
        status: 'Pending review',
        createdAt: new Date().toISOString()
      };
      submissions.push(record);
      await writeRepoJson('data/submissions.json', submissions, submissionsFileData.sha, 'Add pending content submission');
      sendJson(res, 201, { success: true, message: 'Thanks. Your submission is waiting for admin review.' });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/submissions') {
    if (!isAdmin(req)) {
      sendJson(res, 401, { success: false, error: 'Admin login required.' });
      return;
    }
    sendJson(res, 200, (await readRepoJson('data/submissions.json')).data);
    return;
  }

  const approvalMatch = url.pathname.match(/^\/api\/submissions\/(\d+)\/approve$/);
  if (req.method === 'POST' && approvalMatch) {
    if (!isAdmin(req)) {
      sendJson(res, 401, { success: false, error: 'Admin login required.' });
      return;
    }
    try {
      const submissionId = Number(approvalMatch[1]);
      const submissionsFileData = await readRepoJson('data/submissions.json');
      const submissions = submissionsFileData.data;
      const submissionIndex = submissions.findIndex((item) => item.id === submissionId);
      if (submissionIndex === -1) {
        sendJson(res, 404, { success: false, error: 'Submission not found.' });
        return;
      }

      const [submission] = submissions.splice(submissionIndex, 1);
      submission.status = 'Live';
      submission.approvedAt = new Date().toISOString();
      const contentFileData = await readRepoJson('data/content.json');
      const entries = contentFileData.data;
      entries.push(submission);
      await writeRepoJson('data/content.json', entries, contentFileData.sha, 'Publish approved web content');
      await writeRepoJson('data/submissions.json', submissions, submissionsFileData.sha, 'Remove approved content submission');
      sendJson(res, 200, { success: true, message: 'Content approved and pushed to GitHub.' });
    } catch (error) {
      sendJson(res, 400, { success: false, error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/content') {
    if (!isAdmin(req)) {
      sendJson(res, 401, { success: false, error: 'Admin login required.' });
      return;
    }
    sendJson(res, 200, (await readRepoJson('data/content.json')).data);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/content') {
    if (!isAdmin(req)) {
      sendJson(res, 401, { success: false, error: 'Admin login required.' });
      return;
    }
    try {
      const body = await parseJsonBody(req);
      const contentFileData = await readRepoJson('data/content.json');
      const entries = contentFileData.data;
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
      await writeRepoJson('data/content.json', entries, contentFileData.sha, 'Add web content from admin');
      sendJson(res, 200, {
        success: true,
        item: record,
        message: 'Content saved and pushed to GitHub.'
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
