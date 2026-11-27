document.addEventListener('DOMContentLoaded', async () => {
  const app = window.SceneEnglish;
  let words = [];

  try {
    words = await app.loadVocabulary();
    render();
    window.addEventListener('progresschange', render);
  } catch (error) {
    app.showToast('复习数据加载失败');
    console.error(error);
  }

  function render() {
    const progress = app.getProgress();
    const dueIds = app.getDueReviewIds(progress);
    const mistakeIds = app.getMistakeIds(progress);
    const dueWords = words.filter(word => dueIds.includes(word.id));
    const minutes = dueWords.length ? Math.max(1, Math.ceil(dueWords.length * 0.45)) : 0;

    document.getElementById('due-count').textContent = dueWords.length;
    document.getElementById('review-minutes').textContent = minutes;
    document.getElementById('review-stat-due').textContent = dueWords.length;
    document.getElementById('review-stat-learning').textContent = app.getLearningIds(progress).length;
    document.getElementById('review-stat-mistakes').textContent = mistakeIds.length;
    document.getElementById('review-stat-mastered').textContent = progress.mastered.length;
    document.getElementById('review-message').textContent = dueWords.length
      ? `预计 ${minutes} 分钟完成。先复习到期单词，再学习新内容。`
      : '今天没有到期单词，可以进入客厅学习一些新内容。';

    const start = document.getElementById('start-review');
    start.classList.toggle('disabled', !dueWords.length);
    start.setAttribute('aria-disabled', String(!dueWords.length));
    start.href = dueWords.length ? 'practice.html?range=review' : 'scene.html?scene=livingroom';
    start.textContent = dueWords.length ? '开始今日复习 →' : '学习客厅新词 →';

    const list = document.getElementById('review-word-list');
    const empty = document.getElementById('review-empty');
    list.hidden = !dueWords.length;
    empty.hidden = Boolean(dueWords.length);
    list.innerHTML = dueWords.slice(0, 12).map(word => {
      const stat = progress.wordStats[word.id] || {};
      const accuracy = stat.attempts ? Math.round((stat.correct || 0) / stat.attempts * 100) : 0;
      return `<a class="review-word" href="scene.html?scene=${word.scene}&word=${word.id}"><span class="review-word-visual">${app.wordVisualHtml(word, 'review-object-image')}</span><span><strong>${app.escapeHtml(word.word)}</strong><small>${app.escapeHtml(word.meaning)} · ${app.SCENES[word.scene].cn}</small></span><em>${stat.attempts ? `${accuracy}%` : '待巩固'}</em></a>`;
    }).join('');

    const now = Date.now();
    let three = 0;
    let seven = 0;
    Object.values(progress.wordStats).forEach(stat => {
      if (!stat.nextReview || stat.level === 'mastered') return;
      const time = new Date(stat.nextReview).getTime();
      if (time > now && time <= now + 3 * 86400000) three += 1;
      if (time > now && time <= now + 7 * 86400000) seven += 1;
    });
    document.getElementById('schedule-today').textContent = `${dueWords.length} 个`;
    document.getElementById('schedule-three').textContent = `${three} 个`;
    document.getElementById('schedule-seven').textContent = `${seven} 个`;
  }
});
