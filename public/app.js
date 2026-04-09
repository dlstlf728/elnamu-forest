// ===== DOM =====
const soundToggle = document.getElementById('soundToggle');
const forestPage = document.getElementById('forestPage');
const logPage = document.getElementById('logPage');
const postInput = document.getElementById('postInput');
const charCount = document.getElementById('charCount');
const submitBtn = document.getElementById('submitBtn');
const echoContainer = document.getElementById('echoContainer');
const forestEmpty = document.getElementById('forestEmpty');
const logList = document.getElementById('logList');
const logEmpty = document.getElementById('logEmpty');
const goLogBtn = document.getElementById('goLogBtn');
const goForestBtn = document.getElementById('goForestBtn');
const datePrevBtn = document.getElementById('datePrevBtn');
const dateNextBtn = document.getElementById('dateNextBtn');
const dateLabel = document.getElementById('dateLabel');

// 모달
const postModal = document.getElementById('postModal');
const modalClose = document.getElementById('modalClose');
const modalContent = document.getElementById('modalContent');
const modalReactions = document.getElementById('modalReactions');
const modalReplies = document.getElementById('modalReplies');
const modalReplyInput = document.getElementById('modalReplyInput');
const modalReplyBtn = document.getElementById('modalReplyBtn');

// ===== 상태 =====
const myPosts = new Map();
const myReactions = new Set(); // "postId-emoji"
let todayPosts = [];
let echoIndex = 0;
let echoTimer = null;
let availableDates = [];
let currentDateIdx = 0;
let currentModalPostId = null;
const EMOJIS = ['❤️', '😂', '😢', '👍', '🔥', '🍃'];

// 에코 겹침 방지용 - 현재 화면에 있는 메시지 위치 추적
let activeEchoPositions = [];

// ===== 사운드 토글 =====
soundToggle.addEventListener('click', () => {
  const on = window.forestAudio.toggle();
  soundToggle.textContent = on ? '🔊' : '🔇';
  soundToggle.title = on ? '소리 끄기' : '소리 켜기';
});

// ===== 페이지 전환 =====
goLogBtn.addEventListener('click', () => {
  forestPage.classList.remove('active');
  logPage.classList.add('active');
  stopEcho();
  loadDates();
});

goForestBtn.addEventListener('click', () => {
  logPage.classList.remove('active');
  forestPage.classList.add('active');
  refreshEcho();
});

// ===== 글자 수 =====
postInput.addEventListener('input', () => {
  charCount.textContent = postInput.value.length;
});

// ===== 글 작성 =====
submitBtn.addEventListener('click', submitPost);
postInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitPost();
});

async function submitPost() {
  const content = postInput.value.trim();
  if (!content || content.length > 500) return;

  submitBtn.disabled = true;
  submitBtn.textContent = '...';

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const data = await res.json();
      myPosts.set(data.id, { delete_token: data.delete_token, created_at: Date.now() });
      postInput.value = '';
      charCount.textContent = '0';
      showToast('바람에 실려 보냈어요');
      refreshEcho();
    } else {
      const data = await res.json();
      showToast(data.error || '전송 실패');
    }
  } catch { showToast('연결할 수 없어요'); }
  finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '소리치기';
  }
}

// ===== 삭제 =====
async function deletePostById(id) {
  const info = myPosts.get(id);
  if (!info) return;
  try {
    const res = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete_token: info.delete_token }),
    });
    if (res.ok) {
      myPosts.delete(id);
      showToast('사라졌어요');
      if (forestPage.classList.contains('active')) refreshEcho();
      else loadDatePosts();
      if (currentModalPostId === id) closeModal();
    } else {
      const data = await res.json();
      showToast(data.error || '삭제 실패');
      if (data.error && data.error.includes('5분')) myPosts.delete(id);
    }
  } catch { showToast('연결할 수 없어요'); }
}

function canDelete(id) {
  const info = myPosts.get(id);
  if (!info) return false;
  return Date.now() - info.created_at < 5 * 60 * 1000;
}

// ===== 에코 (숲 메인) =====
async function refreshEcho() {
  stopEcho();
  activeEchoPositions = [];
  try {
    const res = await fetch('/api/posts/today');
    todayPosts = await res.json();
  } catch { todayPosts = []; }

  echoContainer.innerHTML = '';
  if (todayPosts.length === 0) {
    forestEmpty.style.display = 'block';
    return;
  }
  forestEmpty.style.display = 'none';
  echoIndex = 0;
  showNextEcho();
}

