const { createClient } = require('@libsql/client');
const crypto = require('crypto');

// 환경변수로 Turso 연결. 없으면 로컬 sqlite 파일 fallback
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:forest.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 초기 스키마
async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      delete_token TEXT NOT NULL,
      reactions TEXT DEFAULT '{}',
      replies TEXT DEFAULT '[]'
    )
  `);
}

initDB().catch((e) => console.error('DB init error:', e));

function parsePost(row) {
  return {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    reactions: JSON.parse(row.reactions || '{}'),
    replies: JSON.parse(row.replies || '[]'),
  };
}

async function createPost(content) {
  const now = new Date();
  now.setSeconds(0, 0);
  const created_at = now.toISOString().slice(0, 16) + ':00.000Z';
  const delete_token = crypto.randomUUID();

  const result = await db.execute({
    sql: 'INSERT INTO posts (content, created_at, delete_token, reactions, replies) VALUES (?, ?, ?, ?, ?)',
    args: [content, created_at, delete_token, '{}', '[]'],
  });

  return { id: Number(result.lastInsertRowid), delete_token };
}

async function deletePost(id, token) {
  const result = await db.execute({
    sql: 'SELECT delete_token, created_at FROM posts WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return { error: '글을 찾을 수 없어요.', status: 404 };

  const row = result.rows[0];
  if (row.delete_token !== token) return { error: '삭제 권한이 없어요.', status: 403 };

  const created = new Date(row.created_at);
  if (Date.now() - created.getTime() > 5 * 60 * 1000) {
    return { error: '5분이 지나 삭제할 수 없어요.', status: 403 };
  }

  await db.execute({ sql: 'DELETE FROM posts WHERE id = ?', args: [id] });
  return { ok: true };
}

async function addReaction(id, emoji) {
  const result = await db.execute({
    sql: 'SELECT reactions FROM posts WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return { error: '글을 찾을 수 없어요.', status: 404 };

  const reactions = JSON.parse(result.rows[0].reactions || '{}');
  reactions[emoji] = (reactions[emoji] || 0) + 1;

  await db.execute({
    sql: 'UPDATE posts SET reactions = ? WHERE id = ?',
    args: [JSON.stringify(reactions), id],
  });

  return { ok: true, reactions };
}

async function removeReaction(id, emoji) {
  const result = await db.execute({
    sql: 'SELECT reactions FROM posts WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return { error: '글을 찾을 수 없어요.', status: 404 };

  const reactions = JSON.parse(result.rows[0].reactions || '{}');
  if (reactions[emoji] && reactions[emoji] > 0) {
    reactions[emoji]--;
    if (reactions[emoji] === 0) delete reactions[emoji];
  }

  await db.execute({
    sql: 'UPDATE posts SET reactions = ? WHERE id = ?',
    args: [JSON.stringify(reactions), id],
  });

  return { ok: true, reactions };
}

async function addReply(id, content) {
  const result = await db.execute({
    sql: 'SELECT replies FROM posts WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return { error: '글을 찾을 수 없어요.', status: 404 };

  const replies = JSON.parse(result.rows[0].replies || '[]');
  const now = new Date();
  now.setSeconds(0, 0);
  replies.push({
    content,
    created_at: now.toISOString().slice(0, 16) + ':00.000Z',
  });

  await db.execute({
    sql: 'UPDATE posts SET replies = ? WHERE id = ?',
    args: [JSON.stringify(replies), id],
  });

  return { ok: true, replies };
}

async function getPost(id) {
  const result = await db.execute({
    sql: 'SELECT id, content, created_at, reactions, replies FROM posts WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return parsePost(result.rows[0]);
}

async function getPosts(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const result = await db.execute({
    sql: 'SELECT id, content, created_at, reactions, replies FROM posts ORDER BY id DESC LIMIT ? OFFSET ?',
    args: [limit, offset],
  });
  const countResult = await db.execute('SELECT COUNT(*) as total FROM posts');
  const total = Number(countResult.rows[0].total);
  return {
    posts: result.rows.map(parsePost),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

async function getPostsByDate(dateStr) {
  const result = await db.execute({
    sql: "SELECT id, content, created_at, reactions, replies FROM posts WHERE created_at LIKE ? ORDER BY id DESC",
    args: [`${dateStr}%`],
  });
  return result.rows.map(parsePost);
}

async function getAvailableDates() {
  const result = await db.execute(
    "SELECT DISTINCT substr(created_at, 1, 10) as date FROM posts ORDER BY date DESC"
  );
  return result.rows.map((r) => r.date);
}

async function getTodayPosts() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return getPostsByDate(today);
}

module.exports = {
  createPost, deletePost, addReaction, removeReaction, addReply,
  getPost, getPosts, getPostsByDate, getAvailableDates, getTodayPosts,
};
