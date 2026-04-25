// ぽけっと — adult wallet / savings tracker
(() => {
  'use strict';

  const STORAGE_KEY = 'pokketo_v1';
  const SHARE_URL = 'https://maxtakaharu34-cmd.github.io/pokketo-jp/';

  const CATEGORIES = {
    in: [
      { id: 'salary',  label: '給与',     emoji: '💼' },
      { id: 'side',    label: '副業',     emoji: '💻' },
      { id: 'invest',  label: '投資益',   emoji: '📈' },
      { id: 'gift-in', label: 'ギフト',   emoji: '🎁' },
      { id: 'refund',  label: '返金',     emoji: '💸' },
      { id: 'other-i', label: 'その他',   emoji: '✨' }
    ],
    out: [
      { id: 'lunch',     label: 'ランチ',     emoji: '🍱' },
      { id: 'cafe',      label: 'カフェ',     emoji: '☕' },
      { id: 'drinks',    label: '飲み代',     emoji: '🍻' },
      { id: 'groceries', label: 'スーパー',   emoji: '🛒' },
      { id: 'transit',   label: '交通',       emoji: '🚃' },
      { id: 'subs',      label: 'サブスク',   emoji: '🔁' },
      { id: 'hobby',     label: '趣味',       emoji: '🎮' },
      { id: 'beauty',    label: '美容',       emoji: '💄' },
      { id: 'fashion',   label: 'ファッション', emoji: '👕' },
      { id: 'health',    label: '医療',       emoji: '💊' },
      { id: 'home',      label: '家賃光熱',   emoji: '🏠' },
      { id: 'other-o',   label: 'その他',     emoji: '📦' }
    ]
  };

  const QUICK_AMOUNTS = [500, 1000, 3000, 5000, 10000];

  const $ = (id) => document.getElementById(id);
  const balanceEl = $('balance');
  const deltaInEl = $('delta-in');
  const deltaOutEl = $('delta-out');
  const deltaLabelEl = $('delta-label');
  const goalsEl = $('goals');
  const recListEl = $('rec-list');
  const recCountEl = $('rec-count');

  const addModal = $('add-modal');
  const modalTitle = $('modal-title');
  const catGridEl = $('cat-grid');
  const fAmount = $('f-amount'), fDate = $('f-date'), fNote = $('f-note');
  const amountChipsEl = $('amount-chips');
  const formError = $('form-error');

  const goalModal = $('goal-modal');
  const gName = $('g-name'), gTarget = $('g-target'), gCurrent = $('g-current');

  const toastEl = $('toast');

  const state = {
    records: [],
    goals: [],
    period: 'month', // 'month' | 'week' | 'all'
    draft: { kind: 'out', categoryId: '', editingGoalId: null }
  };
  load();

  function load() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (!s) return;
      const obj = JSON.parse(s);
      if (Array.isArray(obj.records)) state.records = obj.records;
      if (Array.isArray(obj.goals)) state.goals = obj.goals;
    } catch {}
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      records: state.records,
      goals: state.goals
    }));
  }

  function clearChildren(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function el(tag, props) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      if (k === 'class') e.className = props[k];
      else if (k === 'style') Object.assign(e.style, props[k]);
      else if (k === 'text') e.textContent = props[k];
      else e.setAttribute(k, props[k]);
    }
    return e;
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function formatYen(n) {
    return '¥' + Math.round(n).toLocaleString('ja-JP');
  }
  function categoryById(id) {
    for (const arr of [CATEGORIES.in, CATEGORIES.out]) {
      const c = arr.find((x) => x.id === id);
      if (c) return c;
    }
    return null;
  }
  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove('show'), 1500);
  }

  // Period filter
  function recordsForPeriod() {
    if (state.period === 'all') return state.records.slice();
    const today = new Date();
    if (state.period === 'month') {
      const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      return state.records.filter((r) => r.date.slice(0, 7) === ym);
    }
    // week: last 7 days from today (inclusive)
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 6);
    const cutStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    return state.records.filter((r) => r.date >= cutStr);
  }

  // ---------- Render ----------
  function render() {
    // Balance is total across ALL records — wallet feel
    let totalIn = 0, totalOut = 0;
    for (const r of state.records) {
      if (r.kind === 'in') totalIn += r.amount;
      else                  totalOut += r.amount;
    }
    balanceEl.textContent = formatYen(totalIn - totalOut);

    // Period delta
    const recs = recordsForPeriod();
    let pIn = 0, pOut = 0;
    for (const r of recs) {
      if (r.kind === 'in') pIn += r.amount;
      else                  pOut += r.amount;
    }
    deltaInEl.textContent = '+ ' + formatYen(pIn);
    deltaOutEl.textContent = '− ' + formatYen(pOut);
    deltaLabelEl.textContent = state.period === 'month' ? '今月' : state.period === 'week' ? '今週' : '全期間';

    // Goals
    clearChildren(goalsEl);
    for (const g of state.goals) {
      const card = el('div', { class: 'goal' });
      const name = el('div', { class: 'gname', text: g.name });
      const target = el('div', { class: 'gtarget', text: '目標 ' + formatYen(g.target) });
      const barWrap = el('div', { class: 'gbar-wrap' });
      const pct = g.target > 0 ? Math.max(0, Math.min(100, (g.current / g.target) * 100)) : 0;
      const bar = el('div', { class: 'gbar', style: { width: pct + '%' } });
      barWrap.appendChild(bar);
      const pctRow = el('div', { class: 'gpct' });
      pctRow.textContent = formatYen(g.current);
      const small = el('span', { class: 'small', text: ` / ${pct.toFixed(0)}%` });
      pctRow.appendChild(small);
      const del = el('button', { class: 'gdel', text: '✕', title: '削除' });
      del.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!confirm(`目標「${g.name}」を削除？`)) return;
        state.goals = state.goals.filter((x) => x.id !== g.id);
        save();
        render();
      });
      card.appendChild(name);
      card.appendChild(target);
      card.appendChild(barWrap);
      card.appendChild(pctRow);
      card.appendChild(del);
      // Tap card to add to goal
      card.addEventListener('click', () => promptGoalDeposit(g));
      goalsEl.appendChild(card);
    }
    // Always add an "add" placeholder
    const adder = el('div', { class: 'goal empty', text: '＋ 目標を追加' });
    adder.addEventListener('click', openAddGoal);
    goalsEl.appendChild(adder);

    // Records list
    const sorted = recs.slice().sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id
    );
    recCountEl.textContent = sorted.length + '件';
    clearChildren(recListEl);
    if (sorted.length === 0) {
      const e = el('div', { class: 'list-empty' });
      e.textContent = 'まだ取引がありません。\n下の「収入」「支出」から記録してください。';
      recListEl.appendChild(e);
    } else {
      for (const r of sorted) {
        const c = categoryById(r.categoryId);
        const row = el('div', { class: 'rec ' + r.kind });
        const ic = el('div', { class: 'icon', text: c?.emoji || '?' });
        const meta = el('div', { class: 'meta' });
        meta.appendChild(el('div', { class: 'cat', text: c?.label || r.categoryId }));
        if (r.note) meta.appendChild(el('div', { class: 'note', text: r.note }));
        const dt = el('div', { class: 'date', text: r.date.slice(5).replace('-', '/') });
        const am = el('div', {
          class: 'amt',
          text: (r.kind === 'in' ? '+' : '-') + formatYen(r.amount)
        });
        const del = el('button', { class: 'del', text: '✕', title: '削除' });
        del.addEventListener('click', () => {
          if (!confirm('この取引を削除？')) return;
          state.records = state.records.filter((x) => x.id !== r.id);
          save();
          render();
        });
        row.appendChild(ic);
        row.appendChild(meta);
        row.appendChild(dt);
        row.appendChild(am);
        row.appendChild(del);
        recListEl.appendChild(row);
      }
    }
  }

  // ---------- Add modal ----------
  function openAdd(kind) {
    state.draft = { kind, categoryId: CATEGORIES[kind][0].id };
    modalTitle.textContent = kind === 'in' ? '↑ 収入を記録' : '↓ 支出を記録';
    fAmount.value = '';
    fDate.value = todayStr();
    fNote.value = '';
    formError.style.display = 'none';
    rebuildCatGrid();
    rebuildAmountChips();
    addModal.classList.add('show');
    setTimeout(() => fAmount.focus(), 50);
  }
  function rebuildCatGrid() {
    clearChildren(catGridEl);
    for (const c of CATEGORIES[state.draft.kind]) {
      const b = el('button', { class: 'cat-btn' + (c.id === state.draft.categoryId ? ' on' : '') });
      b.appendChild(el('span', { class: 'emoji', text: c.emoji }));
      b.appendChild(el('span', { text: c.label }));
      b.addEventListener('click', () => {
        state.draft.categoryId = c.id;
        rebuildCatGrid();
      });
      catGridEl.appendChild(b);
    }
  }
  function rebuildAmountChips() {
    clearChildren(amountChipsEl);
    for (const a of QUICK_AMOUNTS) {
      const c = el('button', { class: 'chip', text: '+ ' + a.toLocaleString() });
      c.addEventListener('click', () => {
        const cur = Number(fAmount.value) || 0;
        fAmount.value = cur + a;
      });
      amountChipsEl.appendChild(c);
    }
  }
  function saveAdd() {
    const amount = Math.floor(Number(fAmount.value) || 0);
    if (amount <= 0) {
      formError.textContent = '金額を1円以上で入力してください';
      formError.style.display = '';
      return;
    }
    state.records.push({
      id: Date.now(),
      kind: state.draft.kind,
      categoryId: state.draft.categoryId,
      amount,
      date: fDate.value || todayStr(),
      note: fNote.value.trim() || ''
    });
    save();
    addModal.classList.remove('show');
    render();
    showToast(state.draft.kind === 'in' ? '収入を記録' : '支出を記録');
  }

  // ---------- Goals ----------
  function openAddGoal() {
    gName.value = '';
    gTarget.value = '';
    gCurrent.value = '';
    goalModal.classList.add('show');
    setTimeout(() => gName.focus(), 50);
  }
  function saveGoal() {
    const name = gName.value.trim();
    const target = Math.floor(Number(gTarget.value) || 0);
    const current = Math.floor(Number(gCurrent.value) || 0);
    if (!name || target <= 0) {
      showToast('名前と目標金額を入力');
      return;
    }
    state.goals.push({
      id: Date.now(),
      name,
      target,
      current
    });
    save();
    goalModal.classList.remove('show');
    render();
    showToast('目標を追加');
  }
  function promptGoalDeposit(g) {
    const v = prompt(`「${g.name}」に いくら積立する？\n（マイナス値で取り崩しもOK）`, '');
    if (v === null) return;
    const amt = Math.floor(Number(v));
    if (!isFinite(amt) || amt === 0) return;
    g.current = Math.max(0, g.current + amt);
    save();
    render();
    showToast(amt > 0 ? `+${formatYen(amt)} 積立` : `${formatYen(amt)} 取崩`);
  }

  // ---------- Wire up ----------
  $('btn-in').addEventListener('click', () => openAdd('in'));
  $('btn-out').addEventListener('click', () => openAdd('out'));
  $('btn-save').addEventListener('click', saveAdd);
  $('btn-cancel').addEventListener('click', () => addModal.classList.remove('show'));
  $('btn-cancel-2').addEventListener('click', () => addModal.classList.remove('show'));
  fAmount.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveAdd(); });
  addModal.addEventListener('click', (e) => {
    if (e.target === addModal) addModal.classList.remove('show');
  });

  $('btn-add-goal').addEventListener('click', openAddGoal);
  $('btn-goal-save').addEventListener('click', saveGoal);
  $('btn-goal-cancel').addEventListener('click', () => goalModal.classList.remove('show'));
  $('btn-goal-cancel-2').addEventListener('click', () => goalModal.classList.remove('show'));
  goalModal.addEventListener('click', (e) => {
    if (e.target === goalModal) goalModal.classList.remove('show');
  });

  document.querySelectorAll('.period-row button').forEach((b) => {
    b.addEventListener('click', () => {
      state.period = b.dataset.period;
      document.querySelectorAll('.period-row button').forEach((x) =>
        x.classList.toggle('on', x === b)
      );
      render();
    });
  });

  $('btn-reset').addEventListener('click', () => {
    if (!confirm('すべての取引と目標を削除しますか？')) return;
    state.records = [];
    state.goals = [];
    save();
    render();
    showToast('リセットしました');
  });
  $('btn-share').addEventListener('click', () => {
    let inSum = 0, outSum = 0;
    for (const r of state.records) {
      if (r.kind === 'in') inSum += r.amount; else outSum += r.amount;
    }
    const balance = inSum - outSum;
    let txt = `今の残高 ${formatYen(balance)} (収入 ${formatYen(inSum)} / 支出 ${formatYen(outSum)})`;
    if (state.goals.length) {
      const top = state.goals[0];
      const pct = ((top.current / top.target) * 100).toFixed(0);
      txt += ` / 目標「${top.name}」${pct}%`;
    }
    txt += ' #ぽけっと';
    const url = `https://x.com/intent/post?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(SHARE_URL)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  render();
})();
