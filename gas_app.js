// GAS: AI勤怠管理バックエンド（単一ファイル）
// 必須プロパティ: NOTION_SECRET, NOTION_DATABASE_ID, OPENAI_API_KEY
// タイムゾーン: Asia/Tokyo

const TZ = 'Asia/Tokyo';
const TITLE_PROP = 'Title'; // Notionのタイトルプロパティ名（デフォルトは "Title"）
const PROPS = {
  date: 'Date',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  workHours: 'Work Hours',
  breakStart: 'Break Start',
  breakEnd: 'Break End',
  breakMinutes: 'Break Minutes',
  timeline: 'Timeline'
};

function doGet(e) {
  const path = ((e && e.pathInfo) || '').replace(/^\//, '');
  if (path === 'health') {
    return jsonResponse({ ok: true, message: 'alive' });
  }
  return HtmlService.createHtmlOutput(renderApp()).setTitle('AI勤怠管理');
}

function doPost(e) {
  const path = ((e && e.pathInfo) || '').replace(/^\//, '') || (e && e.parameter && e.parameter.endpoint) || '';
  try {
    if (path === 'checkin') return jsonResponse(handleCheckIn());
    if (path === 'checkout') return jsonResponse(handleCheckOut());
    if (path === 'break-start') return jsonResponse(handleBreakStart());
    if (path === 'break-end') return jsonResponse(handleBreakEnd());
    if (path === 'status') return jsonResponse(handleStatus());
    return jsonResponse({ ok: false, error: '不正なパス', path });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message, stack: err.stack });
  }
}

// CORS: Webアプリ公開時は自動で Access-Control-Allow-Origin: * が付与される
function jsonResponse(obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  // 念のためCORSヘッダーも明示
  try {
    output.setHeader('Access-Control-Allow-Origin', '*');
    output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  } catch (e) {
    // 古いランタイムでsetHeaderが使えない場合は無視
  }
  return output;
}

