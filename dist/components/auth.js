var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import axios from 'axios';
// Функция для получения авторизационного токена
function getAuthToken() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const response = yield axios.post('https://api.telemetron.net/auth/', {
                grant_type: 'password',
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                scope: 'teleport',
                username: process.env.USERNME, // Исправлено 'USERNME' на 'USERNAME'
                password: process.env.PASSWORD
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data.access_token;
        }
        catch (error) {
            const errorMessage = `Ошибка авторизации: ${((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.error_description) || error.message}`;
            console.error(errorMessage);
            // Добавляем отладочные сообщения
            //        console.error('Response data:', error.response);
            //        console.error('Response status:', error.response?.status);
            throw new Error(errorMessage); // Выбрасываем ошибку для обработки в вызывающем коде
        }
    });
}
// Функция для получения токена от Vendista
function getVendistaToken() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios.get(`https://api.vendista.ru:99/token?login=${process.env.VENDISTA_LOGIN}&password=${process.env.VENDISTA_PASSWORD}`);
            return response.data.token;
        }
        catch (error) {
            throw new Error(`Ошибка получения токена Vendista: ${error.message}`);
        }
    });
}
// Обработка ошибок авторизации
process.on('uncaughtException', (err) => {
    if (err.message.includes('Ошибка авторизации: connect ETIMEDOUT')) {
        console.error('Произошла ошибка авторизации. Приложение будет перезапущено PM2...');
        process.exit(1); // Завершаем процесс с кодом 1 для указания ошибки
    }
});
export { getAuthToken, getVendistaToken };
