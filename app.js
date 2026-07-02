// ============================================================
// 科研人格测试 · 交互逻辑
// ============================================================
import { DIMENSIONS, QUESTIONS, TYPES, SCALE } from './data.js';

const MID_LEVEL = Math.floor(SCALE.length / 2); // 中立档索引

// 每条轴的「先手」字母（并列时的默认倾向）
const AXIS_ORDER = DIMENSIONS.map((d) => Object.keys(d.poles));
const APP = document.getElementById('app');

// ---------- 状态（不可变更新：每次操作产生新对象） ----------
let state = { view: 'home', step: 0, answers: [] };

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

// ---------- 计分（加权累计） ----------
// answers[j] 为该题选择的量表档位索引（0..SCALE.length-1）
function computeCode(answers) {
  const score = {};
  answers.forEach((lvl, j) => {
    const q = QUESTIONS[j];
    const s = SCALE[lvl] || SCALE[MID_LEVEL];
    score[q.a.pole] = (score[q.a.pole] || 0) + s.wa;
    score[q.b.pole] = (score[q.b.pole] || 0) + s.wb;
  });
  return AXIS_ORDER.map(([first, second]) => {
    return (score[second] || 0) > (score[first] || 0) ? second : first; // 并列取先手
  }).join('');
}

// 每条轴的两极得分与百分比（用于结果页的维度占比条）
// 仅在用户本次真实答完题时可算；分享链接(?r=)打开时无 answers，返回 null
function computeScores(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) return null;
  const score = {};
  answers.forEach((lvl, j) => {
    const q = QUESTIONS[j];
    const s = SCALE[lvl] || SCALE[MID_LEVEL];
    score[q.a.pole] = (score[q.a.pole] || 0) + s.wa;
    score[q.b.pole] = (score[q.b.pole] || 0) + s.wb;
  });
  return AXIS_ORDER.map(([first, second]) => {
    const f = score[first] || 0;
    const s = score[second] || 0;
    const total = f + s || 1;
    const firstPct = Math.round((f / total) * 100);
    const winner = s > f ? second : first;
    return {
      first, second,
      firstMeta: letterMeta(first), secondMeta: letterMeta(second),
      firstPct, secondPct: 100 - firstPct, winner,
    };
  });
}

function letterMeta(letter) {
  for (const dim of DIMENSIONS) {
    if (dim.poles[letter]) return dim.poles[letter];
  }
  return null;
}

// 隐藏款：在 data.js 里手动标 hidden:true 的少数「反差型」（驱动力与产出方向相反）
// 想增减隐藏款，只需改 data.js 的 hidden 标记，这里无需改动
function isRareType(code) {
  return Boolean(TYPES[code] && TYPES[code].hidden);
}

// ---------- 分享链接（含结果参数，便于回访展示） ----------
function shareUrl(code) {
  const base = location.origin + location.pathname;
  return code ? `${base}?r=${code}` : base;
}

function readCodeFromUrl() {
  const r = new URLSearchParams(location.search).get('r');
  return r && TYPES[r.toUpperCase()] ? r.toUpperCase() : null;
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) { /* 回退到 execCommand */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (_) {
    return false;
  }
}

function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- 视图 ----------
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function viewHome() {
  const dims = DIMENSIONS.map((d) => {
    const [p1, p2] = Object.values(d.poles);
    return `<div class="dim">${esc(d.title.replace(/^你/, ''))}
      <b>${p1.emoji}${esc(p1.name)} / ${esc(p2.name)}${p2.emoji}</b></div>`;
  }).join('');

  return `<section class="card hero screen">
    <span class="badge">SCIENCE · BTI</span>
    <div class="emoji-row">🔬🧪📄</div>
    <h1>你是哪种<br>科研人格？</h1>
    <p>大佬、牛马、边缘人、摸鱼怪……<br>${QUESTIONS.length} 道题，测出你在实验室里的真实身份。</p>
    <div class="dims-preview">${dims}</div>
    <button class="btn btn-primary" data-act="start">开始测试 🚀</button>
    <div class="meta">4 个维度 · 16 型（藏着 2 款隐藏款 ✨）· 纯属娱乐</div>
  </section>`;
}

function viewQuestion() {
  const i = state.step;
  const q = QUESTIONS[i];
  const pct = Math.round((i / QUESTIONS.length) * 100);
  const scaleDots = SCALE.map((s, idx) => {
    const hint = idx < MID_LEVEL ? '更像上句' : idx > MID_LEVEL ? '更像下句' : '都有点 / 中立';
    const size = 16 + Math.abs(idx - MID_LEVEL) * 7; // 越靠两端越大，档数无关
    return `<button class="scale-dot side-${s.side}" data-act="answer" data-level="${idx}"
      aria-label="${esc(s.label)}（${hint}）" title="${esc(s.label)}·${hint}"><span style="width:${size}px;height:${size}px"></span></button>`;
  }).join('');
  return `<section class="card screen">
    <div class="q-top">
      <button class="q-back" data-act="back" ${i === 0 ? 'disabled' : ''} aria-label="上一题">‹</button>
      <div class="progress-wrap">
        <div class="progress-label">第 ${i + 1} / ${QUESTIONS.length} 题</div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
    </div>
    <div class="question">
      <h2>${esc(q.q)}</h2>
      <div class="spectrum">
        <div class="stmt stmt-a">${esc(q.a.text)}</div>
        <div class="scale">
          <span class="scale-end">↑ 上句</span>
          <div class="scale-dots">${scaleDots}</div>
          <span class="scale-end">下句 ↓</span>
        </div>
        <div class="stmt stmt-b">${esc(q.b.text)}</div>
      </div>
      <p class="scale-hint">点一个最接近你的位置：越靠上句 / 下句 = 越像那句，中间表示都有点</p>
    </div>
  </section>`;
}