// フロントエンドを返す
function renderApp() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI勤怠管理</title>
  <style>
    /* シンプルなカードUI */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

    :root {
      --bg: #0f172a;
      --card: #111827;
      --accent: #38bdf8;
      --accent-2: #22c55e;
      --text: #e5e7eb;
      --muted: #94a3b8;
      --shadow: 0 15px 35px rgba(0, 0, 0, 0.35);
      --radius: 14px;
      --mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      --sans: "Inter", "Noto Sans JP", system-ui, -apple-system, sans-serif;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      background: radial-gradient(circle at 20% 20%, #1f2937, #0f172a 55%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .container {
      width: min(980px, 100%);
      max-width: 100%;
      margin: 0 auto;
      padding: 0 12px;
      display: grid;
      gap: 18px;
    }

    header h1 {
      margin: 0;
      font-size: 28px;
      letter-spacing: 0.05em;
    }
    .subtitle {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 14px;
    }

    .status-panel {
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(34, 197, 94, 0.15));
      border: 1px solid rgba(56, 189, 248, 0.5);
      padding: 16px;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    .status-label { color: var(--muted); }
    .status-text {
      font-weight: 700;
      font-size: 18px;
      text-align: right;
      flex: 1;
      min-width: 180px;
    }

    .actions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
    }

    .btn {
      padding: 14px 18px;
      border-radius: var(--radius);
      border: none;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.1s ease, box-shadow 0.2s ease, filter 0.2s ease;
      color: #0f172a;
    }
    .btn:hover { transform: translateY(-1px); filter: brightness(1.03); }
    .btn:active { transform: translateY(0); }
    .btn.primary { background: var(--accent); box-shadow: var(--shadow); }
    .btn.secondary { background: var(--accent-2); box-shadow: var(--shadow); }
    .btn.warning { background: #fbbf24; box-shadow: var(--shadow); }
    .btn.info { background: #22d3ee; box-shadow: var(--shadow); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    .card {
      background: var(--card);
      border-radius: var(--radius);
      padding: 16px;
      box-shadow: var(--shadow);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .card-title {
      color: var(--muted);
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .comment {
      font-size: 16px;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      align-items: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #f8fafc;
    }

    .log-body {
      background: #0b1220;
      border-radius: var(--radius);
      padding: 12px;
      color: #cbd5e1;
      font-family: var(--mono);
      overflow-x: auto;
      min-height: 140px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .timeline {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 8px;
    }
    .timeline li {
      display: grid;
      grid-template-columns: 80px 120px 1fr;
      gap: 8px;
      align-items: center;
      padding: 8px 10px;
      background: rgba(255,255,255,0.02);
      border-radius: 10px;
    }
    .timeline-time { color: #cbd5e1; font-family: var(--mono); }
    .timeline-label { font-weight: 700; }
    .timeline-extra { color: var(--muted); font-size: 13px; }
    .timeline-empty { color: var(--muted); }

    .status-chip {
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      text-align: center;
    }

    @media (max-width: 640px) {
      body {
        padding: 16px 12px 24px;
        align-items: flex-start;
      }
      .container { width: 100%; }
      header h1 { font-size: 22px; }
      .status-text {
        text-align: left;
        width: 100%;
      }
      .actions {
        grid-template-columns: 1fr;
      }
      .stats {
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      }
      .timeline li {
        grid-template-columns: 1fr;
        gap: 4px;
        align-items: flex-start;
      }
      .timeline-time { font-size: 13px; }
      .timeline-label { font-size: 15px; }
    }
  </style>
</head>
<body>
  <main class="container">
    <header>
      <h1>AI勤怠管理</h1>
      <p class="subtitle">GAS + Notion + OpenAI</p>
    </header>

    <section class="status-panel">
      <div class="status-label">現在の状態</div>
      <div id="statusText" class="status-text status-chip">未送信</div>
    </section>

    <section class="actions">
      <button id="checkinBtn" class="btn primary">出勤</button>
      <button id="breakStartBtn" class="btn warning">休憩開始</button>
      <button id="breakEndBtn" class="btn info">休憩終了</button>
      <button id="checkoutBtn" class="btn secondary">退勤</button>
    </section>

    <section class="card">
      <div class="stats">
        <div>
          <div class="card-title">本日の実働</div>
          <div id="netHours" class="stat-value">-</div>
        </div>
        <div>
          <div class="card-title">休憩合計</div>
          <div id="breakMinutes" class="stat-value">-</div>
        </div>
        <div>
          <div class="card-title">今週累計</div>
          <div id="weekHours" class="stat-value">-</div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-title">今日のAIコメント</div>
      <div id="comment" class="comment">まだコメントはありません。</div>
    </section>

    <section class="card">
      <div class="card-title">今日の履歴</div>
      <ul id="timeline" class="timeline"></ul>
    </section>

    <section class="log card">
      <div class="card-title">レスポンス</div>
      <pre id="log" class="log-body">待機中...</pre>
    </section>
  </main>

  <script>
    const statusText = document.getElementById('statusText');
    const commentEl = document.getElementById('comment');
    const logEl = document.getElementById('log');
    const checkinBtn = document.getElementById('checkinBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const breakStartBtn = document.getElementById('breakStartBtn');
    const breakEndBtn = document.getElementById('breakEndBtn');
    const netHoursEl = document.getElementById('netHours');
    const breakMinutesEl = document.getElementById('breakMinutes');
    const weekHoursEl = document.getElementById('weekHours');
    const timelineEl = document.getElementById('timeline');
    updateButtons('未出勤');
    renderTimeline([]);
    // 初回に最新状態を取得
    send('status');

    async function send(endpoint) {
      setStatus('通信中...');
      const runner = google.script.run
        .withSuccessHandler((data) => {
          if (!data || data.ok === false) {
            const msg = (data && data.error) || '通信エラー';
            setStatus('エラー');
            logEl.textContent = msg;
            return;
          }
          renderData(data);
        })
        .withFailureHandler((err) => {
          setStatus('エラー');
          logEl.textContent = err && err.message ? err.message : '通信エラー';
          console.error(err);
        });

      if (endpoint === 'checkin') runner.handleCheckIn();
      if (endpoint === 'checkout') runner.handleCheckOut();
      if (endpoint === 'break-start') runner.handleBreakStart();
      if (endpoint === 'break-end') runner.handleBreakEnd();
      if (endpoint === 'status') runner.handleStatus();
    }

    function setStatus(text) {
      statusText.textContent = text;
    }

    function renderData(data) {
      setStatus(data.status || '更新');
      commentEl.textContent = data.aiComment || 'コメントなし';
      logEl.textContent = JSON.stringify(data, null, 2);

      netHoursEl.textContent = data.netHours != null ? (data.netHours.toFixed(2) + ' h') : '-';
      breakMinutesEl.textContent = data.breakMinutes != null ? (data.breakMinutes.toFixed(1) + ' 分') : '-';
      weekHoursEl.textContent = data.weekHours != null ? (data.weekHours.toFixed(2) + ' h') : '-';

      renderTimeline(data.timeline || []);
      updateButtons(data.status);
    }

    function renderTimeline(events) {
      if (!events.length) {
        timelineEl.innerHTML = '<li class="timeline-empty">まだ履歴がありません。</li>';
        return;
      }
      const labels = {
        checkin: '出勤',
        checkout: '退勤',
        breakStart: '休憩開始',
        breakEnd: '休憩終了'
      };
      const items = events.map((ev) => {
        const time = formatTime(ev.ts);
        const extra = ev.minutes ? ' (+' + ev.minutes + '分)' : '';
        return '<li><span class="timeline-time">' + time + '</span><span class="timeline-label">' + (labels[ev.type] || ev.type) + '</span><span class="timeline-extra">' + extra + '</span></li>';
      }).join('');
      timelineEl.innerHTML = items;
    }

    function formatTime(ts) {
      const d = new Date(ts);
      return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }

    function updateButtons(status) {
      const isCheckedIn = status === '出勤中' || status === '休憩中' || status === '退勤済み';
      checkinBtn.disabled = isCheckedIn;
      checkoutBtn.disabled = !isCheckedIn;
      breakStartBtn.disabled = !(status === '出勤中');
      breakEndBtn.disabled = status !== '休憩中';
    }

    checkinBtn.addEventListener('click', () => send('checkin'));
    breakStartBtn.addEventListener('click', () => send('break-start'));
    breakEndBtn.addEventListener('click', () => send('break-end'));
    checkoutBtn.addEventListener('click', () => send('checkout'));
  </script>
</body>
</html>`;
}

// 環境変数取得
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  const notionSecret = props.getProperty('NOTION_SECRET');
  const notionDbId = props.getProperty('NOTION_DATABASE_ID');
  const openAiKey = props.getProperty('OPENAI_API_KEY');
  if (!notionSecret || !notionDbId || !openAiKey) {
    throw new Error('NOTION_SECRET, NOTION_DATABASE_ID, OPENAI_API_KEY をスクリプトプロパティに設定してください');
  }
  return { notionSecret, notionDbId, openAiKey };
}

// 出勤処理
function handleCheckIn() {
  const cfg = getConfig();
  const now = new Date();
  const today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const iso = formatIso(now);

  const page = getOrCreateTodayPage(cfg, today);
  assertProps(page, [PROPS.breakStart, PROPS.breakEnd, PROPS.breakMinutes, PROPS.timeline, PROPS.workHours]);

  const state = parseState(page);
  const events = state.timeline.length ? state.timeline.slice() : [];

  // 既に出勤済みなら上書きしない
  if (!state.checkIn) {
    events.push(eventOf('checkin', iso));
    updatePage(cfg, page.id, {
      [PROPS.checkIn]: { date: { start: iso } },
      [PROPS.breakMinutes]: { number: 0 },
      [PROPS.breakStart]: { date: null },
      [PROPS.breakEnd]: { date: null },
      [PROPS.timeline]: toRichText(events),
      [TITLE_PROP]: { title: [{ text: { content: `${today} 出退勤` } }] }
    });
  }

  const aiText = generateAIComment(cfg, 'start', {
    date: today,
    checkIn: state.checkIn || iso,
    checkOut: state.checkOut || '',
    workHours: state.workHours
  });
  const richText = appendComment(page.properties['AI Comment']?.rich_text, aiText, 'start');
  updatePage(cfg, page.id, {
    'AI Comment': { rich_text: richText }
  });

  const refreshed = state.checkIn ? state : parseState(getPageById(cfg, page.id));
  refreshed.timeline = events.length ? events : refreshed.timeline;

  const summary = summarize(cfg, refreshed);
  summary.aiComment = aiText;
  summary.message = '出勤を記録しました';
  return { ok: true, pageId: page.id, ...summary };
}

// 退勤処理
function handleCheckOut() {
  const cfg = getConfig();
  const now = new Date();
  const today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const iso = formatIso(now);

  const page = getOrCreateTodayPage(cfg, today);
  assertProps(page, [PROPS.breakStart, PROPS.breakEnd, PROPS.breakMinutes, PROPS.timeline, PROPS.workHours]);
  let state = parseState(page);

  if (!state.checkIn) {
    throw new Error('まだ出勤していません');
  }

  const events = state.timeline.slice();

  // 休憩中なら自動で休憩終了
  if (state.breakStart) {
    const res = finishBreak(state, now, events);
    state = res.state;
  }

  events.push(eventOf('checkout', iso));

  const netHours = calcNetHours(state, iso).netHours;
  updatePage(cfg, page.id, {
    [PROPS.checkOut]: { date: { start: iso } },
    [PROPS.workHours]: { number: netHours },
    [PROPS.breakMinutes]: { number: state.breakMinutes },
    [PROPS.breakStart]: { date: null },
    [PROPS.breakEnd]: { date: { start: iso } },
    [PROPS.timeline]: toRichText(events)
  });

  const aiText = generateAIComment(cfg, 'end', {
    date: today,
    checkIn: state.checkIn,
    checkOut: iso,
    workHours: netHours
  });
  const richText = appendComment(page.properties['AI Comment']?.rich_text, aiText, 'end');
  updatePage(cfg, page.id, { 'AI Comment': { rich_text: richText } });

  const refreshed = parseState(getPageById(cfg, page.id), events);
  const summary = summarize(cfg, refreshed);
  summary.aiComment = aiText;
  summary.message = '退勤を記録しました';
  return { ok: true, pageId: page.id, ...summary };
}

// ステータス取得（ページを作成せずに現在の状態を返す）
function handleStatus() {
  const cfg = getConfig();
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const page = findPageByDate(cfg, today);
  if (!page) {
    const emptyState = {
      pageId: null,
      checkIn: null,
      checkOut: null,
      breakStart: null,
      breakEnd: null,
      breakMinutes: 0,
      workHours: 0,
      timeline: [],
      aiComment: ''
    };
    const summary = {
      status: '未出勤',
      netHours: 0,
      breakMinutes: 0,
      weekHours: getWeekHours(cfg),
      timeline: [],
      aiComment: ''
    };
    return { ok: true, ...emptyState, ...summary };
  }

  // 既存ページがある場合のみ休憩等のプロパティを要求
  assertProps(page, [PROPS.breakStart, PROPS.breakEnd, PROPS.breakMinutes, PROPS.timeline, PROPS.workHours]);
  const state = parseState(page);
  const summary = summarize(cfg, state);
  summary.message = '最新状態を取得しました';
  return { ok: true, pageId: page.id, ...summary };
}

// 休憩開始
function handleBreakStart() {
  const cfg = getConfig();
  const now = new Date();
  const today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const iso = formatIso(now);

  const page = getOrCreateTodayPage(cfg, today);
  assertProps(page, [PROPS.breakStart, PROPS.breakEnd, PROPS.breakMinutes, PROPS.timeline, PROPS.workHours]);
  const state = parseState(page);
  if (!state.checkIn) throw new Error('先に出勤を記録してください');
  if (state.checkOut) throw new Error('すでに退勤済みです');
  if (state.breakStart) throw new Error('すでに休憩中です');

  const events = state.timeline.slice();
  events.push(eventOf('breakStart', iso));

  updatePage(cfg, page.id, {
    [PROPS.breakStart]: { date: { start: iso } },
    [PROPS.timeline]: toRichText(events)
  });

  const refreshed = parseState(getPageById(cfg, page.id), events);
  const summary = summarize(cfg, refreshed);
  summary.message = '休憩を開始しました';
  return { ok: true, pageId: page.id, ...summary };
}

// 休憩終了
function handleBreakEnd() {
  const cfg = getConfig();
  const now = new Date();
  const today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const iso = formatIso(now);

  const page = getOrCreateTodayPage(cfg, today);
  assertProps(page, [PROPS.breakStart, PROPS.breakEnd, PROPS.breakMinutes, PROPS.timeline, PROPS.workHours]);
  let state = parseState(page);
  if (!state.checkIn) throw new Error('先に出勤を記録してください');
  if (!state.breakStart) throw new Error('休憩中ではありません');

  const events = state.timeline.slice();
  const finished = finishBreak(state, now, events);
  state = finished.state;

  updatePage(cfg, page.id, {
    [PROPS.breakStart]: { date: null },
    [PROPS.breakEnd]: { date: { start: iso } },
    [PROPS.breakMinutes]: { number: state.breakMinutes },
    [PROPS.timeline]: toRichText(events),
    [PROPS.workHours]: { number: calcNetHours(state, iso).netHours }
  });

  const refreshed = parseState(getPageById(cfg, page.id), events);
  const summary = summarize(cfg, refreshed);
  summary.message = `休憩を終了しました（+${finished.deltaMinutes}分）`;
  return { ok: true, pageId: page.id, ...summary };
}

// 今日のページ取得（なければ作成）
function getOrCreateTodayPage(cfg, dateStr) {
  const found = findPageByDate(cfg, dateStr);
  if (found) return ensureTitle(cfg, found, dateStr);
  return createPage(cfg, dateStr);
}

// 今日のページ検索
function findPageByDate(cfg, dateStr) {
  const url = `https://api.notion.com/v1/databases/${cfg.notionDbId}/query`;
  const payload = {
    filter: {
      property: 'Date',
      date: { equals: dateStr }
    },
    page_size: 1
  };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: notionHeaders(cfg)
  });
  const data = JSON.parse(res.getContentText());
  return data.results && data.results.length ? data.results[0] : null;
}

// ページ作成
function createPage(cfg, dateStr) {
  const url = 'https://api.notion.com/v1/pages';
  const payload = {
    parent: { database_id: cfg.notionDbId },
    properties: {
      'Date': { date: { start: dateStr } },
      'AI Comment': { rich_text: [] },
      [TITLE_PROP]: { title: [{ text: { content: `${dateStr} 出退勤` } }] }
    }
  };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: notionHeaders(cfg)
  });
  return JSON.parse(res.getContentText());
}

// ページ更新
function updatePage(cfg, pageId, properties) {
  const url = `https://api.notion.com/v1/pages/${pageId}`;
  UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify({ properties }),
    headers: notionHeaders(cfg)
  });
}