function findNonOverlappingPosition(stage, elWidth, elHeight) {
  const maxX = Math.max(stage.width - elWidth - 20, 20);
  const maxY = Math.max(stage.height - elHeight - 20, 20);
  const padding = 30;

  for (let attempt = 0; attempt < 20; attempt++) {
    const x = Math.random() * maxX + 10;
    const y = Math.random() * maxY * 0.7 + maxY * 0.05;

    const overlaps = activeEchoPositions.some((pos) => {
      return Math.abs(pos.x - x) < (pos.w + elWidth) / 2 + padding &&
             Math.abs(pos.y - y) < (pos.h + elHeight) / 2 + padding;
    });

    if (!overlaps) return { x, y };
  }
  // 못 찾으면 그냥 랜덤
  return { x: Math.random() * maxX + 10, y: Math.random() * maxY * 0.7 + maxY * 0.05 };
}

function showNextEcho() {
  if (todayPosts.length === 0) return;

  const post = todayPosts[echoIndex % todayPosts.length];
  const el = document.createElement('div');
  el.className = 'echo-msg';
  el.style.cursor = 'pointer';

  const textSpan = document.createElement('span');
  textSpan.textContent = post.content.length > 60
    ? post.content.slice(0, 60) + '...'
    : post.content;
  el.appendChild(textSpan);

  // 클릭 → 팝업
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    openModal(post.id);
  });

  // 삭제 버튼
  if (canDelete(post.id)) {
    const delBtn = document.createElement('button');
    delBtn.className = 'echo-delete';
    delBtn.textContent = 'x';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePostById(post.id);
    });
    el.appendChild(delBtn);
  }

  const stage = echoContainer.parentElement.getBoundingClientRect();
  const estWidth = Math.min(textSpan.textContent.length * 12, 340);
  const estHeight = 60;
  const pos = findNonOverlappingPosition(stage, estWidth, estHeight);

  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';

  const posRecord = { x: pos.x, y: pos.y, w: estWidth, h: estHeight };
  activeEchoPositions.push(posRecord);

  echoContainer.appendChild(el);
  el.addEventListener('animationend', () => {
    el.remove();
    const idx = activeEchoPositions.indexOf(posRecord);
    if (idx !== -1) activeEchoPositions.splice(idx, 1);
  });

  echoIndex++;
  const delay = 3000 + Math.random() * 2000;
  echoTimer = setTimeout(showNextEcho, delay);
}

function stopEcho() {
  if (echoTimer) { clearTimeout(echoTimer); echoTimer = null; }
}

// ===== 모달 =====
async function openModal(postId) {
  currentModalPostId = postId;
  try {
    const res = await fetch(`/api/posts/${postId}`);
    if (!res.ok) { showToast('글을 불러올 수 없어요'); return; }
    const post = await res.json();
    renderModal(post);
    postModal.style.display = 'flex';
  } catch { showToast('연결할 수 없어요'); }
}

function renderModal(post) {
  modalContent.textContent = post.content;

  // 반응 버튼
  modalReactions.innerHTML = '';
  const reactions = post.reactions || {};
  EMOJIS.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.className = 'react-btn';
    const key = `${post.id}-${emoji}`;
    if (myReactions.has(key)) btn.classList.add('active');
    const count = reactions[emoji] || 0;
    btn.innerHTML = emoji + (count > 0 ? `<span class="react-count">${count}</span>` : '');
    btn.addEventListener('click', () => toggleReaction(post.id, emoji));
    modalReactions.appendChild(btn);
  });

  // 답글
  renderReplies(post.replies || []);

  // 삭제 버튼
  const existingDel = document.querySelector('.modal-delete-btn');
  if (existingDel) existingDel.remove();
  if (canDelete(post.id)) {
    const delBtn = document.createElement('button');
    delBtn.className = 'pixel-btn pixel-btn-sm modal-delete-btn';
    delBtn.textContent = '삭제';
    delBtn.style.marginTop = '12px';
    delBtn.style.background = 'var(--text-faint)';
    delBtn.addEventListener('click', () => deletePostById(post.id));
    document.querySelector('.modal-box').appendChild(delBtn);
  }
}

