var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';
// Создание экземпляра бота
const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });
function notifyProcessStarted() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield bot.sendMessage(config.TELEGRAM_CHAT_ID, "Процесс запущен и выполняется.");
        }
        catch (error) { // Указан тип error как any
            console.error(`Ошибка при отправке сообщения: ${error.message}`);
        }
    });
}
// Вызов функции уведомления
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield notifyProcessStarted();
}))();
export { bot };