// Notion共通リクエスト
function notionRequest(cfg, url, options) {
  const res = UrlFetchApp.fetch(url, {
    ...(options || {}),
    contentType: options?.contentType || 'application/json',
    headers: {
      ...(options?.headers || {}),
      ...notionHeaders(cfg)
    }
  });
  const text = res.getContentText();
  return text ? JSON.parse(text) : {};
}

// Notionヘッダー
function notionHeaders(cfg) {
  return {
    'Authorization': `Bearer ${cfg.notionSecret}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  };
}

// ISO文字列をリッチテキストに追記
function appendComment(currentRichText, newText, type) {
  const list = (currentRichText || []).map(r => ({
    type: 'text',
    text: { content: r.plain_text || '' }
  }));
  const stamp = Utilities.formatDate(new Date(), TZ, 'HH:mm');
  const prefix = type === 'start' ? '[出勤]' : '[退勤]';
  list.push({ type: 'text', text: { content: `${prefix} ${stamp} ${newText}\n` } });
  return list;
}

// タイムゾーン付きISO文字列を生成（例: 2025-11-26T10:00:00+09:00）
function formatIso(date) {
  return Utilities.formatDate(date, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

// タイトルプロパティが空なら付与
function ensureTitle(cfg, page, dateStr) {
  const titleProp = page.properties[TITLE_PROP];
  const hasTitle = titleProp && Array.isArray(titleProp.title) && titleProp.title.length > 0 && (titleProp.title[0].plain_text || '').trim();
  if (hasTitle) return page;
  updatePage(cfg, page.id, {
    [TITLE_PROP]: { title: [{ text: { content: `${dateStr} 出退勤` } }] }
  });
  return page;
}

function assertProps(page, names) {
  const missing = names.filter((n) => !page.properties[n]);
  if (missing.length) {
    throw new Error(`Notionデータベースに以下のプロパティを追加してください: ${missing.join(', ')}（種類: Break Start/Break End は日付、Break Minutes は数値、Timeline はリッチテキスト、Work Hours は数値）`);
  }
}

function parseState(page, overrideTimeline) {
  const props = page.properties || {};
  return {
    pageId: page.id,
    checkIn: getDateValue(props[PROPS.checkIn]),
    checkOut: getDateValue(props[PROPS.checkOut]),
    breakStart: getDateValue(props[PROPS.breakStart]),
    breakEnd: getDateValue(props[PROPS.breakEnd]),
    breakMinutes: props[PROPS.breakMinutes]?.number || 0,
    workHours: props[PROPS.workHours]?.number || null,
    timeline: overrideTimeline || parseTimeline(props[PROPS.timeline]),
    aiComment: getLatestAiComment(props['AI Comment'])
  };
}

function parseTimeline(prop) {
  if (!prop || !Array.isArray(prop.rich_text)) return [];
  const text = prop.rich_text.map((r) => r.plain_text || '').join('');
  try {
    const arr = JSON.parse(text || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function toRichText(events) {
  return { rich_text: [{ type: 'text', text: { content: JSON.stringify(events) } }] };
}

function eventOf(type, ts, extra) {
  return { type, ts, ...(extra || {}) };
}

function getPageById(cfg, pageId) {
  const url = `https://api.notion.com/v1/pages/${pageId}`;
  return notionRequest(cfg, url, { method: 'GET' });
}

function finishBreak(state, now, events) {
  const start = new Date(state.breakStart);
  const end = now instanceof Date ? now : new Date(now);
  const diffMinutes = Math.max(0, ((end - start) / (1000 * 60)));
  const rounded = Math.round(diffMinutes * 100) / 100;
  const total = Math.round((state.breakMinutes + rounded) * 100) / 100;
  const endIso = formatIso(end);
  events.push(eventOf('breakEnd', endIso, { minutes: rounded }));
  return {
    deltaMinutes: rounded,
    state: {
      ...state,
      breakStart: null,
      breakEnd: endIso,
      breakMinutes: total
    }
  };
}

function calcNetHours(state, refIso) {
  if (!state.checkIn) return { netHours: 0, totalBreakMinutes: state.breakMinutes, runningBreakMinutes: 0 };
  const now = refIso ? new Date(refIso) : new Date();
  const start = new Date(state.checkIn);
  let baseHours = Math.max(0, (now - start) / (1000 * 60 * 60));
  let breakTotal = state.breakMinutes || 0;
  let running = 0;
  if (state.breakStart) {
    running = Math.max(0, (now - new Date(state.breakStart)) / (1000 * 60));
    breakTotal += running;
  }
  const net = Math.max(0, Math.round((baseHours - breakTotal / 60) * 100) / 100);
  return {
    netHours: net,
    totalBreakMinutes: Math.round(breakTotal * 100) / 100,
    runningBreakMinutes: running
  };
}

function summarize(cfg, state) {
  const status = deriveStatus(state);
  const net = calcNetHours(state);
  const weekHours = getWeekHours(cfg);
  return {
    status,
    checkIn: state.checkIn,
    checkOut: state.checkOut,
    breakStart: state.breakStart,
    breakEnd: state.breakEnd,
    breakMinutes: net.totalBreakMinutes,
    netHours: net.netHours,
    weekHours,
    timeline: state.timeline,
    aiComment: state.aiComment
  };
}

function deriveStatus(state) {
  if (!state.checkIn) return '未出勤';
  if (state.checkOut) return '退勤済み';
  if (state.breakStart) return '休憩中';
  return '出勤中';
}

function getWeekHours(cfg) {
  const { start, end } = getWeekRange(TZ);
  const url = `https://api.notion.com/v1/databases/${cfg.notionDbId}/query`;
  const payload = {
    filter: {
      and: [
        { property: PROPS.date, date: { on_or_after: start } },
        { property: PROPS.date, date: { on_or_before: end } }
      ]
    },
    page_size: 100
  };
  const res = notionRequest(cfg, url, { method: 'POST', body: JSON.stringify(payload) });
  const sum = (res.results || []).reduce((acc, p) => {
    const v = p.properties?.[PROPS.workHours]?.number;
    return acc + (typeof v === 'number' ? v : 0);
  }, 0);
  return Math.round(sum * 100) / 100;
}

function getWeekRange(tz) {
  const now = new Date();
  const ymd = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const today = new Date(`${ymd}T00:00:00${offset(tz)}`);
  const day = today.getDay() || 7; // Monday=1...Sunday=7
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: Utilities.formatDate(monday, tz, 'yyyy-MM-dd'),
    end: Utilities.formatDate(sunday, tz, 'yyyy-MM-dd')
  };
}

