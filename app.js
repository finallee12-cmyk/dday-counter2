/**
 * Momentum D-Day — app.js
 * Stitch UI (Momentum 대시보드) + 기존 D-Day 로직 통합 버전
 *
 * ✅ 순수 Vanilla JS (외부 라이브러리 없음)
 * ✅ localStorage 기반 상태 관리
 * ✅ 히어로 카운트다운 (시/분까지 실시간)
 * ✅ 이벤트 CRUD + 지난 이벤트 사이드바 분리
 */

'use strict';

/* ==============================================
   1. 상수 & 설정
============================================== */
const STORAGE_KEY = 'dday_events_v1';

/* ==============================================
   2. 상태
============================================== */
let state = {
  events: [],
  tickerHandle: null,
  heroEventId: null, // 히어로로 표시 중인 이벤트 ID
};

/* ==============================================
   3. localStorage 유틸
============================================== */
const Storage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  save(events) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); }
    catch (e) { console.warn('[Momentum] localStorage 저장 실패:', e); }
  },
  clear() { localStorage.removeItem(STORAGE_KEY); },
};

/* ==============================================
   4. 날짜 계산 유틸
============================================== */

/** "YYYY-MM-DD" → 자정 Date */
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** 오늘 자정 */
function todayDate() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/**
 * D-Day 계산
 * @returns {{ label, status: 'today'|'future'|'past', diff: number }}
 */
function calcDday(dateStr) {
  const target = parseDate(dateStr);
  const diff   = Math.round((target - todayDate()) / 86400000);
  if (diff === 0) return { label: 'D-Day', status: 'today',  diff: 0 };
  if (diff  > 0) return { label: `D-${diff}`, status: 'future', diff };
  return              { label: `D+${Math.abs(diff)}`, status: 'past', diff };
}

/**
 * 히어로 카운트다운: 현재 시각 기준 남은 시간 계산
 * @returns {{ days, hours, mins, totalDays, progressPct }}
 */
function calcHeroCountdown(dateStr) {
  const target = parseDate(dateStr).getTime();
  const now    = Date.now();
  const diffMs = target - now;

  if (diffMs <= 0) {
    return { days: 0, hours: 0, mins: 0, totalDays: 0, progressPct: 100 };
  }

  const days  = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const mins  = Math.floor((diffMs % 3600000) / 60000);

  // 진행률: 등록일(localStorage 저장 시점)은 없으므로 전체 D-N 기준 간단 계산
  const totalDays = Math.ceil(diffMs / 86400000);

  return { days, hours, mins, totalDays, progressPct: 0 };
}

/** 날짜 표시 포맷: YYYY-MM-DD → YYYY. MM. DD */
function formatDate(dateStr) {
  return dateStr.replace(/-/g, '. ');
}

/** XSS 방지 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

/** 고유 ID 생성 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
}

/** 테마 & 스타일: 카테고리에 따라 시안 느낌의 SVG 사용 */
function getCategoryStyle(category) {
  const ICONS = {
    Work: `<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-7"/><path d="M12 14c-3.5-3.5-4-7-1-9 3 2 3.5 5.5 1 9"/><path d="M12 17c3.5-3.5 4-7 1-9-3 2-3.5 5.5-1 9"/><path d="M7 21h10"/><path d="M16 6l1-1M18 9l1.5-1.5M9 7L7.5 5.5"/></svg>`,
    Holiday: `<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="6" width="9" height="7" rx="1.5"/><circle cx="16.5" cy="9.5" r="1.5"/><path d="M4 14c0 3 2 6 5 6s7-4 7-9-2-6-5-6-7 4-7 9z"/><path d="M4 14c2-2 4-2 6-2"/><path d="M6 18c1-1 3-2 5-2"/></svg>`,
    Personal: `<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c-2-2-2.5-4-.5-5.5 2 1.5 2.5 3.5.5 5.5"/><path d="M12 12c2-2 2.5-4 .5-5.5-2 1.5-2.5 3.5-.5 5.5"/><path d="M12 13v-3"/><path d="M7 17h3.5c1 0 2 1 2 2v0c0 1-1 1.5-2 1.5H8.5c-.5 0-1-.5-1-1v0c0-.5-.5-1-1-1H4"/><path d="M18 20c2 0 3.5-1 3.5-2.5S19 14.5 17 14.5c-1.5 0-3 1.5-3 1.5"/></svg>`,
    Others: `<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6"/><path d="M12 2a10 10 0 0 1 10 10" stroke-dasharray="2 4"/><path d="M12 6v6l4 2"/></svg>`
  };

  switch (category) {
    case 'Work':     return { bg: 'bg-[#134e4a]', icon: ICONS.Work, label: 'GROWTH ICON' };
    case 'Holiday':  return { bg: 'bg-[#1a4a4b]', icon: ICONS.Holiday, label: 'VACATION ICON' };
    case 'Personal': return { bg: 'bg-[#67bca0]', icon: ICONS.Personal, label: 'LIFESTYLE ICON' };
    default:         return { bg: 'bg-indigo-500', icon: ICONS.Others, label: 'EVENT ICON' };
  }
}