function renderReplies(replies) {
  modalReplies.innerHTML = '';
  replies.forEach((r) => {
    const item = document.createElement('div');
    item.className = 'reply-item';
    item.innerHTML = `${escapeHtml(r.content)}<div class="reply-time">${formatTime(r.created_at)}</div>`;
    modalReplies.appendChild(item);
  });
}

function closeModal() {
  postModal.style.display = 'none';
  currentModalPostId = null;
  const existingDel = document.querySelector('.modal-delete-btn');
  if (existingDel) existingDel.remove();
}

modalClose.addEventListener('click', closeModal);
postModal.addEventListener('click', (e) => {
  if (e.target === postModal) closeModal();
});

// 답글
modalReplyBtn.addEventListener('click', sendReply);
modalReplyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendReply();
});

async function sendReply() {
  if (!currentModalPostId) return;
  const content = modalReplyInput.value.trim();
  if (!content || content.length > 200) return;

  try {
    const res = await fetch(`/api/posts/${currentModalPostId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const data = await res.json();
      renderReplies(data.replies);
      modalReplyInput.value = '';
      showToast('답글을 남겼어요');
    } else {
      const data = await res.json();
      showToast(data.error || '전송 실패');
    }
  } catch { showToast('연결할 수 없어요'); }
}

// 이모지 반응 토글
async function toggleReaction(postId, emoji) {
  const key = `${postId}-${emoji}`;
  const isActive = myReactions.has(key);

  try {
    const res = await fetch(`/api/posts/${postId}/react`, {
      method: isActive ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
    if (res.ok) {
      const data = await res.json();
      if (isActive) {
        myReactions.delete(key);
      } else {
        myReactions.add(key);
      }
      // 버튼 UI 업데이트
      const btns = modalReactions.querySelectorAll('.react-btn');
      btns.forEach((btn) => {
        const btnEmoji = btn.childNodes[0].textContent.trim();
        if (btnEmoji === emoji) {
          const count = (data.reactions && data.reactions[emoji]) || 0;
          btn.innerHTML = emoji + (count > 0 ? `<span class="react-count">${count}</span>` : '');
          btn.classList.toggle('active', myReactions.has(key));
        }
      });
    }
  } catch { showToast('연결할 수 없어요'); }
}

// ===== 로그 — 날짜별 =====
async function loadDates() {
  try {
    const res = await fetch('/api/posts/dates');
    availableDates = await res.json();
  } catch { availableDates = []; }

  if (availableDates.length === 0) {
    dateLabel.textContent = '기록 없음';
    datePrevBtn.disabled = true;
    dateNextBtn.disabled = true;
    logList.innerHTML = '';
    logEmpty.style.display = 'block';
    return;
  }

  currentDateIdx = 0;
  updateDateNav();
  loadDatePosts();
}

function updateDateNav() {
  const d = availableDates[currentDateIdx];
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (d === today) dateLabel.textContent = '오늘';
  else if (d === yesterday) dateLabel.textContent = '어제';
  else {
    const [, m, day] = d.split('-');
    dateLabel.textContent = `${parseInt(m)}월 ${parseInt(day)}일`;
  }

  datePrevBtn.disabled = currentDateIdx >= availableDates.length - 1;
  dateNextBtn.disabled = currentDateIdx <= 0;
}

datePrevBtn.addEventListener('click', () => {
  if (currentDateIdx < availableDates.length - 1) {
    currentDateIdx++;
    updateDateNav();
    loadDatePosts();
  }
});

dateNextBtn.addEventListener('click', () => {
  if (currentDateIdx > 0) {
    currentDateIdx--;
    updateDateNav();
    loadDatePosts();
  }
});

async function loadDatePosts() {
  const date = availableDates[currentDateIdx];
  logList.innerHTML = '';

  try {
    const res = await fetch(`/api/posts?date=${date}`);
    const data = await res.json();
    const posts = data.posts;

    if (posts.length === 0) {
      logEmpty.style.display = 'block';
      return;
    }
    logEmpty.style.display = 'none';

    posts.forEach((post) => {
      const card = document.createElement('div');
      card.className = 'log-card';
      card.style.cursor = 'pointer';

      const reactions = post.reactions || {};
      const reactionHtml = Object.entries(reactions)
        .filter(([, c]) => c > 0)
        .map(([e, c]) => `<span>${e}${c}</span>`)
        .join('');

      const replyCount = (post.replies || []).length;
      const replyHtml = replyCount > 0 ? `<span class="log-reply-count">💬 ${replyCount}</span>` : '';

      let deleteHtml = '';
      if (canDelete(post.id)) {
        deleteHtml = `<button class="log-delete-btn" data-id="${post.id}">삭제</button>`;
      }

      card.innerHTML = `
        <div class="log-content">${escapeHtml(post.content)}</div>
        <div class="log-meta">
          <span>#${post.id} · ${formatTime(post.created_at)} ${replyHtml}</span>
          ${deleteHtml}
        </div>
        ${reactionHtml ? `<div class="log-reactions">${reactionHtml}</div>` : ''}
      `;

      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('log-delete-btn')) return;
        openModal(post.id);
      });

      const delBtn = card.querySelector('.log-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deletePostById(post.id);
        });
      }

      logList.appendChild(card);
    });
  } catch { showToast('글을 불러올 수 없어요'); }
}

// ===== 유틸 =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ===== 날씨 + 낮/밤 =====
const weatherLayer = document.getElementById('weatherLayer');
const weatherBadge = document.getElementById('weatherBadge');
let weatherInterval = null;

async function initWeatherAndTheme() {
  try {
    const res = await fetch('/api/weather');
    const data = await res.json();
    applyDayNight(data.sunrise, data.sunset);
    applyWeather(data.weather);
    window.forestAudio.setWeather(data.weather);
    showWeatherBadge(data);
  } catch {
    applyDayNightByHour();
  }
}

function parseTime12(str) {
  // "06:23 AM" → 분 단위
  const match = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function applyDayNight(sunrise, sunset) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sunriseMin = parseTime12(sunrise);
  const sunsetMin = parseTime12(sunset);

  if (nowMin >= sunriseMin && nowMin < sunsetMin) {
    document.body.classList.add('light');
  } else {
    document.body.classList.remove('light');
  }
}

function applyDayNightByHour() {
  const h = new Date().getHours();
  if (h >= 6 && h < 18) {
    document.body.classList.add('light');
  } else {
    document.body.classList.remove('light');
  }
}

function applyWeather(weather) {
  if (weatherInterval) clearInterval(weatherInterval);
  weatherLayer.innerHTML = '';

  // 천둥 효과
  const existingLightning = document.querySelector('.weather-lightning');
  if (existingLightning) existingLightning.remove();

  if (weather === 'rain' || weather === 'thunder') {
    const emojis = ['💧', '💧', '💧', '🌧️'];
    const count = weather === 'thunder' ? 40 : 30;
    weatherInterval = setInterval(() => spawnParticle(emojis, 'weather-rain', count), 150);

    if (weather === 'thunder') {
      const flash = document.createElement('div');
      flash.className = 'weather-lightning';
      flash.style.animationDuration = (4 + Math.random() * 6) + 's';
      document.body.appendChild(flash);
    }
  } else if (weather === 'snow') {
    const emojis = ['❄️', '❄️', '❄️', '⛄'];
    weatherInterval = setInterval(() => spawnParticle(emojis, 'weather-snow', 15), 400);
  }
}

function spawnParticle(emojis, className, maxCount) {
  if (weatherLayer.children.length > maxCount) return;
  const p = document.createElement('span');
  p.className = `weather-particle ${className}`;
  p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
  p.style.left = Math.random() * 100 + 'vw';
  p.style.animationDuration = (parseFloat(p.style.animationDuration) || (className === 'weather-snow' ? 4 + Math.random() * 4 : 0.8 + Math.random() * 0.6)) + 's';
  p.style.opacity = 0.2 + Math.random() * 0.4;
  p.style.fontSize = (className === 'weather-snow' ? 10 + Math.random() * 12 : 10 + Math.random() * 6) + 'px';
  weatherLayer.appendChild(p);
  p.addEventListener('animationend', () => p.remove());
}

function showWeatherBadge(data) {
  const icons = { clear: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️', thunder: '⛈️' };
  const icon = icons[data.weather] || '🌤️';
  weatherBadge.textContent = `${icon} ${data.desc || data.weather} ${data.temp}°C`;
}

// ===== 초기 로드 =====
refreshEcho();
initWeatherAndTheme();
