const crypto = require('crypto');

const owner = process.env.GITHUB_OWNER || 'warriormind24';
const repo = process.env.GITHUB_REPO || 'kaptai-farms';
const branch = process.env.GITHUB_BRANCH || 'main';
const githubToken = process.env.GITHUB_TOKEN;
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;

const json = (res, status, payload, headers = {}) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
};

const parseBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON payload')); }
  });
  req.on('error', reject);
});

const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((item) => {
  const index = item.indexOf('=');
  return [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1).trim())];
}));

const sign = (value) => crypto.createHmac('sha256', sessionSecret || '').update(value).digest('hex');
const validSession = (req) => {
  const token = cookies(req).kaptai_admin || '';
  const [timestamp, signature] = token.split('.');
  return Boolean(sessionSecret && timestamp && signature && Date.now() - Number(timestamp) < 86400000 && sign(timestamp) === signature);
};

const github = async (path, options = {}) => {
  if (!githubToken) throw new Error('GITHUB_TOKEN is not configured in Vercel.');
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
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

const readRepoJson = async (file) => {
  try {
    const fileData = await github(`/contents/${file}?ref=${branch}`);
    return { data: JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8')), sha: fileData.sha };
  } catch (error) {
    if (error.message.includes('Not Found')) return { data: [], sha: undefined };
    throw error;
  }
};

const writeRepoJson = async (file, data, sha, message) => {
  const body = { message, content: Buffer.from(JSON.stringify(data, null, 2) + '\n').toString('base64'), branch };
  if (sha) body.sha = sha;
  return github(`/contents/${file}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
};

const recordFrom = (body) => ({
  id: Date.now(),
  title: String(body.title || '').trim(),
  category: String(body.category || '').trim(),
  description: String(body.description || '').trim(),
  image: String(body.image || '').trim(),
  price: String(body.price || '').trim(),
  status: 'Pending review',
  createdAt: new Date().toISOString()
});

module.exports = async (req, res) => {
  const path = `/${(req.query.path || []).join('/')}`;
  try {
    if (req.method === 'POST' && path === '/login') {
      const body = await parseBody(req);
      if (!adminUsername || !adminPassword || !sessionSecret) return json(res, 503, { success: false, error: 'Vercel admin secrets are not configured.' });
      if (body.username !== adminUsername || body.password !== adminPassword) return json(res, 401, { success: false, error: 'Invalid admin username or password.' });
      const timestamp = String(Date.now());
      return json(res, 200, { success: true }, { 'Set-Cookie': `kaptai_admin=${timestamp}.${sign(timestamp)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400` });
    }

    if (req.method === 'POST' && path === '/logout') {
      return json(res, 200, { success: true }, { 'Set-Cookie': 'kaptai_admin=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' });
    }

    if (req.method === 'POST' && path === '/submissions') {
      const body = await parseBody(req);
      const record = recordFrom(body);
      if (!record.title || !record.category) return json(res, 400, { success: false, error: 'Title and category are required.' });
      const file = await readRepoJson('data/submissions.json');
      file.data.push(record);
      await writeRepoJson('data/submissions.json', file.data, file.sha, 'Add pending content submission');
      return json(res, 201, { success: true, message: 'Thanks. Your submission is waiting for admin review.' });
    }

    if (!validSession(req)) return json(res, 401, { success: false, error: 'Admin login required.' });

    if (req.method === 'GET' && path === '/submissions') {
      return json(res, 200, (await readRepoJson('data/submissions.json')).data);
    }

    const approval = path.match(/^\/submissions\/(\d+)\/approve$/);
    if (req.method === 'POST' && approval) {
      const submissions = await readRepoJson('data/submissions.json');
      const index = submissions.data.findIndex((item) => item.id === Number(approval[1]));
      if (index < 0) return json(res, 404, { success: false, error: 'Submission not found.' });
      const [item] = submissions.data.splice(index, 1);
      item.status = 'Live';
      item.approvedAt = new Date().toISOString();
      const content = await readRepoJson('data/content.json');
      content.data.push(item);
      await writeRepoJson('data/content.json', content.data, content.sha, 'Publish approved web content');
      await writeRepoJson('data/submissions.json', submissions.data, submissions.sha, 'Remove approved content submission');
      return json(res, 200, { success: true, message: 'Content approved and pushed to GitHub.' });
    }

    return json(res, 404, { success: false, error: 'Not found.' });
  } catch (error) {
    return json(res, 500, { success: false, error: error.message });
  }
};
