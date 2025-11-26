// フロントエンド側設定：GASのデプロイURLを差し替えて使用する
const GAS_BASE_URL = 'https://script.google.com/macros/s/AKfycbw9iVTz9NumNqdQ3JajsF1M_bOoY14zEVU1tAJ5LQ1Mv5crVOA-PczzeSANXvyuG8QHqA/exec'; // 例: https://script.google.com/macros/s/XXXX/exec

const statusText = document.getElementById('statusText');
const commentEl = document.getElementById('comment');
const logEl = document.getElementById('log');
const checkinBtn = document.getElementById('checkinBtn');
const checkoutBtn = document.getElementById('checkoutBtn');

// 送信共通処理
async function send(endpoint) {
  setStatus('通信中...');
  try {
    const res = await fetch(`${GAS_BASE_URL}/${endpoint}`, {
      method: 'POST',
      // text/plain にしてプリフライト(OPTIONS)を回避
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ client: 'github-pages' })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || '通信エラー');
    }

    setStatus(data.message || '成功');
    commentEl.textContent = data.aiComment || 'コメントなし';
    logEl.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    setStatus('エラー');
    logEl.textContent = err.message;
    console.error(err);
  }
}

function setStatus(text) {
  statusText.textContent = text;
}

checkinBtn.addEventListener('click', () => send('checkin'));
checkoutBtn.addEventListener('click', () => send('checkout'));
