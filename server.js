const express = require('express');
const path = require('path');
const {
  createPost, deletePost, addReaction, addReply,
  getPost, getPosts, getPostsByDate, getAvailableDates, getTodayPosts,
} = require('./db');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 오늘 메시지 (에코용)
app.get('/api/posts/today', (req, res) => {
  res.json(getTodayPosts());
});

// 날짜 목록
app.get('/api/posts/dates', (req, res) => {
  res.json(getAvailableDates());
});

// 단일 글 조회
app.get('/api/posts/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const post = getPost(id);
  if (!post) return res.status(404).json({ error: '글을 찾을 수 없어요.' });
  res.json(post);
});

// 전체 글 목록 (로그용) — 날짜 필터 지원
app.get('/api/posts', (req, res) => {
  const { date, page } = req.query;
  if (date) {
    return res.json({ posts: getPostsByDate(date) });
  }
  const p = Math.max(1, parseInt(page) || 1);
  res.json(getPosts(p));
});

// 글 작성
app.post('/api/posts', (req, res) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: '내용을 입력해주세요.' });
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return res.status(400).json({ error: '내용을 입력해주세요.' });
  }
  if (trimmed.length > 500) {
    return res.status(400).json({ error: '500자 이내로 작성해주세요.' });
  }
  const { id, delete_token } = createPost(trimmed);
  res.status(201).json({ ok: true, id, delete_token });
});

// 글 삭제
app.delete('/api/posts/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { delete_token } = req.body;
  if (!delete_token) {
    return res.status(400).json({ error: '삭제 토큰이 필요해요.' });
  }
  const result = deletePost(id, delete_token);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

// 이모지 반응
app.post('/api/posts/:id/react', (req, res) => {
  const id = parseInt(req.params.id);
  const { emoji } = req.body;
  const allowed = ['❤️', '😂', '😢', '👍', '🔥', '🍃'];
  if (!allowed.includes(emoji)) {
    return res.status(400).json({ error: '허용되지 않는 이모지예요.' });
  }
  const result = addReaction(id, emoji);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

// 답글
app.post('/api/posts/:id/reply', (req, res) => {
  const id = parseInt(req.params.id);
  const { content } = req.body;
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: '내용을 입력해주세요.' });
  }
  const trimmed = content.trim();
  if (trimmed.length === 0 || trimmed.length > 200) {
    return res.status(400).json({ error: '200자 이내로 작성해주세요.' });
  }
  const result = addReply(id, trimmed);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`엘나무숲이 열렸습니다: http://localhost:${PORT}`);
});
