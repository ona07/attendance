// フロントエンド側設定：GASのデプロイURLを差し替えて使用する
const GAS_BASE_URL = 'https://script.googleusercontent.com/a/macros/fun.ac.jp/echo?user_content_key=AehSKLjgUGecf6rCf8cdtn1YrNTNfn7_6qUGDvdFLN1ANBig-KUTtvF7JfirTXWP9P1MH5YtIHWHpwZfxHqyyUdXos692N25NTsNiTUVpIQ9CeI_X2LlejvUAg-fpmOZpzYK_wa9MocEQ6qZ9c1veuh5uG8B9quasIhckt17E8txI3FBvgd720WNWBL16sNJFaaIj9XoJ52WKc3yHxZgLaDKsBHRDSwlvZyZm1gxzIC5n8UKuvD_tChQnTW4cKhBj-HvFR6Vt5K-qRu-6Nt4zvCD4i9xejW0ybnp_jUjO-kAgwB5mE85YaE&lib=MXSav2gLrMDMv2bFCIVzo6-TirzdffZ9W'; // 例: https://script.google.com/macros/s/XXXX/exec

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
