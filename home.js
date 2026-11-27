document.addEventListener('DOMContentLoaded', async () => {
  const app = window.SceneEnglish;
  try {
    const words = await app.loadVocabulary();
    renderScenes(words);
    renderDashboard(words);
    window.addEventListener('progresschange', () => renderDashboard(words));
  } catch (error) {
    app.showToast('无法加载词汇数据，请通过本地服务器打开网站');
    console.error(error);
  }

  function renderScenes(words) {
    const progress = app.getProgress();
    const grid = document.getElementById('scene-grid');
    const descriptions = {
      bedroom: '从床、枕头到衣柜，认识每天都会看到的物品。',
      kitchen: '从餐具到厨电，学会厨房里的高频实用词。',
      supermarket: '从蔬果到日用品，为日常购物积累基础词汇。',
      livingroom: '从沙发、电视到茶几，学会客厅里的常用表达。'
    };
    grid.innerHTML = Object.entries(app.SCENES).map(([key, scene], index) => {
      const mastered = words.filter(word => word.scene === key && progress.mastered.includes(word.id)).length;
      const percent = Math.round(mastered / scene.total * 100);
      return `<a class="scene-card" href="scene.html?scene=${key}">
        <div class="scene-card-visual"><img src="${scene.image}" alt="${scene.cn}场景"><span class="scene-card-tag">${scene.total} 个单词</span></div>
        <div class="scene-card-body"><div class="scene-card-title"><h3>${scene.cn}</h3><small>${scene.en}</small></div><p>${descriptions[key]}</p><div class="card-progress"><div><i style="width:${percent}%"></i></div><span>${mastered}/${scene.total} 已掌握</span></div></div>
      </a>`;
    }).join('');
  }

  function renderDashboard(words) {
    const progress = app.getProgress();
    const today = Math.min(app.todayViewedCount(), 10);
    document.getElementById('today-count').textContent = today;
    document.getElementById('today-bar').style.width = `${today * 10}%`;
    document.getElementById('goal-message').textContent = today >= 10 ? '今日目标已完成，真不错！' : `再认识 ${10 - today} 个新物品`;
    document.getElementById('mastered-count').textContent = progress.mastered.length;
    document.getElementById('favorite-count').textContent = progress.favorites.length;
    document.getElementById('review-count').textContent = progress.review.length;
    const wordMap = new Map(words.map(word => [word.id, word]));
    const recent = Object.entries(progress.viewed).sort((a, b) => new Date(b[1]) - new Date(a[1])).slice(0, 4);
    document.getElementById('recent-list').innerHTML = recent.length ? recent.map(([id]) => {
      const word = wordMap.get(id);
      return word ? `<a class="recent-item" href="scene.html?scene=${word.scene}&word=${word.id}"><span class="recent-item-icon">${app.wordVisualHtml(word, 'recent-object-image')}</span><div><strong>${word.word}</strong><small>${word.meaning} · ${app.SCENES[word.scene].cn}</small></div></a>` : '';
    }).join('') : '<div class="empty-inline">还没有学习记录，去场景里点击一个物品开始吧。</div>';
    renderScenes(words);
  }
});
