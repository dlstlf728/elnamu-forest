const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'posts.json');

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    return { nextId: 1, posts: [] };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function stripToken(post) {
  const { delete_token, ...rest } = post;
  return rest;
}

function createPost(content) {
  const db = readDB();
  const now = new Date();
  now.setSeconds(0, 0);
  const created_at = now.toISOString().slice(0, 16) + ':00.000Z';
  const delete_token = crypto.randomUUID();

  const post = {
    id: db.nextId,
    content,
    created_at,
    delete_token,
    reactions: {},
    replies: [],
  };

  db.posts.unshift(post);
  db.nextId++;
  writeDB(db);
  return { id: post.id, delete_token };
}

function deletePost(id, token) {
  const db = readDB();
  const idx = db.posts.findIndex((p) => p.id === id);
  if (idx === -1) return { error: '글을 찾을 수 없어요.', status: 404 };

  const post = db.posts[idx];
  if (post.delete_token !== token) return { error: '삭제 권한이 없어요.', status: 403 };

  const created = new Date(post.created_at);
  const now = new Date();
  if (now - created > 5 * 60 * 1000) return { error: '5분이 지나 삭제할 수 없어요.', status: 403 };

  db.posts.splice(idx, 1);
  writeDB(db);
  return { ok: true };
}

function addReaction(id, emoji) {
  const db = readDB();
  const post = db.posts.find((p) => p.id === id);
  if (!post) return { error: '글을 찾을 수 없어요.', status: 404 };

  if (!post.reactions) post.reactions = {};
  post.reactions[emoji] = (post.reactions[emoji] || 0) + 1;
  writeDB(db);
  return { ok: true, reactions: post.reactions };
}

function addReply(id, content) {
  const db = readDB();
  const post = db.posts.find((p) => p.id === id);
  if (!post) return { error: '글을 찾을 수 없어요.', status: 404 };

  if (!post.replies) post.replies = [];
  const now = new Date();
  now.setSeconds(0, 0);

  post.replies.push({
    content,
    created_at: now.toISOString().slice(0, 16) + ':00.000Z',
  });
  writeDB(db);
  return { ok: true, replies: post.replies };
}

function getPost(id) {
  const db = readDB();
  const post = db.posts.find((p) => p.id === id);
  if (!post) return null;
  return stripToken(post);
}

function getPosts(page = 1, limit = 20) {
  const db = readDB();
  const total = db.posts.length;
  const offset = (page - 1) * limit;
  const posts = db.posts.slice(offset, offset + limit).map(stripToken);
  return { posts, total, page, totalPages: Math.ceil(total / limit) || 1 };
}

function getPostsByDate(dateStr) {
  const db = readDB();
  // dateStr = "2026-04-09"
  const posts = db.posts
    .filter((p) => p.created_at.startsWith(dateStr))
    .map(stripToken);
  return posts;
}

function getAvailableDates() {
  const db = readDB();
  const dates = new Set();
  db.posts.forEach((p) => dates.add(p.created_at.slice(0, 10)));
  return [...dates].sort().reverse();
}

function getTodayPosts() {
  const db = readDB();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  return db.posts
    .filter((p) => p.created_at >= startOfDay)
    .map(stripToken);
}

module.exports = {
  createPost, deletePost, addReaction, addReply,
  getPost, getPosts, getPostsByDate, getAvailableDates, getTodayPosts,
};
