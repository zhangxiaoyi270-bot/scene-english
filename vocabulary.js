document.addEventListener('DOMContentLoaded', async () => {
  const app = window.SceneEnglish;
  let words = [];
  let filter = new URLSearchParams(location.search).get('filter') || 'all';
  let scene = 'all';
  let search = '';

  const validFilters = ['all', 'favorite', 'learning', 'review', 'mastered', 'mistakes'];
  if (!validFilters.includes(filter)) filter = 'all';
  app.setupWordModal(() => render());
  try { words = await app.loadVocabulary(); render(); } catch (error) { app.showToast('词汇数据加载失败'); console.error(error); }

  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    render();
  }));
  document.getElementById('vocab-scene').addEventListener('change', event => { scene = event.target.value; renderGrid(); });
  document.getElementById('word-search').addEventListener('input', event => { search = event.target.value.trim().toLowerCase(); renderGrid(); });
  document.getElementById('export-progress').addEventListener('click', exportProgress);
  document.getElementById('import-progress').addEventListener('click', () => document.getElementById('progress-file').click());
  document.getElementById('progress-file').addEventListener('change', importProgress);
  document.getElementById('reset-progress').addEventListener('click', resetProgress);
  window.addEventListener('progresschange', render);

  function exportProgress() {
    const blob = new Blob([app.exportProgress()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scene-english-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    app.showToast('学习进度已导出');
  }

  function importProgress(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        app.importProgress(JSON.parse(reader.result));
        app.showToast('学习进度导入成功');
        render();
      } catch (error) {
        app.showToast(error.message || '无法导入这个文件');
      } finally {
        event.target.value = '';
      }
    };
    reader.onerror = () => app.showToast('读取文件失败');
    reader.readAsText(file, 'utf-8');
  }

  function resetProgress() {
    if (!window.confirm('确定要清除全部收藏、熟练度、错题和练习记录吗？此操作无法撤销。')) return;
    app.resetProgress();
    app.showToast('学习进度已重置');
    render();
  }

  function render() {
    const progress = app.getProgress();
    const viewed = Object.keys(progress.viewed);
    document.getElementById('stat-viewed').textContent = viewed.length;
    document.getElementById('stat-favorite').textContent = progress.favorites.length;
    document.getElementById('stat-learning').textContent = app.getLearningIds(progress).length;
    document.getElementById('stat-review').textContent = app.getDueReviewIds(progress).length;
    document.getElementById('stat-mastered').textContent = progress.mastered.length;
    document.getElementById('stat-mistakes').textContent = app.getMistakeIds(progress).length;
    document.getElementById('overall-mastered').textContent = progress.mastered.length;
    const percent = Math.round(progress.mastered.length / words.length * 100) || 0;
    const ring = document.getElementById('overall-ring');
    ring.style.setProperty('--p', percent);
    ring.querySelector('strong').textContent = `${percent}%`;
    document.querySelectorAll('[data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === filter));
    renderGrid();
  }

  function renderGrid() {
    const progress = app.getProgress();
    const viewed = Object.keys(progress.viewed);
    const learning = app.getLearningIds(progress);
    const review = app.getDueReviewIds(progress);
    const mistakes = app.getMistakeIds(progress);
    let visible = words.filter(word => {
      if (scene !== 'all' && word.scene !== scene) return false;
      if (search && !word.word.toLowerCase().includes(search) && !word.meaning.includes(search)) return false;
      if (filter === 'favorite') return progress.favorites.includes(word.id);
      if (filter === 'learning') return learning.includes(word.id);
      if (filter === 'review') return review.includes(word.id);
      if (filter === 'mastered') return progress.mastered.includes(word.id);
      if (filter === 'mistakes') return mistakes.includes(word.id);
      return viewed.includes(word.id);
    });
    visible.sort((a, b) => (progress.viewed[b.id] || '').localeCompare(progress.viewed[a.id] || ''));
    const grid = document.getElementById('vocab-grid');
    const empty = document.getElementById('empty-state');
    grid.hidden = !visible.length;
    empty.hidden = Boolean(visible.length);
    grid.innerHTML = visible.map(word => {
      const favorite = progress.favorites.includes(word.id);
      const status = app.getWordStatus(word.id, progress);
      const meta = app.STATUS_META[status];
      const wrongCount = progress.wordStats[word.id]?.wrongCount || 0;
      return `<button class="vocab-card" type="button" data-id="${word.id}"><span class="vocab-card-icon">${app.wordVisualHtml(word, 'vocab-object-image')}</span><span class="vocab-card-copy"><strong>${app.escapeHtml(word.word)}</strong><small>${app.escapeHtml(word.phonetic)}</small><span>${app.escapeHtml(word.meaning)}</span></span><span class="vocab-status">${favorite ? '<i class="fav">★</i>' : ''}<i class="word-status ${meta.className}">${meta.label}</i>${wrongCount ? `<i class="mistake-count">错 ${wrongCount}</i>` : ''}</span></button>`;
    }).join('');
    grid.querySelectorAll('.vocab-card').forEach(button => button.addEventListener('click', () => app.openWordModal(words.find(word => word.id === button.dataset.id))));
  }
});