function viewResult(code) {
  const t = TYPES[code];
  if (!t) return viewHome();
  const chips = code.split('').map((l) => {
    const m = letterMeta(l);
    return `<div class="chip"><div class="chip-letter">${l}</div><div class="chip-name">${m ? esc(m.emoji + m.name) : ''}</div></div>`;
  }).join('');
  const cp = TYPES[t.match];
  const rare = isRareType(code);
  const scores = computeScores(state.answers);
  const bars = scores ? `<div class="dim-bars">${scores.map((ax) => {
    const wf = ax.winner === ax.first;
    return `<div class="dim-bar">
      <div class="dim-bar-head">
        <span class="pole${wf ? ' win' : ''}">${ax.firstMeta.emoji} ${esc(ax.firstMeta.name)} ${ax.firstPct}%</span>
        <span class="pole${!wf ? ' win' : ''}">${ax.secondPct}% ${esc(ax.secondMeta.name)} ${ax.secondMeta.emoji}</span>
      </div>
      <div class="dim-track"><div class="dim-fill" style="width:${ax.firstPct}%"></div></div>
    </div>`;
  }).join('')}</div>` : '';

  return `<section class="card result-card screen${rare ? ' is-rare' : ''}" style="--card-tint:${t.color}22" id="resultCard">
    ${rare ? '<div class="rare-ribbon">✨ 隐藏款 ✨</div>' : ''}
    <div class="result-inner">
      <span class="tier-badge" style="background:${t.color}">${esc(t.tier)}</span>
      <div class="result-emoji">${t.emoji}</div>
      <div class="result-name">${esc(t.name)}</div>
      <div class="result-tagline">「${esc(t.tagline)}」</div>
      <div class="code-chips">${chips}</div>
      ${bars}
      <div class="result-desc">${esc(t.desc)}</div>
      <div class="result-lines">
        ${rare ? '<div class="rl rl-rare"><b>🎲 稀有度</b><span>反差隐藏款！驱动力和产出方向相反，现实中不多见，抽到算你欧 🍀</span></div>' : ''}
        <div class="rl rl-good"><b>✦ 天赋</b><span>${esc(t.good)}</span></div>
        <div class="rl rl-bad"><b>✦ 吐槽</b><span>${esc(t.bad)}</span></div>
        <div class="rl rl-cp"><b>✦ 最佳搭档</b><span>${cp.emoji} ${esc(cp.name)}（${t.match}）</span></div>
      </div>
      <div class="watermark">🔬 科研人格测试 · 测测你是哪种？</div>
    </div>
  </section>
  <section class="card" style="padding:20px 18px">
    <div class="actions">
      <button class="btn btn-primary full" data-act="save">📸 保存结果卡</button>
      <button class="btn btn-ghost" data-act="copy">🔗 复制链接</button>
      <button class="btn btn-ghost" data-act="retry">🔄 再测一次</button>
    </div>
  </section>
  <div class="footnote">把链接发给同门，看看你们是不是天生一对（搭子）～</div>`;
}

function render() {
  if (state.view === 'home') APP.innerHTML = viewHome();
  else if (state.view === 'question') APP.innerHTML = viewQuestion();
  else if (state.view === 'result') APP.innerHTML = viewResult(state.code);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- 保存结果卡为图片 ----------
async function saveResultImage() {
  const card = document.getElementById('resultCard');
  if (!card) return;
  if (typeof window.html2canvas !== 'function') {
    toast('截图组件未加载，请检查网络');
    return;
  }
  toast('正在生成结果卡…');
  card.classList.add('shooting');
  try {
    const canvas = await window.html2canvas(card, {
      backgroundColor: '#ffffff',
      scale: Math.min(3, window.devicePixelRatio * 2 || 2),
      useCORS: true,
      logging: false,
    });
    card.classList.remove('shooting');
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `科研人格-${state.code}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast('已保存，快去发朋友圈 🎉');
  } catch (err) {
    card.classList.remove('shooting');
    console.error(err);
    toast('生成失败，可长按结果卡截图');
  }
}

// ---------- 事件（委托） ----------
APP.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  if (act === 'start') {
    setState({ view: 'question', step: 0, answers: [] });
  } else if (act === 'answer') {
    const level = Number(el.dataset.level);
    const answers = [...state.answers.slice(0, state.step), level];
    const next = state.step + 1;
    if (next >= QUESTIONS.length) {
      const code = computeCode(answers);
      history.replaceState(null, '', shareUrl(code));
      setState({ view: 'result', code, answers });
    } else {
      setState({ answers, step: next });
    }
  } else if (act === 'back') {
    if (state.step > 0) setState({ step: state.step - 1 });
  } else if (act === 'retry') {
    history.replaceState(null, '', shareUrl(null));
    setState({ view: 'home', step: 0, answers: [] });
  } else if (act === 'copy') {
    const ok = await copyText(`我在科研人格测试里是「${TYPES[state.code].name}」${TYPES[state.code].emoji}，来测测你是哪种👉 ${shareUrl(null)}`);
    toast(ok ? '链接已复制，去分享吧 🔗' : '复制失败，请手动复制地址栏');
  } else if (act === 'save') {
    await saveResultImage();
  }
});

// ---------- 启动 ----------
const urlCode = readCodeFromUrl();
if (urlCode) {
  state = { view: 'result', step: QUESTIONS.length, answers: [], code: urlCode };
}
render();
