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
import axios from 'axios';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
// Загрузить переменные окружения из файла .env
dotenv.config();
// Убедитесь, что все необходимые переменные окружения определены
const config = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    USERNME: process.env.USERNME,
    PASSWORD: process.env.PASSWORD,
    BASE_URL: process.env.BASE_URL,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID
};
// Логирование токена для проверки
console.log('TELEGRAM_TOKEN:', config.TELEGRAM_TOKEN);
console.log('clientid:', config.CLIENT_ID);
console.log('clientsecret:', config.CLIENT_SECRET);
console.log('username:', config.USERNME);
console.log('password:', config.PASSWORD);
console.log('base_url:', config.BASE_URL);
console.log('TELEGRAM_chat_id:', config.TELEGRAM_CHAT_ID);
// Создание экземпляра бота
const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });
// Функция для получения авторизационного токена
function getAuthToken() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const response = yield axios.post(`https://api.telemetron.net/auth/`, {
                grant_type: 'password',
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                scope: 'teleport',
                username: process.env.USERNME,
                password: process.env.PASSWORD
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data.access_token;
        }
        catch (error) {
            throw new Error(`Ошибка авторизации: ${((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.error_description) || error.message}`);
        }
    });
}
// Функция для получения статуса аппарата
function getMachineStatus() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios.get(`https://api.telemetron.net/v2/vending_machines/${process.env.VM_ID}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${yield getAuthToken()}`
                }
            });
            const state = response.data.state;
            switch (state) {
                case 0:
                case null:
                    return `${state} - неизвестно`;
                case 1:
                    return `${state} - работает`;
                case 2:
                    return `${state} - не работает`;
                case 3:
                    return `${state} - нет GSM-связи`;
                default:
                    return `${state} - неизвестное состояние`;
            }
        }
        catch (error) {
            return `Ошибка получения статуса: ${error.message}`;
        }
    });
}
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Привет! Введите /check для проверки выдачи.")
        .then(() => {
        console.log('Сообщение успешно отправлено');
    })
        .catch((error) => {
        console.error(`Ошибка отправки сообщения: ${error.message}`);
    });
});
// Обработчик для команды /check
bot.onText(/\/check/, (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const chatId = msg.chat.id;
    let status = 'Неизвестный статус';
    let responseTime;
    let startTime = 0; // Инициализируем переменную значением 0
    try {
        status = yield getMachineStatus();
        const token = yield getAuthToken();
        startTime = performance.now(); // Начинаем отсчет времени перед отправкой запроса
        const response = yield axios.post(`https://api.telemetron.net/v2/vending_machines/${process.env.VM_ID}/dispense`, {
            number: "106",
            cup: "0",
            sugar: "0",
            discount: "0"
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const endTime = performance.now(); // Время после получения ответа
        responseTime = endTime - startTime; // Рассчитываем время отклика
        yield sendResponse(chatId, status, response, responseTime);
    }
    catch (error) {
        const unknownError = error;
        // Если произошла ошибка, запоминаем время и обновляем ответ
        const endTime = performance.now(); // Обновляем время отклика
        responseTime = endTime - startTime; // Рассчитываем время отклика
        console.error('Ошибка при выполнении запроса:', unknownError.message);
        console.error('Статус аппарата перед ошибкой:', status);
        yield handleError(chatId, unknownError, status, responseTime);
    }
}));
function sendResponse(chatId, status, response, responseTime) {
    return __awaiter(this, void 0, void 0, function* () {
        const markdownResponse = `
*Статус аппарата*: \`${status}\`
*Статус код*: \`${response.status}\`
*Время ответа API*: \`${responseTime.toFixed(2)} мс\`
*Ответ от API*:
\`\`\`json
${JSON.stringify(response.data, null, 2)}
\`\`\`
  `;
        yield bot.sendMessage(chatId, markdownResponse, { parse_mode: 'Markdown' });
    });
}
function handleError(chatId, error, status, responseTime) {
    return __awaiter(this, void 0, void 0, function* () {
        let errorMessage = `Ошибка. ${error.message}\n*Время ответа API*: \`${responseTime.toFixed(2)} мс\`\n*Статус аппарата*: \`${status}\``;
        if (error.response) {
            errorMessage = `
*Статус аппарата*: \`${status}\`
*Статус код*: \`${error.response.status}\`
*Время ответа API*: \`${responseTime.toFixed(2)} мс\`
*Ответ от API*:
\`\`\`json
${JSON.stringify(error.response.data, null, 2)}
\`\`\`
    `;
        }
        else if (error.request) {
            errorMessage = `Ошибка: запрос был сделан, но ответа не получено\n*Время ответа API*: \`${responseTime.toFixed(2)} мс\`\n*Статус аппарата*: \`${status}\``;
        }
        yield bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
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
// Функция для выполнения команды перезагрузки
function sendRebootCommand(token) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios.post(`https://api.vendista.ru:99/terminals/${process.env.VENDISTA_ID}/commands/?token=${token}`, {
                command_id: "2"
            }, {
                headers: {
                    Authorization: `Bearer ${token}` // Используем Bearer токен для авторизации
                }
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Ошибка выполнения команды перезагрузки: ${error.message}`);
        }
    });
}
// Обработчик для команды /reboot
bot.onText(/\/reboot/, (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const chatId = msg.chat.id;
    try {
        const vendistaToken = yield getVendistaToken();
        const rebootResponse = yield sendRebootCommand(vendistaToken);
        const markdownResponse = `
Команда перезагрузки отправлена успешно.
Ответ от API:
\`\`\`json
${JSON.stringify(rebootResponse, null, 2)}
\`\`\`
    `;
        yield bot.sendMessage(chatId, markdownResponse, { parse_mode: 'Markdown' });
    }
    catch (error) {
        yield bot.sendMessage(chatId, `Ошибка при отправке команды перезагрузки: ${error.message}`, { parse_mode: 'Markdown' });
    }
}));
// Функция для отправки команды проверки апи вендисты на удаленную выдачу.
function sendCheckApiCommand(token) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios.post(`https://api.vendista.ru:99/terminals/${process.env.VENDISTA_ID}/commands/?token=${token}`, {
                command_id: "40"
            }, {
                headers: {
                    Authorization: `Bearer ${token}` // Используем Bearer токен для авторизации
                }
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Ошибка выполнения команды проверки API: ${error.message}`);
        }
    });
}
// Обработчик для команды /apivendistachk
bot.onText(/\/apivendistachk/, (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const chatId = msg.chat.id;
    try {
        const vendistaToken = yield getVendistaToken();
        const checkApiResponse = yield sendCheckApiCommand(vendistaToken);
        const markdownResponse = `
Команда проверки API отправлена успешно.
Ответ от API:
\`\`\`json
${JSON.stringify(checkApiResponse, null, 2)}
\`\`\`
    `;
        yield bot.sendMessage(chatId, markdownResponse, { parse_mode: 'Markdown' });
    }
    catch (error) {
        yield bot.sendMessage(chatId, `Ошибка при отправке команды проверки API: ${error.message}`, { parse_mode: 'Markdown' });
    }
}));
const logs = [];
let currentLog = null;
function sendRequest() {
    return __awaiter(this, void 0, void 0, function* () {
        let response = null;
        let responseTime;
        const body = JSON.stringify({
            number: "106",
            cup: "0",
            sugar: "0",
            discount: "0"
        });
        const token = yield getAuthToken();
        const startTime = performance.now();
        const newDate = new Date().toISOString().split('T')[0];
        // Проверка на смену даты
        if (!currentLog || currentLog.date !== newDate) {
            // Архивируем старые логи
            yield archiveOldLogs(currentLog); // Убедитесь, что это действие происходит до переинициализации currentLog
            currentLog = {
                date: newDate,
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                successPercentage: 0,
                averageResponseTime: 0,
                errorDetails: []
            };
        }
        try {
            response = yield fetch(`https://api.telemetron.net/v2/vending_machines/${process.env.VM_ID}/dispense`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body
            });
            const endTime = performance.now();
            responseTime = endTime - startTime;
            const data = yield response.json(); // Получение данных
            currentLog.totalRequests += 1;
            if (response.ok) {
                currentLog.successfulRequests += 1;
            }
            else {
                currentLog.failedRequests += 1;
                currentLog.errorDetails.push({ timestamp: new Date().toISOString(), message: `Error ${response.status}: ${JSON.stringify(data)}` });
            }
            currentLog.successPercentage = (currentLog.successfulRequests / currentLog.totalRequests) * 100;
            currentLog.averageResponseTime = ((currentLog.averageResponseTime * (currentLog.totalRequests - 1)) + responseTime) / currentLog.totalRequests;
            return { response, responseTime, data }; // Возвращаем также данные
        }
        catch (error) {
            responseTime = performance.now() - startTime;
            currentLog.totalRequests += 1;
            currentLog.failedRequests += 1;
            currentLog.errorDetails.push({ timestamp: new Date().toISOString(), message: error instanceof Error ? error.message : 'Unknown error' });
            return { response: null, responseTime, data: null }; // Возвращаем null для данных
        }
    });
}
// Функция для архивирования старых логов
function archiveOldLogs(log) {
    return __awaiter(this, void 0, void 0, function* () {
        if (log) {
            try {
                const logContent = `
      Дата: ${log.date}
      Всего запросов: ${log.totalRequests}
      Успешных: ${log.successfulRequests}
      Не успешных: ${log.failedRequests}
      Процент успешных: ${(log.totalRequests === 0 ? 0 : ((log.successfulRequests / log.totalRequests) * 100).toFixed(2))}%
      Среднее время ответа API: ${log.averageResponseTime.toFixed(2)} мс
      Ошибки: ${log.errorDetails.length ? log.errorDetails.map(err => `
      - Время: ${err.timestamp}, Сообщение: ${err.message}`).join('') : 'Нет ошибок'}`;
                const filePath = path.join(__dirname, 'logs_archive.txt');
                console.log('Путь к файлу:', filePath);
                // Проверка на существование файла и запись в архив
                if (!fs.existsSync(filePath)) {
                    yield fs.promises.writeFile(filePath, logContent);
                }
                else {
                    yield fs.promises.appendFile(filePath, logContent);
                }
            }
            catch (error) {
                console.error('Ошибка при архивировании логов:', error);
            }
        }
        else {
            console.error('Лог для архивирования не определен или равен null.');
        }
    });
}
let isErrorNotified = false; // Переменная для отслеживания состояния уведомления об ошибке
let lastErrorCode = null; // Переменная для хранения последнего кода ошибки
function handleResponse(response, responseTime, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const errorCode = response.ok ? null : response.status; // Устанавливаем код ошибки, если есть ошибка
        if (errorCode) {
            // Если возникла ошибка и уведомление еще не отправлено
            if (!isErrorNotified || lastErrorCode !== errorCode) {
                const message = `*Ошибка! ⛔️ 
Статус код:       ${errorCode}
Время ответа API:* \`${responseTime.toFixed(2)} мс\`
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`;
                try {
                    yield bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
                    console.log('Уведомление об ошибке отправлено успешно.');
                    isErrorNotified = true; // Устанавливаем флаг, что уведомление об ошибке отправлено
                    lastErrorCode = errorCode; // Сохраняем код ошибки
                }
                catch (error) {
                    console.error('Ошибка при отправке уведомления об ошибке:', error);
                }
            }
        }
        else {
            // Если запрос завершился успешно и ошибка была ранее зафиксирована
            if (isErrorNotified) {
                const resolvedMessage = `
*Проблема решена!*        ✅
*Запрос завершился успешно.*
*Время ответа API:*       \`${responseTime.toFixed(2)} мс\`
      `;
                try {
                    yield bot.sendMessage(process.env.TELEGRAM_CHAT_ID, resolvedMessage, { parse_mode: 'Markdown' });
                    console.log('Уведомление о решении проблемы отправлено успешно.');
                    isErrorNotified = false; // Сбрасываем флаг, так как проблема решена
                    lastErrorCode = null; // Сбрасываем код ошибки
                }
                catch (error) {
                    console.error('Ошибка при отправке уведомления о решении проблемы:', error);
                }
            }
        }
    });
}
// Функция для записи логов в файл
function saveLogsToFile() {
    return __awaiter(this, void 0, void 0, function* () {
        if (currentLog)
            logs.push(currentLog);
        const latestLog = logs[logs.length - 1]; // Получаем последний лог
        const logContent = `
Дата: ${latestLog.date}
Всего запросов: ${latestLog.totalRequests}
Успешных: ${latestLog.successfulRequests}
Не успешных: ${latestLog.failedRequests}
Процент успешных: ${(latestLog.totalRequests === 0 ? 0 : ((latestLog.successfulRequests / latestLog.totalRequests) * 100).toFixed(2))}%
Среднее время ответа API: ${latestLog.averageResponseTime.toFixed(2)} мс
Ошибки: ${latestLog.errorDetails.length ? latestLog.errorDetails.map(err => `
- Время: ${err.timestamp}, Сообщение: ${err.message}`).join('') : 'Нет ошибок'}`;
        yield fs.promises.writeFile('api_log.txt', logContent);
    });
}
// Функция для проверки и архивирования существующих логов перед запуском
function checkAndArchiveExistingLogs() {
    return __awaiter(this, void 0, void 0, function* () {
        if (fs.existsSync('api_log.txt')) {
            const data = yield fs.promises.readFile('api_log.txt', 'utf-8');
            // Парсинг и сохранение в архив
            const oldLog = parseLog(data);
            yield archiveOldLogs(oldLog);
            // Очищаем файл логов
            yield fs.promises.writeFile('api_log.txt', '');
        }
    });
}
// Парсинг логов из строки
function parseLog(logData) {
    const lines = logData.split('\n').filter(line => line.trim() !== '');
    const logEntry = {};
    for (const line of lines) {
        if (line.startsWith('Дата:')) {
            logEntry.date = line.split(': ')[1];
        }
        else if (line.startsWith('Всего запросов:')) {
            logEntry.totalRequests = parseInt(line.split(': ')[1]);
        }
        else if (line.startsWith('Успешных:')) {
            logEntry.successfulRequests = parseInt(line.split(': ')[1]);
        }
        else if (line.startsWith('Не успешных:')) {
            logEntry.failedRequests = parseInt(line.split(': ')[1]);
        }
        else if (line.startsWith('Процент успешных:')) {
            logEntry.successPercentage = parseFloat(line.split(': ')[1]);
        }
        else if (line.startsWith('Среднее время ответа API:')) {
            logEntry.averageResponseTime = parseFloat(line.split(': ')[1]);
        }
        else if (line.startsWith('Ошибки:')) {
            logEntry.errorDetails = [];
            const errorLines = lines.slice(lines.indexOf(line) + 1);
            for (const errorLine of errorLines) {
                if (errorLine.startsWith('- Время:')) {
                    const timestamp = errorLine.split(', ')[0].split(': ')[1];
                    const message = errorLine.split(', Сообщение: ')[1];
                    logEntry.errorDetails.push({ timestamp, message });
                }
            }
        }
    }
    return logEntry;
}
// Функция для запуска периодического выполнения запроса
function startInterval() {
    return __awaiter(this, void 0, void 0, function* () {
        // Проверяем и архивируем существующие логи перед запуском
        yield checkAndArchiveExistingLogs();
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            const { response, responseTime, data } = yield sendRequest(); // Получаем данные
            if (response) {
                yield handleResponse(response, responseTime, data); // Передаем данные
            }
            yield saveLogsToFile();
        }), 10 * 1000);
    });
}
startInterval().catch(error => {
    console.error('Error starting interval:', error);
});
//Добавление команды Statistic
function getStatistics() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('Чтение файла api_log.txt...');
            const data = yield fs.promises.readFile('api_log.txt', 'utf-8');
            const lines = data.split('\n');
            console.log('Обработка последних 20 строк...');
            const last20Lines = lines.slice(-20);
            if (!last20Lines.some(line => line.startsWith('Дата:'))) {
                console.log('Строки, начинающиеся со "Дата:", не найдены. Поиск дополнительных строк...');
                let additionalLines = [];
                let index = lines.length - 21;
                while (additionalLines.length < 20 && index >= 0) {
                    if (lines[index].startsWith('Дата:')) {
                        additionalLines.push(lines[index]);
                    }
                    additionalLines.push(lines[index]);
                    index--;
                }
                const results = additionalLines.slice(-20).reverse();
                console.log('Возвращение данных: ', results.join('\n'));
                return results.join('\n');
            }
            console.log('Возвращение последних 20 строк...');
            return last20Lines.join('\n');
        }
        catch (error) {
            console.error('Ошибка при получении статистики: ', error);
            return 'Произошла ошибка при получении статистики.';
        }
    });
}
bot.onText(/\/statistic/, (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const chatId = msg.chat.id;
    console.log(`Запрос статистики от пользователя ${chatId}...`);
    const statistics = yield getStatistics();
    if (statistics.trim() === '') {
        console.log('Статистика пустая. Ничего не отправляем.');
        yield bot.sendMessage(chatId, 'Нет данных для отображения статистики.');
    }
    else {
        yield bot.sendMessage(chatId, statistics);
        console.log(`Статистика отправлена пользователю ${chatId}`);
    }
}));
// Добавление кнопки getfile
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
bot.onText(/\/getfile/, (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const chatId = msg.chat.id;
    console.log('Получена команда /getfile');
    const filePath = path.join(__dirname, 'logs_archive.txt');
    console.log('Проверяем существование файла:', filePath);
    if (fs.existsSync(filePath)) {
        console.log('Файл найден, начинаем отправку...');
        try {
            yield bot.sendDocument(chatId, fs.createReadStream(filePath));
            console.log('Файл успешно отправлен');
        }
        catch (err) {
            console.error('Ошибка при отправке файла:', err);
        }
    }
    else {
        console.log('Файл не найден, отправляем сообщение об этом.');
        try {
            yield bot.sendMessage(chatId, 'Файл не найден.');
        }
        catch (err) {
            console.error('Ошибка при отправке сообщения:', err);
        }
    }
}));
// Запуск бота
bot.on('polling_error', (error) => {
    console.log(error); // Вывод ошибок
});
