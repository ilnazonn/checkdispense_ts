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
function getStatistics() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dataPath = path.join(__dirname, '../../reports/api_log.txt');
            const data = readFileSync(dataPath, 'utf-8');
            const lines = data.split('\n').filter(line => line.trim() !== ''); // Очищаем пустые строки
            // Возвращаем первые 20 строк, объединенные в одну строку
            return lines.slice(0, 20).join('\n'); // Убрали промежуточную переменную
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
    const filePath = path.join(__dirname, '../../reports/logs_archive.txt');
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
    const filePath = path.join(__dirname, '../../reports/api_log.txt');
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
            console.error(`Ошибка получения статуса: ${error.message}`);
            bot.sendMessage(chatId, `Ошибка при получении статуса: ${error.message}`)
                .catch(err => console.error(`Ошибка при отправке сообщения: ${err.message}`));
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
