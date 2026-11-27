(function () {
  'use strict';

  const STORAGE_KEY = 'sceneEnglishProgressV1';
  const TOTAL_WORDS = 140;
  const DAY = 24 * 60 * 60 * 1000;
  const REVIEW_DAYS = [0, 1, 3, 7, 15];
  const STATUS_META = {
    new: { label: '未学习', className: 'status-new' },
    learning: { label: '学习中', className: 'status-learning' },
    review: { label: '待复习', className: 'status-review' },
    mastered: { label: '已掌握', className: 'status-mastered' }
  };
  const SCENES = {
    bedroom: { en: 'Bedroom', cn: '卧室', total: 35, image: 'bedroom.png', description: '从每天醒来的地方开始，认识卧室里的常见物品。' },
    kitchen: { en: 'Kitchen', cn: '厨房', total: 35, image: 'kitchen.png', description: '走进厨房，学习做饭、用餐时最常见的英语。' },
    supermarket: { en: 'Supermarket', cn: '超市', total: 40, image: 'supermarket.png', description: '逛一遍超市，掌握买菜购物时能用上的基础词汇。' },
    livingroom: { en: 'Living Room', cn: '客厅', total: 30, image: 'living-room.png', description: '走进舒适的客厅，学习休息、阅读和看电视时常用的英语。' }
  };

  let vocabularyPromise;
  let hotspotsPromise;
  let phrasesPromise;
  let activeModalWord = null;

  function defaultProgress() {
    return { favorites: [], mastered: [], viewed: {}, review: [], practiceResults: [], wordStats: {}, version: 2 };
  }

  function emptyWordStat() {
    return { attempts: 0, correct: 0, wrongCount: 0, streak: 0, stage: 0, level: 'learning', lastAnswered: null, nextReview: null };
  }

  function normalizeProgress(saved) {
    const progress = Object.assign(defaultProgress(), saved || {});
    progress.favorites = Array.isArray(progress.favorites) ? progress.favorites : [];
    progress.mastered = Array.isArray(progress.mastered) ? progress.mastered : [];
    progress.review = Array.isArray(progress.review) ? progress.review : [];
    progress.practiceResults = Array.isArray(progress.practiceResults) ? progress.practiceResults : [];
    progress.viewed = progress.viewed && typeof progress.viewed === 'object' ? progress.viewed : {};
    progress.wordStats = progress.wordStats && typeof progress.wordStats === 'object' ? progress.wordStats : {};

    progress.mastered.forEach(id => {
      if (!progress.wordStats[id]) progress.wordStats[id] = Object.assign(emptyWordStat(), { stage: 4, level: 'mastered' });
    });
    progress.review.forEach(id => {
      if (!progress.wordStats[id]) progress.wordStats[id] = Object.assign(emptyWordStat(), { level: 'review', nextReview: new Date().toISOString() });
    });
    Object.keys(progress.viewed).forEach(id => {
      if (!progress.wordStats[id]) progress.wordStats[id] = emptyWordStat();
    });
    progress.version = 2;
    syncDerivedLists(progress);
    return progress;
  }

  function getProgress() {
    try {
      return normalizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch (_) {
      return defaultProgress();
    }
  }

  function saveProgress(progress) {
    const normalized = normalizeProgress(progress);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    updateHeaderProgress();
    window.dispatchEvent(new CustomEvent('progresschange', { detail: normalized }));
  }

  function exportProgress() {
    return JSON.stringify({ app: 'Scene English', exportedAt: new Date().toISOString(), progress: getProgress() }, null, 2);
  }

  function importProgress(payload) {
    const data = payload?.progress || payload;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('进度文件格式不正确');
    if (data.viewed && typeof data.viewed !== 'object') throw new Error('进度文件缺少有效学习记录');
    saveProgress(data);
    return getProgress();
  }

  function resetProgress() {
    localStorage.removeItem(STORAGE_KEY);
    updateHeaderProgress();
    window.dispatchEvent(new CustomEvent('progresschange', { detail: defaultProgress() }));
  }

  function isDue(stat, now = Date.now()) {
    return Boolean(stat && stat.nextReview && new Date(stat.nextReview).getTime() <= now);
  }

  function getWordStatus(id, progress = getProgress()) {
    const stat = progress.wordStats[id];
    if (stat?.level === 'mastered' || progress.mastered.includes(id)) return 'mastered';
    if (stat?.level === 'review' || isDue(stat)) return 'review';
    if (stat || progress.viewed[id]) return 'learning';
    return 'new';
  }

  function syncDerivedLists(progress) {
    const mastered = [];
    const review = [];
    Object.keys(progress.wordStats).forEach(id => {
      const stat = progress.wordStats[id];
      if (stat.level === 'mastered') mastered.push(id);
      else if (stat.level === 'review' || isDue(stat)) review.push(id);
    });
    progress.mastered = mastered;
    progress.review = review;
  }

  function getDueReviewIds(progress = getProgress()) {
    return Object.keys(progress.wordStats).filter(id => getWordStatus(id, progress) === 'review');
  }

  function getLearningIds(progress = getProgress()) {
    return Object.keys(progress.wordStats).filter(id => getWordStatus(id, progress) === 'learning');
  }

  function getMistakeIds(progress = getProgress()) {
    return Object.keys(progress.wordStats).filter(id => Number(progress.wordStats[id].wrongCount) > 0);
  }

  function toggleArrayItem(key, id) {
    if (key === 'mastered') return setManualMastery(id);
    const progress = getProgress();
    const items = new Set(progress[key] || []);
    if (items.has(id)) items.delete(id); else items.add(id);
    progress[key] = [...items];
    saveProgress(progress);
    return items.has(id);
  }

  function setManualMastery(id) {
    const progress = getProgress();
    const stat = Object.assign(emptyWordStat(), progress.wordStats[id] || {});
    const isMastered = getWordStatus(id, progress) === 'mastered';
    if (isMastered) {
      stat.level = 'learning';
      stat.stage = Math.min(3, Math.max(1, stat.stage || 1));
      stat.nextReview = new Date(Date.now() + DAY).toISOString();
    } else {
      stat.level = 'mastered';
      stat.stage = 4;
      stat.nextReview = new Date(Date.now() + REVIEW_DAYS[4] * DAY).toISOString();
    }
    progress.wordStats[id] = stat;
    if (!progress.viewed[id]) progress.viewed[id] = new Date().toISOString();
    saveProgress(progress);
    return !isMastered;
  }

  function markViewed(id) {
    const progress = getProgress();
    progress.viewed[id] = new Date().toISOString();
    if (!progress.wordStats[id]) progress.wordStats[id] = emptyWordStat();
    saveProgress(progress);
  }

  function addReview(ids) {
    const progress = getProgress();
    ids.forEach(id => {
      const stat = Object.assign(emptyWordStat(), progress.wordStats[id] || {});
      stat.level = 'review';
      stat.stage = 0;
      stat.nextReview = new Date().toISOString();
      progress.wordStats[id] = stat;
    });
    saveProgress(progress);
  }

  function recordWordAnswer(id, correct) {
    const progress = getProgress();
    const before = getWordStatus(id, progress);
    const stat = Object.assign(emptyWordStat(), progress.wordStats[id] || {});
    stat.attempts += 1;
    stat.lastAnswered = new Date().toISOString();
    if (correct) {
      stat.correct += 1;
      stat.streak += 1;
      stat.stage = Math.min(4, Math.max(0, stat.stage || 0) + 1);
      stat.level = stat.stage >= 4 ? 'mastered' : 'learning';
      stat.nextReview = new Date(Date.now() + REVIEW_DAYS[stat.stage] * DAY).toISOString();
    } else {
      stat.wrongCount += 1;
      stat.streak = 0;
      stat.stage = 0;
      stat.level = 'review';
      stat.nextReview = new Date().toISOString();
    }
    progress.wordStats[id] = stat;
    progress.viewed[id] = new Date().toISOString();
    saveProgress(progress);
    return { before, after: getWordStatus(id, normalizeProgress(progress)), stat };
  }

  function clearMistake(id) {
    const progress = getProgress();
    if (!progress.wordStats[id]) return;
    progress.wordStats[id].wrongCount = 0;
    saveProgress(progress);
  }

  function savePracticeResult(result) {
    const progress = getProgress();
    progress.practiceResults = [result, ...(progress.practiceResults || [])].slice(0, 30);
    saveProgress(progress);
  }

  async function loadVocabulary() {
    if (!vocabularyPromise) {
      vocabularyPromise = fetch('vocabulary.json?v=3.1').then(response => {
        if (!response.ok) throw new Error('词汇数据加载失败');
        return response.json();
      });
    }
    return vocabularyPromise;
  }

  async function loadHotspots() {
    if (!hotspotsPromise) {
      hotspotsPromise = fetch('hotspots.json?v=3.1').then(response => {
        if (!response.ok) throw new Error('热点数据加载失败');
        return response.json();
      });
    }
    return hotspotsPromise;
  }

  async function loadPhrases() {
    if (!phrasesPromise) {
      phrasesPromise = fetch('phrases.json?v=3.1').then(response => {
        if (!response.ok) throw new Error('短语数据加载失败');
        return response.json();
      });
    }
    return phrasesPromise;
  }

  function wordVisualHtml(word, className = 'object-image') {
    if (word?.imageAsset) return `<img class="${className}" src="${escapeHtml(word.imageAsset)}" alt="${escapeHtml(word.meaning)}">`;
    return `<span class="emoji-visual" aria-hidden="true">${word?.image || ''}</span>`;
  }

  function speak(text, button, rate = 0.82) {
    if (!('speechSynthesis' in window)) {
      showToast('当前浏览器不支持语音播放');
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1;
    if (button) {
      button.classList.add('speaking');
      utterance.onend = utterance.onerror = () => button.classList.remove('speaking');
    }
    speechSynthesis.speak(utterance);
  }

  function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function shuffled(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function updateHeaderProgress() {
    const ring = document.getElementById('header-ring');
    if (!ring) return;
    const percent = Math.round((getProgress().mastered.length / TOTAL_WORDS) * 100);
    ring.style.setProperty('--p', percent);
    const value = ring.querySelector('b');
    if (value) value.textContent = `${percent}%`;
  }

  function setupNavigation() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.main-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  function setupWordModal(onChange) {
    const modal = document.getElementById('word-modal');
    if (!modal) return null;
    const close = () => {
      modal.hidden = true;
      document.body.style.overflow = '';
      activeModalWord = null;
    };
    modal.querySelector('.modal-close')?.addEventListener('click', close);
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) close(); });
    document.getElementById('modal-speak')?.addEventListener('click', event => {
      if (activeModalWord) speak(activeModalWord.word, event.currentTarget);
    });
    document.getElementById('modal-slow-speak')?.addEventListener('click', event => {
      if (activeModalWord) speak(activeModalWord.word, event.currentTarget, 0.58);
    });
    document.getElementById('modal-favorite')?.addEventListener('click', event => {
      if (!activeModalWord) return;
      const active = toggleArrayItem('favorites', activeModalWord.id);
      setFavoriteButton(event.currentTarget, active);
      showToast(active ? '已加入收藏' : '已取消收藏');
      updateModalStatus(activeModalWord.id);
      if (onChange) onChange(activeModalWord);
    });
    document.getElementById('modal-master')?.addEventListener('click', event => {
      if (!activeModalWord) return;
      const active = setManualMastery(activeModalWord.id);
      setMasterButton(event.currentTarget, active);
      showToast(active ? '太棒了，已标记为掌握' : '已调整为学习中');
      updateModalStatus(activeModalWord.id);
      if (onChange) onChange(activeModalWord);
    });
    return { close };
  }

  function setFavoriteButton(button, active) {
    if (!button) return;
    button.classList.toggle('active', active);
    button.textContent = active ? '★ 已收藏' : '☆ 收藏';
  }

  function setMasterButton(button, active) {
    if (!button) return;
    button.classList.toggle('active', active);
    button.textContent = active ? '✓ 已掌握' : '✓ 标记为已掌握';
  }

  function updateModalStatus(id) {
    const node = document.getElementById('modal-status');
    if (!node) return;
    const progress = getProgress();
    const status = getWordStatus(id, progress);
    const stat = progress.wordStats[id];
    node.className = `word-status ${STATUS_META[status].className}`;
    node.textContent = STATUS_META[status].label;
    const detail = document.getElementById('modal-review-time');
    if (!detail) return;
    if (status === 'review') detail.textContent = '现在适合复习';
    else if (status === 'learning' && stat?.nextReview) detail.textContent = `下次复习：${new Date(stat.nextReview).toLocaleDateString('zh-CN')}`;
    else if (status === 'mastered') detail.textContent = '已完成 4 个记忆阶段';
    else detail.textContent = '点击发音并跟读，开始学习';
  }

  function openWordModal(word, options = {}) {
    const modal = document.getElementById('word-modal');
    if (!modal || !word) return;
    activeModalWord = word;
    const meta = SCENES[word.scene];
    document.getElementById('modal-scene-tag').textContent = `${meta.en} · ${meta.cn}`;
    document.getElementById('modal-visual').innerHTML = wordVisualHtml(word, 'modal-object-image');
    document.getElementById('modal-word').textContent = word.word;
    document.getElementById('modal-phonetic').textContent = word.phonetic;
    document.getElementById('modal-meaning').textContent = word.meaning;
    document.getElementById('modal-example').textContent = word.example;
    document.getElementById('modal-translation').textContent = word.exampleTranslation;
    const progress = getProgress();
    setFavoriteButton(document.getElementById('modal-favorite'), progress.favorites.includes(word.id));
    setMasterButton(document.getElementById('modal-master'), getWordStatus(word.id, progress) === 'mastered');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    markViewed(word.id);
    updateModalStatus(word.id);
    const phraseBox = document.getElementById('modal-phrases');
    if (phraseBox) {
      phraseBox.innerHTML = '<small>正在加载常用搭配…</small>';
      loadPhrases().then(phrases => {
        if (activeModalWord?.id !== word.id) return;
        const related = phrases.filter(item => item.wordIds?.includes(word.id)).slice(0, 3);
        phraseBox.innerHTML = related.length
          ? `<span>常用搭配</span>${related.map(item => `<button type="button" data-phrase="${escapeHtml(item.phrase)}"><b>${escapeHtml(item.phrase)}</b><small>${escapeHtml(item.meaning)}</small></button>`).join('')}`
          : '<span>常用搭配</span><small>这个词的短语正在补充中</small>';
        phraseBox.querySelectorAll('[data-phrase]').forEach(button => button.addEventListener('click', () => speak(button.dataset.phrase, button)));
      }).catch(() => { phraseBox.innerHTML = '<small>短语数据暂时无法加载</small>'; });
    }
    if (options.autoSpeak) setTimeout(() => speak(word.word, document.getElementById('modal-speak')), 180);
  }

  function todayViewedCount() {
    const today = new Date().toDateString();
    return Object.values(getProgress().viewed).filter(date => new Date(date).toDateString() === today).length;
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    updateHeaderProgress();
  });

  window.SceneEnglish = {
    SCENES,
    TOTAL_WORDS,
    STATUS_META,
    getProgress,
    saveProgress,
    exportProgress,
    importProgress,
    resetProgress,
    getWordStatus,
    getDueReviewIds,
    getLearningIds,
    getMistakeIds,
    toggleArrayItem,
    setManualMastery,
    markViewed,
    addReview,
    recordWordAnswer,
    clearMistake,
    savePracticeResult,
    loadVocabulary,
    loadHotspots,
    loadPhrases,
    wordVisualHtml,
    speak,
    showToast,
    escapeHtml,
    shuffled,
    setupWordModal,
    openWordModal,
    todayViewedCount
  };
})();
