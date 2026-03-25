var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { bot } from './createBot.js';
import { getMachineStatus } from './machineStatus.js';
import { getAuthToken, getVendistaToken } from './auth.js';
import { sendResponse, handleError } from './sendMessage.js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { readFileSync } from "fs";
bot.onText(/\/help/, (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const chatId = msg.chat.id;
    const helpText = `Доступные команды:\n\n` +
        `/start — приветствие\n` +
        `/help — справка по командам\n` +
        `/check — ручная проверка выдачи (Telemetron)\n` +
        `/reboot — отправить команду перезагрузки терминала (Vendista)\n` +
        `/apivendistachk — проверить API Vendista (command_id=40)\n` +
        `/statistic — показать первые строки сводки (reports/api_log.csv)\n` +
        `/getstatisticfile — скачать сводку (reports/api_log.csv)\n` +
        `/getfile — скачать архив сводок (reports/logs_archive.csv)\n` +
        `/geterrorsfile — скачать лог ошибок (reports/errors.csv)\n` +
        `/restart — перезапуск процесса через pm2 (pm2 restart check_dispense)\n` +
        `status — статус процесса через pm2 (pm2 describe check_dispense / fallback)\n` +
        `/changeterminal — изменить VENDISTA_ID в .env\n`;
    yield bot.sendMessage(chatId, helpText);
}));
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
        responseTime = (endTime - startTime) / 1000;
        yield sendResponse(chatId, status, response, responseTime);
    }
    catch (error) {
        const unknownError = error;
        // Если произошла ошибка, запоминаем время и обновляем ответ
        const endTime = performance.now(); // Обновляем время отклика
        responseTime = (endTime - startTime) / 1000; // Рассчитываем время отклика
        //        console.error('Ошибка при выполнении запроса:', unknownError.message);
        //        console.error('Статус аппарата перед ошибкой:', status);
        yield handleError(chatId, unknownError, status, responseTime);
    }
}));
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
//Добавление команды Statistic
function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                const next = line[i + 1];
                if (next === '"') {
                    cur += '"';
                    i++;
                }
                else {
                    inQuotes = false;
                }
            }
            else {
                cur += ch;
            }
        }
        else {
            if (ch === ',') {
                out.push(cur);
                cur = '';
            }
            else if (ch === '"') {
                inQuotes = true;
            }
            else {
                cur += ch;
            }
        }
    }
    out.push(cur);
    return out;
}
function getStatistics() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            const dataPath = path.join(__dirname, '../../reports/api_log.csv');
            const data = readFileSync(dataPath, 'utf-8');
            const lines = data.split('\n').map(l => l.trim()).filter(Boolean);
            const lastLine = lines.length ? lines[lines.length - 1] : '';
            if (!lastLine || lastLine.startsWith('Дата,'))
                return '';
            // CSV: Дата,Всего запросов,Успешных,Не успешных,Процент успешных,Среднее время ответа,Ошибки
            const cols = parseCsvLine(lastLine);
            const rawDate = (_a = cols[0]) !== null && _a !== void 0 ? _a : '';
            const date = (() => {
                const m = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                return m ? `${m[3]}.${m[2]}.${m[1]}` : rawDate;
            })();
            const total = (_b = cols[1]) !== null && _b !== void 0 ? _b : '';
            const success = (_c = cols[2]) !== null && _c !== void 0 ? _c : '';
            const failed = (_d = cols[3]) !== null && _d !== void 0 ? _d : '';
            const pct = (_e = cols[4]) !== null && _e !== void 0 ? _e : '';
            const avg = (_f = cols[5]) !== null && _f !== void 0 ? _f : '';
            const errors = (_g = cols[6]) !== null && _g !== void 0 ? _g : '';
            return (`Дата: ${date}\n` +
                `Всего запросов: ${total}\n` +
                `Успешных: ${success}\n` +
                `Не успешных: ${failed}\n` +
                `Процент успешных: ${pct}%\n` +
                `Среднее время ответа API: ${avg} секунд\n` +
                `Ошибки: ${errors}`);
        }
        catch (error) {
            return 'Произошла ошибка при получении статистики.';
        }
    });
}
bot.onText(/\/statistic/, (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const chatId = msg.chat.id;
    //    console.log(`Запрос статистики от пользователя ${chatId}...`);
    const statistics = yield getStatistics();
    if (statistics.trim() === '') {
        //        console.log('Статистика пустая. Ничего не отправляем.');
        yield bot.sendMessage(chatId, 'Нет данных для отображения статистики.');
    }
    else {
        yield bot.sendMessage(chatId, statistics);
        //        console.log(`Статистика отправлена пользователю ${chatId}`);
    }
}));
// Добавление кнопки getfile
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
bot.onText(/\/getfile/, (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const chatId = msg.chat.id;
    //    console.log('Получена команда /getfile');
    const filePath = path.join(__dirname, '../../reports/logs_archive.csv');
    //    console.log('Проверяем существование файла:', filePath);
    if (fs.existsSync(filePath)) {
        //        console.log('Файл найден, начинаем отправку...');
        try {
            yield bot.sendDocument(chatId, fs.createReadStream(filePath));
            //            console.log('Файл успешно отправлен');
        }
        catch (err) {
            console.error('Ошибка при отправке файла:', err);
        }
    }
    else {
        //        console.log('Файл не найден, отправляем сообщение об этом.');
        try {
            yield bot.sendMessage(chatId, 'Файл не найден.');
        }
        catch (err) {
            console.error('Ошибка при отправке сообщения:', err);
        }
    }
}));
// Добавление кнопки getfile
bot.onText(/\/getstatisticfile/, (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const chatId = msg.chat.id;
    //    console.log('Получена команда /getstatisticfilefile');
    const filePath = path.join(__dirname, '../../reports/api_log.csv');
    //    console.log('Проверяем существование файла:', filePath);
    if (fs.existsSync(filePath)) {
        //        console.log('Файл найден, начинаем отправку...');
        try {
            yield bot.sendDocument(chatId, fs.createReadStream(filePath));
            //            console.log('Файл успешно отправлен');
        }
        catch (err) {
            console.error('Ошибка при отправке файла:', err);
        }
    }
    else {
        //        console.log('Файл не найден, отправляем сообщение об этом.');
        try {
            yield bot.sendMessage(chatId, 'Файл не найден.');
        }
        catch (err) {
            console.error('Ошибка при отправке сообщения:', err);
        }
    }
}));
// Отправка файла с ошибками (CSV)
bot.onText(/\/geterrorsfile/, (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const chatId = msg.chat.id;
    const filePath = path.join(__dirname, '../../reports/errors.csv');
    if (fs.existsSync(filePath)) {
        try {
            yield bot.sendDocument(chatId, fs.createReadStream(filePath));
        }
        catch (err) {
            console.error('Ошибка при отправке файла ошибок:', err);
        }
    }
    else {
        try {
            yield bot.sendMessage(chatId, 'Файл ошибок не найден.');
        }
        catch (err) {
            console.error('Ошибка при отправке сообщения:', err);
        }
    }
}));
//Перезапуск процесса в pm2
bot.onText(/\/restart/, (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const chatId = msg.chat.id;
    // Отправка сообщения о начале перезапуска
    yield bot.sendMessage(chatId, "Перезагрузка выполнена.");
    // Выполнение команды pm2 для перезапуска процесса
    exec('pm2 restart check_dispense', (error) => {
        if (error) {
            console.error(`Ошибка при перезапуске: ${error.message}`);
            // Отправка сообщения об ошибке, если возникает
            bot.sendMessage(chatId, `Ошибка при перезапуске: ${error.message}`);
            return;
        }
    });
}));
// Обработка нажатия кнопки "Статус"
bot.onText(/status/, (msg) => {
    const chatId = msg.chat.id;
    exec('pm2 describe check_dispense', (error, stdout, stderr) => {
        if (error) {
            // Обходной путь: в некоторых версиях pm2 + новых Node `pm2 describe`
            // падает при форматировании env (ожидают string, получают другой тип).
            exec('pm2 jlist', (jErr, jStdout, jStderr) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                if (jErr || jStderr) {
                    const msgText = `Ошибка при получении статуса: ${error.message}`;
                    console.error(msgText);
                    bot.sendMessage(chatId, msgText)
                        .catch(err => console.error(`Ошибка при отправке сообщения: ${err.message}`));
                    return;
                }
                try {
                    const list = JSON.parse(String(jStdout));
                    const proc = list.find(p => (p === null || p === void 0 ? void 0 : p.name) === 'check_dispense');
                    if (!proc) {
                        bot.sendMessage(chatId, 'Процесс check_dispense не найден в PM2.')
                            .catch(err => console.error(`Ошибка при отправке сообщения: ${err.message}`));
                        return;
                    }
                    const status = (_b = (_a = proc === null || proc === void 0 ? void 0 : proc.pm2_env) === null || _a === void 0 ? void 0 : _a.status) !== null && _b !== void 0 ? _b : 'unknown';
                    const restarts = (_d = (_c = proc === null || proc === void 0 ? void 0 : proc.pm2_env) === null || _c === void 0 ? void 0 : _c.restart_time) !== null && _d !== void 0 ? _d : 'unknown';
                    const uptimeMs = ((_e = proc === null || proc === void 0 ? void 0 : proc.pm2_env) === null || _e === void 0 ? void 0 : _e.pm_uptime) ? (Date.now() - Number(proc.pm2_env.pm_uptime)) : null;
                    const uptimeMin = uptimeMs !== null && Number.isFinite(uptimeMs) ? Math.floor(uptimeMs / 60000) : null;
                    const memMb = ((_f = proc === null || proc === void 0 ? void 0 : proc.monit) === null || _f === void 0 ? void 0 : _f.memory) ? (Number(proc.monit.memory) / (1024 * 1024)).toFixed(1) : null;
                    const cpu = (_h = (_g = proc === null || proc === void 0 ? void 0 : proc.monit) === null || _g === void 0 ? void 0 : _g.cpu) !== null && _h !== void 0 ? _h : null;
                    const formattedOutput = `Статус приложения (PM2):\n` +
                        `\`\`\`\n` +
                        `name:      ${proc.name}\n` +
                        `status:    ${status}\n` +
                        `restarts:  ${restarts}\n` +
                        `uptime:    ${uptimeMin === null ? 'unknown' : `${uptimeMin} min`}\n` +
                        `cpu:       ${cpu === null ? 'unknown' : `${cpu}%`}\n` +
                        `memory:    ${memMb === null ? 'unknown' : `${memMb} MB`}\n` +
                        `\`\`\``;
                    bot.sendMessage(chatId, formattedOutput, { parse_mode: 'Markdown' })
                        .catch(err => console.error(`Ошибка при отправке сообщения: ${err.message}`));
                }
                catch (parseErr) {
                    const msgText = `Ошибка при разборе pm2 jlist: ${(_j = parseErr === null || parseErr === void 0 ? void 0 : parseErr.message) !== null && _j !== void 0 ? _j : String(parseErr)}`;
                    console.error(msgText);
                    bot.sendMessage(chatId, msgText)
                        .catch(err => console.error(`Ошибка при отправке сообщения: ${err.message}`));
                }
            });
            return;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            bot.sendMessage(chatId, `Ошибка: ${stderr}`)
                .catch(err => console.error(`Ошибка при отправке сообщения: ${err.message}`));
            return;
        }
        // Форматирование статуса приложения в markdown
        const formattedOutput = `Статус приложения:\n\`\`\`\n${stdout.trim()}\n\`\`\``;
        bot.sendMessage(chatId, formattedOutput, { parse_mode: 'Markdown' })
            .catch(err => console.error(`Ошибка при отправке сообщения: ${err.message}`));
    });
});
bot.onText(/\/changeterminal/, (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const chatId = msg.chat.id;
    // Отправляем первое сообщение
    yield bot.sendMessage(chatId, 'Пришлите номер вендисты для замены в файле env');
    // Ждем следующее сообщение от пользователя
    bot.once('message', (response) => __awaiter(void 0, void 0, void 0, function* () {
        const vendorId = response.text ? response.text.trim() : ''; // Убираем лишние пробелы
        if (!vendorId) {
            yield bot.sendMessage(chatId, 'Вы отправили пустое значение. Пожалуйста, попробуйте снова.');
            return;
        }
        // Обновляем только VENDISTA_ID в .env файле
        try {
            updateEnvFile('VENDISTA_ID', vendorId);
            yield bot.sendMessage(chatId, `VENDISTA_ID обновлен на ${vendorId} в файле env`);
        }
        catch (error) {
            yield bot.sendMessage(chatId, 'Произошла ошибка при обновлении файла env.');
            console.error('Ошибка при обновлении .env файла:', error);
        }
    }));
}));
function updateEnvFile(key, value) {
    const envFilePath = '.env';
    // Получаем текущее содержимое .env файла
    let envContent = fs.readFileSync(envFilePath, 'utf-8');
    // Разбиваем на строки
    const lines = envContent.split('\n');
    // Обрабатываем строки и обновляем значение
    let keyExists = false;
    const updatedLines = lines.map(line => {
        const [currentKey] = line.split('=').map(part => part.trim()); // Используем только currentKey
        if (currentKey === key) {
            keyExists = true;
            return `${key}=${value}`; // Обновляем значение
        }
        return line; // Оставляем остальные строки без изменений
    });
    // Если ключ не был найден, добавляем его в конец
    if (!keyExists) {
        updatedLines.push(`${key}=${value}`); // Добавляем новый ключ
    }
    // Записываем обновленный контент в .env файл
    fs.writeFileSync(envFilePath, updatedLines.join('\n'), 'utf-8');
}
export { sendRebootCommand };
