document.addEventListener('DOMContentLoaded', async () => {
  const app = window.SceneEnglish;
  const params = new URLSearchParams(location.search);
  const sceneKey = app.SCENES[params.get('scene')] ? params.get('scene') : 'bedroom';
  let allWords = [];
  let hotspots = {};
  let filterUnmastered = false;
  let hotspotsVisible = true;
  let sequenceWords = [];
  let sequenceIndex = -1;

  app.setupWordModal(() => {
    renderAll();
    updateSequenceControls();
  });
  document.getElementById('scene-select').addEventListener('change', event => {
    location.href = `scene.html?scene=${event.target.value}`;
  });
  document.getElementById('sidebar-filter').addEventListener('click', event => {
    filterUnmastered = !filterUnmastered;
    event.currentTarget.setAttribute('aria-pressed', String(filterUnmastered));
    event.currentTarget.textContent = filterUnmastered ? '显示全部' : '只看未掌握';
    renderWordList();
  });
  document.getElementById('toggle-hotspots').addEventListener('click', event => {
    hotspotsVisible = !hotspotsVisible;
    document.querySelectorAll('.hotspot').forEach(node => node.classList.toggle('hidden-hotspot', !hotspotsVisible));
    event.currentTarget.textContent = hotspotsVisible ? '隐藏热点' : '显示热点';
  });
  document.getElementById('start-sequence').addEventListener('click', startSequence);
  document.getElementById('sequence-prev').addEventListener('click', () => moveSequence(-1));
  document.getElementById('sequence-next').addEventListener('click', () => moveSequence(1));

  try {
    [allWords, hotspots] = await Promise.all([app.loadVocabulary(), app.loadHotspots()]);
    renderAll();
    document.getElementById('canvas-loading').hidden = true;
    const requestedWord = params.get('word');
    if (requestedWord) {
      const word = allWords.find(item => item.id === requestedWord && item.scene === sceneKey);
      if (word) setTimeout(() => openWord(word), 250);
    }
  } catch (error) {
    document.getElementById('canvas-loading').textContent = '场景数据加载失败，请通过本地服务器访问。';
    console.error(error);
  }

  function sceneWords() {
    return allWords.filter(word => word.scene === sceneKey);
  }

  function renderAll() {
    const scene = app.SCENES[sceneKey];
    const words = sceneWords();
    const progress = app.getProgress();
    const mastered = words.filter(word => app.getWordStatus(word.id, progress) === 'mastered').length;
    document.title = `${scene.cn} ${scene.en} · 看图学英语`;
    document.getElementById('scene-cn').textContent = scene.cn;
    document.getElementById('scene-en').textContent = scene.en;
    document.getElementById('scene-description').textContent = scene.description;
    document.getElementById('scene-select').value = sceneKey;
    document.getElementById('scene-image').src = scene.image;
    document.getElementById('scene-image').alt = `${scene.cn}生活场景`;
    document.getElementById('scene-mastered').textContent = mastered;
    document.getElementById('scene-total').textContent = words.length;
    document.getElementById('word-count-label').textContent = `${words.length} 个`;
    document.getElementById('scene-progress-bar').style.width = `${Math.round(mastered / words.length * 100)}%`;
    renderHotspots();
    renderWordList();
    renderSceneTabs();
  }

  function renderHotspots() {
    const layer = document.getElementById('hotspot-layer');
    const progress = app.getProgress();
    const positions = hotspots[sceneKey] || {};
    layer.innerHTML = sceneWords().map(word => {
      const point = positions[word.hotspot];
      if (!point) return '';
      const status = app.getWordStatus(word.id, progress);
      return `<button class="hotspot ${status} ${hotspotsVisible ? '' : 'hidden-hotspot'}" style="left:${point.x}%;top:${point.y}%" type="button" data-id="${word.id}" data-label="${app.escapeHtml(word.word)}" aria-label="学习 ${app.escapeHtml(word.word)}，${app.escapeHtml(word.meaning)}"></button>`;
    }).join('');
    layer.querySelectorAll('.hotspot').forEach(button => button.addEventListener('click', () => {
      openWord(allWords.find(item => item.id === button.dataset.id), button);
    }));
  }

  function renderWordList() {
    const progress = app.getProgress();
    let words = sceneWords();
    if (filterUnmastered) words = words.filter(word => app.getWordStatus(word.id, progress) !== 'mastered');
    const list = document.getElementById('scene-word-list');
    list.innerHTML = words.length ? words.map(word => {
      const status = app.getWordStatus(word.id, progress);
      const meta = app.STATUS_META[status];
      return `<button class="word-list-item ${status}" type="button" data-id="${word.id}"><span class="item-icon">${app.wordVisualHtml(word, 'list-object-image')}</span><div><strong>${app.escapeHtml(word.word)}</strong><small>${app.escapeHtml(word.meaning)}</small></div><span class="list-status ${meta.className}">${meta.label}</span></button>`;
    }).join('') : '<div class="empty-inline">这个场景的单词都掌握啦！</div>';
    list.querySelectorAll('.word-list-item').forEach(button => button.addEventListener('click', () => openWord(allWords.find(word => word.id === button.dataset.id))));
  }

  function renderSceneTabs() {
    document.getElementById('scene-tabs').innerHTML = Object.keys(app.SCENES).map(key => `<button class="scene-tab-dot ${key === sceneKey ? 'active' : ''}" data-scene="${key}" type="button" aria-label="切换到${app.SCENES[key].cn}"></button>`).join('');
    document.querySelectorAll('.scene-tab-dot').forEach(button => button.addEventListener('click', () => { location.href = `scene.html?scene=${button.dataset.scene}`; }));
  }

  function startSequence() {
    const progress = app.getProgress();
    const words = sceneWords();
    const pending = words.filter(word => app.getWordStatus(word.id, progress) !== 'mastered');
    sequenceWords = pending.length ? pending : words;
    sequenceIndex = 0;
    openWord(sequenceWords[sequenceIndex], null, true);
    app.showToast(pending.length ? '已从第一个未掌握单词开始' : '本场景已掌握，开始快速复习');
  }

  function moveSequence(offset) {
    if (!sequenceWords.length) return;
    sequenceIndex = Math.min(sequenceWords.length - 1, Math.max(0, sequenceIndex + offset));
    openWord(sequenceWords[sequenceIndex], null, true);
  }

  function updateSequenceControls() {
    const controls = document.getElementById('sequence-controls');
    if (!controls) return;
    controls.hidden = sequenceIndex < 0 || !sequenceWords.length;
    if (controls.hidden) return;
    document.getElementById('sequence-label').textContent = `${sequenceIndex + 1} / ${sequenceWords.length}`;
    document.getElementById('sequence-prev').disabled = sequenceIndex === 0;
    document.getElementById('sequence-next').disabled = sequenceIndex === sequenceWords.length - 1;
  }

  function openWord(word, source, fromSequence = false) {
    if (!word) return;
    if (!fromSequence) {
      sequenceIndex = -1;
      sequenceWords = [];
    }
    document.querySelectorAll('.hotspot').forEach(node => node.classList.toggle('active', node.dataset.id === word.id));
    app.openWordModal(word, { autoSpeak: Boolean(source) || fromSequence });
    updateSequenceControls();
  }
});