function offset(tz) {
  const now = new Date();
  const formatted = Utilities.formatDate(now, tz, "XXX"); // e.g. +09:00
  return formatted;
}

function getLatestAiComment(prop) {
  if (!prop || !Array.isArray(prop.rich_text) || !prop.rich_text.length) return '';
  const text = prop.rich_text.map((r) => r.plain_text || '').join('');
  const lines = text.trim().split('\n').filter(Boolean);
  return lines.length ? lines[lines.length - 1] : text;
}

// Notionのdateプロパティから文字列を取得
function getDateValue(prop) {
  return prop && prop.date && prop.date.start ? prop.date.start : null;
}

// OpenAIでコメント生成
function generateAIComment(cfg, mode, payload) {
  const isStart = mode === 'start';
  const system = isStart ? 'あなたはパーソナル勤怠アシスタントです。以下の勤怠情報を元に、今日のスタートに向けた短いコメントを作成してください。'
    : 'あなたはパーソナル勤怠アナリストです。以下の勤怠情報を元に、今日の分析コメントを作ってください。形式は2〜3行で簡潔にまとめてください。';
  const user = JSON.stringify(payload, null, 2);

  const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${cfg.openAiKey}`
    },
    payload: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      max_tokens: 120,
      temperature: 0.7
    })
  });
  const data = JSON.parse(res.getContentText());
  const content = data.choices?.[0]?.message?.content || '';
  return content.trim();
}

// OpenAI動作確認用
function testOpenAI() {
  const cfg = getConfig();
  const sample = generateAIComment(cfg, 'start', {
    date: '2025-01-01',
    checkIn: '2025-01-01T09:00:00+09:00',
    checkOut: '',
    workHours: null
  });
  Logger.log(sample);
}