/** 배지 색상: 남은 날짜(diff) 기준 */
function getBadgeStyle(status, diff) {
  if (status === 'past') return 'bg-rose-100 text-rose-700';
  if (status === 'today') return 'bg-blue-100 text-blue-700';
  
  if (diff <= 30) return 'bg-emerald-100 text-emerald-700';
  if (diff <= 90) return 'bg-amber-100 text-amber-700';
  return 'bg-purple-100 text-purple-700';
}



/* ==============================================
   5. DOM 참조
============================================== */
const $  = (id) => document.getElementById(id);
const DOM = {
  titleInput:          () => $('event-title-input'),
  dateInput:           () => $('event-date-input'),
  categoryInput:       () => $('event-category-input'),
  sortSelect:          () => $('sort-select'),
  addBtn:              () => $('add-event-btn'),
  gridAddBtn:          () => $('grid-add-btn'),
  resetAllBtn:         () => $('reset-all-btn'),
  formErrorMsg:        () => $('form-error-msg'),
  eventList:           () => $('event-list'),
  emptyState:          () => $('empty-state'),
  pastEventList:       () => $('past-event-list'),
  pastEmpty:           () => $('past-empty'),
  heroTitle:           () => $('hero-event-title'),
  heroDate:            () => $('hero-event-date'),
  heroDays:            () => $('hero-days'),
  heroHours:           () => $('hero-hours'),
  heroMins:            () => $('hero-mins'),
  heroProgressBar:     () => $('hero-progress-bar'),
  heroProgressLabel:   () => $('hero-progress-label'),
  celebrationOverlay:  () => $('celebration-overlay'),
  celebrationMsg:      () => $('celebration-msg'),
  closeCelebrationBtn: () => $('close-celebration-btn'),
};

/* ==============================================
   6. 히어로 카운트다운 렌더링
============================================== */

function selectHeroEvent() {
  // 우선순위: today → 가장 가까운 future → 가장 최근 past
  const todays  = state.events.filter(e => calcDday(e.date).status === 'today');
  const futures = state.events.filter(e => calcDday(e.date).status === 'future')
                              .sort((a,b) => parseDate(a.date) - parseDate(b.date));
  const pasts   = state.events.filter(e => calcDday(e.date).status === 'past')
                              .sort((a,b) => parseDate(b.date) - parseDate(a.date));

  const hero = todays[0] || futures[0] || pasts[0] || null;
  state.heroEventId = hero ? hero.id : null;
  return hero;
}

