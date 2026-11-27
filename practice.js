document.addEventListener('DOMContentLoaded', async () => {
  const app = window.SceneEnglish;
  let allWords = [];
  let mode = 'listen';
  let questions = [];
  let index = 0;
  let answers = [];
  let answered = false;

  try {
    allWords = await app.loadVocabulary();
    const requestedRange = new URLSearchParams(location.search).get('range');
    if (['all', 'bedroom', 'kitchen', 'supermarket', 'livingroom', 'review', 'mistakes'].includes(requestedRange)) {
      document.getElementById('practice-scene').value = requestedRange;
    }
  } catch (error) { app.showToast('词汇数据加载失败'); console.error(error); }

  document.querySelectorAll('.mode-card').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.mode-card').forEach(node => node.classList.remove('active'));
    button.classList.add('active');
    mode = button.dataset.mode;
  }));
  document.getElementById('start-practice').addEventListener('click', startPractice);
  document.getElementById('retry-practice').addEventListener('click', resetPractice);
  document.getElementById('exit-quiz').addEventListener('click', exitPractice);
  document.getElementById('next-question').addEventListener('click', () => {
    index += 1;
    if (index >= questions.length) finishPractice(); else renderQuestion();
  });

  function resetPractice() {
    document.getElementById('result-shell').hidden = true;
    document.getElementById('practice-modes').hidden = false;
    document.getElementById('practice-setup').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startPractice() {
    const range = document.getElementById('practice-scene').value;
    const progress = app.getProgress();
    const ids = range === 'review' ? app.getDueReviewIds(progress) : range === 'mistakes' ? app.getMistakeIds(progress) : [];
    let pool = range === 'all' ? allWords : ['review', 'mistakes'].includes(range) ? allWords.filter(word => ids.includes(word.id)) : allWords.filter(word => word.scene === range);
    const minimum = ['review', 'mistakes'].includes(range) ? 1 : 4;
    if (pool.length < minimum) {
      const message = range === 'review' ? '今天没有到期单词，先学习一些新内容吧' : range === 'mistakes' ? '错题本还是空的，继续保持' : '可用词汇不足';
      app.showToast(message);
      return;
    }
    questions = app.shuffled(pool).slice(0, Math.min(10, pool.length));
    index = 0;
    answers = [];
    document.getElementById('practice-modes').hidden = true;
    document.getElementById('practice-setup').hidden = true;
    document.getElementById('result-shell').hidden = true;
    document.getElementById('quiz-shell').hidden = false;
    document.getElementById('quiz-total').textContent = questions.length;
    renderQuestion();
  }

  function exitPractice() {
    speechSynthesis?.cancel();
    document.getElementById('quiz-shell').hidden = true;
    document.getElementById('practice-modes').hidden = false;
    document.getElementById('practice-setup').hidden = false;
  }

  function renderQuestion() {
    answered = false;
    const word = questions[index];
    document.getElementById('question-number').textContent = index + 1;
    document.getElementById('quiz-progress-bar').style.width = `${((index + 1) / questions.length) * 100}%`;
    document.getElementById('answer-feedback').hidden = true;
    document.getElementById('next-question').hidden = true;
    const area = document.getElementById('question-area');
    if (mode === 'listen') renderListen(area, word);
    if (mode === 'spell') renderSpell(area, word);
    if (mode === 'choice') renderChoice(area, word);
  }

  function makeOptions(word, key) {
    const others = app.shuffled(allWords.filter(item => item.id !== word.id && item[key] !== word[key])).slice(0, 3);
    return app.shuffled([word, ...others]);
  }

  function renderListen(area, word) {
    const options = makeOptions(word, 'image');
    area.innerHTML = `<p class="question-kicker">听一听，哪个是正确的物品？</p><button class="listen-button" id="play-question" type="button" aria-label="播放单词发音">♪</button><div class="choice-grid">${options.map(item => `<button class="answer-choice" type="button" data-id="${item.id}" aria-label="选择${app.escapeHtml(item.meaning)}"><span class="choice-icon">${app.wordVisualHtml(item, 'choice-object-image')}</span><span class="choice-caption">${app.escapeHtml(item.meaning)}</span></button>`).join('')}</div>`;
    const play = () => app.speak(word.word, document.getElementById('play-question'));
    document.getElementById('play-question').addEventListener('click', play);
    area.querySelectorAll('.answer-choice').forEach(button => button.addEventListener('click', () => gradeChoice(button, word)));
    setTimeout(play, 250);
  }

  function renderSpell(area, word) {
    const firstLetter = app.escapeHtml(word.word.charAt(0).toUpperCase());
    area.innerHTML = `<p class="question-kicker">看图拼出这个单词</p><div class="spell-visual">${app.wordVisualHtml(word, 'spell-object-image')}</div><p class="spell-hint">中文提示：${app.escapeHtml(word.meaning)} · ${word.word.length} 个字母</p><div class="letter-hint" id="letter-hint" hidden>首字母是 <b>${firstLetter}</b></div><form class="spell-form" id="spell-form"><input id="spell-input" type="text" autocomplete="off" autocapitalize="none" aria-label="输入英文单词" placeholder="输入英文"><button class="button button-primary" type="submit">确认</button></form><button class="text-button hint-button" id="show-letter-hint" type="button">需要提示？</button>`;
    const input = document.getElementById('spell-input');
    input.focus();
    document.getElementById('show-letter-hint').addEventListener('click', event => {
      document.getElementById('letter-hint').hidden = false;
      event.currentTarget.hidden = true;
    });
    document.getElementById('spell-form').addEventListener('submit', event => {
      event.preventDefault();
      if (answered || !input.value.trim()) return;
      const given = input.value.trim();
      const correct = given.toLowerCase() === word.word.toLowerCase();
      input.disabled = true;
      input.style.borderColor = correct ? 'var(--mint-500)' : '#e39a91';
      recordAnswer(word, correct, given);
    });
  }

  function renderChoice(area, word) {
    const options = makeOptions(word, 'meaning');
    area.innerHTML = `<p class="question-kicker">选择正确的中文释义</p><h2 class="question-title">${app.escapeHtml(word.word)}</h2><p class="spell-hint">${app.escapeHtml(word.phonetic)}</p><div class="choice-grid" style="margin-top:26px">${options.map(item => `<button class="answer-choice" type="button" data-id="${item.id}"><span class="choice-text">${app.escapeHtml(item.meaning)}</span></button>`).join('')}</div>`;
    area.querySelectorAll('.answer-choice').forEach(button => button.addEventListener('click', () => gradeChoice(button, word)));
  }

  function gradeChoice(button, word) {
    if (answered) return;
    const correct = button.dataset.id === word.id;
    document.querySelectorAll('.answer-choice').forEach(node => {
      node.disabled = true;
      if (node.dataset.id === word.id) node.classList.add('correct');
    });
    if (!correct) button.classList.add('wrong');
    recordAnswer(word, correct, button.dataset.id);
  }

  function recordAnswer(word, correct, given) {
    answered = true;
    const learning = app.recordWordAnswer(word.id, correct);
    answers.push({ id: word.id, word: word.word, meaning: word.meaning, correct, given, status: learning.after });
    const feedback = document.getElementById('answer-feedback');
    feedback.className = `answer-feedback ${correct ? 'correct' : 'wrong'}`;
    feedback.innerHTML = `<strong>${correct ? `答对了！${app.escapeHtml(word.word)} 是“${app.escapeHtml(word.meaning)}”` : `正确答案：${app.escapeHtml(word.word)} · ${app.escapeHtml(word.meaning)}`}</strong><span>${app.escapeHtml(word.example)}</span><small>${app.escapeHtml(word.exampleTranslation)}</small>`;
    feedback.hidden = false;
    const next = document.getElementById('next-question');
    next.textContent = index === questions.length - 1 ? '查看结果 →' : '下一题 →';
    next.hidden = false;
  }

  function finishPractice() {
    const correctCount = answers.filter(item => item.correct).length;
    const percent = Math.round(correctCount / answers.length * 100);
    const wrongCount = answers.length - correctCount;
    app.savePracticeResult({ date: new Date().toISOString(), mode, score: percent, total: answers.length, correct: correctCount, answers });
    document.getElementById('quiz-shell').hidden = true;
    document.getElementById('result-shell').hidden = false;
    document.getElementById('score-percent').textContent = `${percent}%`;
    document.getElementById('score-ring').style.setProperty('--score', percent);
    document.getElementById('result-badge').textContent = percent >= 90 ? '太棒了！' : percent >= 70 ? '做得好！' : '继续加油！';
    document.getElementById('result-title').textContent = '本轮练习完成';
    document.getElementById('result-summary').textContent = `答对 ${correctCount} 题，共 ${answers.length} 题${wrongCount ? `；${wrongCount} 个词已加入复习` : '；全部答对'}`;
    document.getElementById('result-breakdown').innerHTML = answers.map(item => `<div class="result-item ${item.correct ? 'correct' : 'wrong'}"><span>${item.correct ? '✓' : '×'}</span><span>${app.escapeHtml(item.word)} · ${app.escapeHtml(item.meaning)}</span><b>${item.correct ? app.STATUS_META[item.status].label : '待复习'}</b></div>`).join('');
  }
});
