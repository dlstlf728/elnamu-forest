const express = require('express');
const path = require('path');
const {
  createPost, deletePost, addReaction, removeReaction, addReply,
  getPost, getPosts, getPostsByDate, getAvailableDates, getTodayPosts,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 오늘 메시지 (에코용)
app.get('/api/posts/today', async (req, res) => {
  try {
    res.json(await getTodayPosts());
  } catch (e) {
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 날짜 목록
app.get('/api/posts/dates', async (req, res) => {
  try {
    res.json(await getAvailableDates());
  } catch (e) {
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 단일 글 조회
app.get('/api/posts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const post = await getPost(id);
    if (!post) return res.status(404).json({ error: '글을 찾을 수 없어요.' });
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 전체 글 목록 (로그용) — 날짜 필터 지원
app.get('/api/posts', async (req, res) => {
  try {
    const { date, page } = req.query;
    if (date) {
      return res.json({ posts: await getPostsByDate(date) });
    }
    const p = Math.max(1, parseInt(page) || 1);
    res.json(await getPosts(p));
  } catch (e) {
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 글 작성
app.post('/api/posts', async (req, res) => {
  try {
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
    const { id, delete_token } = await createPost(trimmed);
    res.status(201).json({ ok: true, id, delete_token });
  } catch (e) {
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 글 삭제
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { delete_token } = req.body;
    if (!delete_token) {
      return res.status(400).json({ error: '삭제 토큰이 필요해요.' });
    }
    const result = await deletePost(id, delete_token);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 이모지 반응 추가
app.post('/api/posts/:id/react', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { emoji } = req.body;
    const allowed = ['❤️', '😂', '😢', '👍', '🔥', '🍃'];
    if (!allowed.includes(emoji)) {
      return res.status(400).json({ error: '허용되지 않는 이모지예요.' });
    }
    const result = await addReaction(id, emoji);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 이모지 반응 취소
app.delete('/api/posts/:id/react', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { emoji } = req.body;
    const allowed = ['❤️', '😂', '😢', '👍', '🔥', '🍃'];
    if (!allowed.includes(emoji)) {
      return res.status(400).json({ error: '허용되지 않는 이모지예요.' });
    }
    const result = await removeReaction(id, emoji);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 답글
app.post('/api/posts/:id/reply', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: '내용을 입력해주세요.' });
    }
    const trimmed = content.trim();
    if (trimmed.length === 0 || trimmed.length > 200) {
      return res.status(400).json({ error: '200자 이내로 작성해주세요.' });
    }
    const result = await addReply(id, trimmed);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 날씨 API (wttr.in 프록시 + 10분 캐시)
let weatherCache = { data: null, ts: 0 };
app.get('/api/weather', async (req, res) => {
  const now = Date.now();
  if (weatherCache.data && now - weatherCache.ts < 10 * 60 * 1000) {
    return res.json(weatherCache.data);
  }
  try {
    const resp = await fetch('https://wttr.in/Seoul?format=j1');
    const json = await resp.json();
    const current = json.current_condition[0];
    const code = parseInt(current.weatherCode);
    const astronomy = json.weather[0].astronomy[0];

    let weather = 'clear';
    if ([176, 263, 266, 293, 296, 299, 302, 305, 308, 311, 314, 353, 356, 359].includes(code)) weather = 'rain';
    else if ([179, 182, 185, 227, 230, 320, 323, 326, 329, 332, 335, 338, 350, 368, 371, 374, 377, 392, 395].includes(code)) weather = 'snow';
    else if ([119, 122, 143, 248, 260].includes(code)) weather = 'cloudy';
    else if ([200, 386, 389].includes(code)) weather = 'thunder';

    weatherCache.data = {
      weather,
      code,
      desc: current.lang_ko ? current.lang_ko[0].value : current.weatherDesc[0].value,
      temp: current.temp_C,
      sunrise: astronomy.sunrise.trim(),
      sunset: astronomy.sunset.trim(),
    };
    weatherCache.ts = now;
    res.json(weatherCache.data);
  } catch {
    res.json({ weather: 'clear', temp: '20', sunrise: '06:00 AM', sunset: '07:00 PM' });
  }
});

app.listen(PORT, () => {
  console.log(`대나무숲이 열렸습니다: http://localhost:${PORT}`);
});