function updateHero() {
  const hero = selectHeroEvent();

  if (!hero) {
    DOM.heroTitle().textContent   = '이벤트를 추가해주세요';
    DOM.heroDate().textContent    = '오른쪽 폼에서 첫 번째 이벤트를 등록해보세요.';
    DOM.heroDays().textContent    = '—';
    DOM.heroHours().textContent   = '—';
    DOM.heroMins().textContent    = '—';
    DOM.heroProgressBar().style.width = '0%';
    DOM.heroProgressLabel().textContent = '—';
    return;
  }

  const { diff, status } = calcDday(hero.date);
  const { days, hours, mins } = calcHeroCountdown(hero.date);

  DOM.heroTitle().textContent = escapeHtml(hero.title);
  DOM.heroDate().textContent  = `📅 ${formatDate(hero.date)}`;

  if (status === 'today') {
    DOM.heroDays().textContent  = '0';
    DOM.heroHours().textContent = pad(hours);
    DOM.heroMins().textContent  = pad(mins);
    DOM.heroProgressBar().style.width   = '100%';
    DOM.heroProgressLabel().textContent = 'D-Day 🎉';
  } else if (status === 'future') {
    DOM.heroDays().textContent  = pad(days);
    DOM.heroHours().textContent = pad(hours);
    DOM.heroMins().textContent  = pad(mins);
    // 간단 진행률: 오늘 기준 최대 365일을 100%로
    const pct = Math.max(0, Math.min(100, Math.round((1 - diff / 365) * 100)));
    DOM.heroProgressBar().style.width   = `${pct}%`;
    DOM.heroProgressLabel().textContent = `D-${diff}`;
  } else {
    const absDiff = Math.abs(diff);
    DOM.heroDays().textContent  = absDiff;
    DOM.heroHours().textContent = '00';
    DOM.heroMins().textContent  = '00';
    DOM.heroProgressBar().style.width   = '100%';
    DOM.heroProgressLabel().textContent = `D+${absDiff}`;
  }
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/* ==============================================
   7. 이벤트 목록 렌더링
============================================== */

function renderEventList() {
  const list = DOM.eventList();

  const sortType = DOM.sortSelect() ? DOM.sortSelect().value : 'dday-asc';

  let upcoming = state.events.filter(e => calcDday(e.date).status !== 'past');

  upcoming.sort((a,b) => {
    if (sortType === 'dday-asc') return parseDate(a.date) - parseDate(b.date);
    if (sortType === 'dday-desc') return parseDate(b.date) - parseDate(a.date);
    if (sortType === 'name-asc') return a.title.localeCompare(b.title);
    return 0;
  });

  if (upcoming.length === 0) {
    DOM.emptyState().classList.remove('hidden');
    DOM.gridAddBtn().classList.add('hidden');
    list.innerHTML = '';
  } else {
    DOM.emptyState().classList.add('hidden');
    DOM.gridAddBtn().classList.remove('hidden');
    list.innerHTML = upcoming.map(renderCard).join('');
  }

  renderPastList();
  updateHero();
}

function renderCard(event) {
  const { label, status, diff } = calcDday(event.date);
  const styleObj = getCategoryStyle(event.category || 'Others');
  const badgeClass = getBadgeStyle(status, diff);
  
  // 간단 진행률: 최대 365일 (그 이상은 0%)
  const maxDays = 365;
  const progressPct = status === 'past' || status === 'today' ? 100 : Math.max(0, Math.min(100, ((maxDays - diff) / maxDays) * 100));
  const progressColor = status === 'past' ? 'bg-rose-500' : 'bg-brand-500';

  let badgeText = label;
  if(status === 'future') badgeText = `D-\n${diff}`;
  else if(status === 'past') badgeText = `D+\n${Math.abs(diff)}`;
  else badgeText = 'D-Day';

  return `
    <div
      class="bg-white rounded-[24px] p-2.5 shadow-sm hover:shadow-xl transition-all group relative border border-slate-100 flex flex-col event-card-anim min-h-[320px] aspect-[4/5]"
      id="event-card-${event.id}"
      data-event-id="${event.id}"
    >
      <!-- Image/Icon Area -->
      <div class="relative w-full aspect-square rounded-[18px] flex flex-col items-center justify-center ${styleObj.bg} mb-4">
        <!-- Icon -->
        <div class="flex items-center justify-center opacity-90 drop-shadow-md">${styleObj.icon}</div>
        <div class="text-[9px] text-white/50 font-bold tracking-[0.2em] uppercase mt-3">${styleObj.label}</div>
        
        <!-- D-Day Badge -->
        <div 
          class="absolute -top-2 -right-2 w-10 h-10 ${badgeClass} rounded-lg flex flex-col items-center justify-center shadow-md border-2 border-white"
          id="event-badge-${event.id}"
        >
          <span class="text-[9px] font-bold leading-none">${badgeText.split('\n')[0]}</span>
          <span class="text-sm font-extrabold leading-tight">${badgeText.split('\n')[1] || ''}</span>
        </div>
      </div>

      <!-- Content Area -->
      <div class="px-2 pb-2 flex-1 flex flex-col justify-between">
        <div>
          <h4 class="font-bold text-slate-800 text-sm truncate pr-6 mb-1">${escapeHtml(event.title)}</h4>
          <p class="text-[11px] text-slate-500 font-medium">${formatDate(event.date)}</p>
        </div>
        
        <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
          <div class="h-full ${progressColor}" style="width: ${progressPct}%;"></div>
        </div>
      </div>

      <!-- Delete Button (Hover via CSS) -->
      <button
        class="absolute bottom-5 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 p-1.5 rounded-full"
        data-delete-id="${event.id}"
        title="삭제"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  `;
}

/* ==============================================
   8. 지난 이벤트 사이드바
============================================== */

function renderPastList() {
  const pasts = state.events
    .filter(e => calcDday(e.date).status === 'past')
    .sort((a,b) => parseDate(b.date) - parseDate(a.date));

  const ul = DOM.pastEventList();

  if (pasts.length === 0) {
    DOM.pastEmpty().classList.remove('hidden');
    ul.innerHTML = '';
    return;
  }
  DOM.pastEmpty().classList.add('hidden');

  ul.innerHTML = pasts.map(e => {
    const absDiff = Math.abs(calcDday(e.date).diff);
    return `
      <li class="flex items-center gap-4" id="past-item-${e.id}">
        <div class="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-lg shrink-0">🏁</div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold text-slate-700 truncate">${escapeHtml(e.title)}</p>
          <p class="text-xs text-slate-400">${absDiff}일 전 (${formatDate(e.date)}) &middot; ${e.category || 'Others'}</p>
        </div>
        <button
          class="shrink-0 text-slate-300 hover:text-red-400 text-xs transition-colors"
          data-delete-id="${e.id}"
          aria-label="${escapeHtml(e.title)} 삭제"
        >✕</button>
      </li>
    `;
  }).join('');
}

/* ==============================================
   9. 배지 실시간 갱신 (티커)
============================================== */

function updateBadges() {
  state.events.forEach(event => {
    const badge = $(`event-badge-${event.id}`);
    const card  = $(`event-card-${event.id}`);
    if (badge) {
      const { status, diff } = calcDday(event.date);
      let badgeText = label;
      if(status === 'future') badgeText = `D-\n${diff}`;
      else if(status === 'past') badgeText = `D+\n${Math.abs(diff)}`;
      else badgeText = 'D-Day';
      const badgeClass = getBadgeStyle(status, diff);

      badge.className = `absolute -top-2 -right-2 w-10 h-10 ${badgeClass} rounded-lg flex flex-col items-center justify-center shadow-md border-2 border-white`;
      badge.innerHTML = `<span class="text-[9px] font-bold leading-none">${badgeText.split('\n')[0]}</span>
                         <span class="text-sm font-extrabold leading-tight">${badgeText.split('\n')[1] || ''}</span>`;
    }
  });
  updateHero();
}

function startTicker() {
  if (state.tickerHandle) clearInterval(state.tickerHandle);
  state.tickerHandle = setInterval(updateBadges, 1000);
}

/* ==============================================
   10. 축하 오버레이
============================================== */

function checkAndShowCelebration() {
  const todays = state.events.filter(e => calcDday(e.date).status === 'today');
  if (!todays.length) return;
  const names = todays.map(e => escapeHtml(e.title)).join(', ');
  DOM.celebrationMsg().innerHTML = `🎊 <strong>${names}</strong><br/>오늘이 바로 그날입니다!`;
  DOM.celebrationOverlay().classList.remove('hidden');
}

function hideCelebration() {
  DOM.celebrationOverlay().classList.add('hidden');
}

/* ==============================================
   11. 이벤트 CRUD
============================================== */

function addEvent(title, date, category) {
  const ev = { id: generateId(), title: title.trim(), date, category };
  state.events.push(ev);
  Storage.save(state.events);
  renderEventList();
  checkAndShowCelebration();
}

function deleteEvent(id) {
  state.events = state.events.filter(e => e.id !== id);
  Storage.save(state.events);
  renderEventList();
}

function resetAllEvents() {
  state.events = [];
  Storage.clear();
  renderEventList();
}

/* ==============================================
   12. 폼 검증
============================================== */

function showFormError(msg) {
  const el = DOM.formErrorMsg();
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearFormError() {
  DOM.formErrorMsg().textContent = '';
  DOM.formErrorMsg().classList.add('hidden');
}

function validateAndSubmit() {
  clearFormError();
  const title = DOM.titleInput().value.trim();
  const date  = DOM.dateInput().value;
  const category = DOM.categoryInput() ? DOM.categoryInput().value : 'Personal';
  
  if (!title) { showFormError('⚠️ 이벤트 이름을 입력해주세요.'); DOM.titleInput().focus(); return; }
  if (!date)  { showFormError('⚠️ 날짜를 선택해주세요.'); DOM.dateInput().focus(); return; }
  
  addEvent(title, date, category);
  
  DOM.titleInput().value = '';
  DOM.dateInput().value  = new Date().toISOString().slice(0, 10);
  if(DOM.categoryInput()) DOM.categoryInput().value = 'Personal';
  DOM.titleInput().focus();
}

/* ==============================================
   13. 이벤트 바인딩
============================================== */

function scrollToForm() {
  DOM.titleInput().scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => DOM.titleInput().focus(), 400);
}

function bindEvents() {
  DOM.addBtn().addEventListener('click', validateAndSubmit);
  DOM.gridAddBtn().addEventListener('click', scrollToForm);

  if (DOM.sortSelect()) {
    DOM.sortSelect().addEventListener('change', renderEventList);
  }

  DOM.titleInput().addEventListener('keydown', e => { if (e.key === 'Enter') validateAndSubmit(); });
  DOM.dateInput().addEventListener('keydown', e => { if (e.key === 'Enter') validateAndSubmit(); });

  DOM.resetAllBtn().addEventListener('click', () => {
    if (!state.events.length) return;
    if (confirm('정말로 모든 이벤트를 삭제할까요?')) resetAllEvents();
  });

  // 이벤트 위임: 이벤트 목록 삭제
  DOM.eventList().addEventListener('click', e => {
    const btn = e.target.closest('[data-delete-id]');
    if (btn) deleteEvent(btn.dataset.deleteId);
  });

  // 이벤트 위임: 지난 이벤트 삭제
  DOM.pastEventList().addEventListener('click', e => {
    const btn = e.target.closest('[data-delete-id]');
    if (btn) deleteEvent(btn.dataset.deleteId);
  });

  DOM.closeCelebrationBtn().addEventListener('click', hideCelebration);
  DOM.celebrationOverlay().addEventListener('click', e => {
    if (e.target === DOM.celebrationOverlay()) hideCelebration();
  });
}

/* ==============================================
   14. 초기화
============================================== */

function init() {
  state.events = Storage.load();

  // 날짜 input 기본값: 오늘
  DOM.dateInput().value = new Date().toISOString().slice(0, 10);

  bindEvents();
  renderEventList();
  checkAndShowCelebration();
  startTicker();

  console.log('[Momentum D-Day] 앱 초기화 완료 ✅');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
