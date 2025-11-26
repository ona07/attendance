// GAS: AI勤怠管理バックエンド（単一ファイル）
// 必須プロパティ: NOTION_SECRET, NOTION_DATABASE_ID, OPENAI_API_KEY
// タイムゾーン: Asia/Tokyo

const TZ = 'Asia/Tokyo';

function doGet() {
  // 動作確認・プリフライト代替（GETを許可）
  return jsonResponse({ ok: true, message: 'alive' });
}

function doPost(e) {
  const path = ((e && e.pathInfo) || '').replace(/^\//, '') || (e && e.parameter && e.parameter.endpoint) || '';
  try {
    if (path === 'checkin') return jsonResponse(handleCheckIn());
    if (path === 'checkout') return jsonResponse(handleCheckOut());
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
  const iso = now.toISOString();

  const page = getOrCreateTodayPage(cfg, today);
  const aiText = generateAIComment(cfg, 'start', {
    date: today,
    checkIn: iso,
    checkOut: getDateValue(page.properties['Check-in']) || '',
    workHours: page.properties['Work Hours']?.number || null,
  });

  const richText = appendComment(page.properties['AI Comment']?.rich_text, aiText, 'start');
  updatePage(cfg, page.id, {
    'Check-in': { date: { start: iso } },
    'AI Comment': { rich_text: richText }
  });

  return {
    ok: true,
    message: '出勤を記録しました',
    aiComment: aiText,
    checkIn: iso,
    pageId: page.id
  };
}

// 退勤処理
function handleCheckOut() {
  const cfg = getConfig();
  const now = new Date();
  const today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const iso = now.toISOString();

  const page = getOrCreateTodayPage(cfg, today);
  const checkInStr = getDateValue(page.properties['Check-in']);
  const checkInDate = checkInStr ? new Date(checkInStr) : now;
  const workHours = Math.max(0, ((now - checkInDate) / (1000 * 60 * 60)));
  const roundedHours = Math.round(workHours * 100) / 100; // 小数2桁

  const aiText = generateAIComment(cfg, 'end', {
    date: today,
    checkIn: checkInStr || '',
    checkOut: iso,
    workHours: roundedHours,
  });

  const richText = appendComment(page.properties['AI Comment']?.rich_text, aiText, 'end');
  updatePage(cfg, page.id, {
    'Check-out': { date: { start: iso } },
    'Work Hours': { number: roundedHours },
    'AI Comment': { rich_text: richText }
  });

  return {
    ok: true,
    message: '退勤を記録しました',
    aiComment: aiText,
    checkOut: iso,
    workHours: roundedHours,
    pageId: page.id
  };
}

// 今日のページ取得（なければ作成）
function getOrCreateTodayPage(cfg, dateStr) {
  const found = findPageByDate(cfg, dateStr);
  if (found) return found;
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
      'AI Comment': { rich_text: [] }
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
