import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';
// Создание экземпляра бота
const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });

async function notifyProcessStarted() {
    try {
        await bot.sendMessage(config.TELEGRAM_CHAT_ID, "Процесс запущен и выполняется.");
    } catch (error: any) { // Указан тип error как any
        console.error(`Ошибка при отправке сообщения: ${error.message}`);
    }
}

// Вызов функции уведомления
(async () => {
    await notifyProcessStarted();
})();



export { bot };
