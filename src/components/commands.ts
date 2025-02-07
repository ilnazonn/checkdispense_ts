import { bot } from './createBot.js';
import { getMachineStatus } from './machineStatus.js';
import {getAuthToken, getVendistaToken} from './auth.js';
import { sendResponse, handleError } from './sendMessage.js';
import axios from 'axios';
import { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
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
bot.onText(/\/check/, async (msg) => {
    const chatId = msg.chat.id;
    let status: string = 'Неизвестный статус';
    let responseTime: number;
    let startTime: number = 0; // Инициализируем переменную значением 0

    try {
        status = await getMachineStatus();
        const token = await getAuthToken();

        startTime = performance.now(); // Начинаем отсчет времени перед отправкой запроса

        const response = await axios.post(
            `https://api.telemetron.net/v2/vending_machines/${process.env.VM_ID}/dispense`,
            {
                number: "106",
                cup: "0",
                sugar: "0",
                discount: "0"
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const endTime = performance.now(); // Время после получения ответа
        responseTime = endTime - startTime; // Рассчитываем время отклика


        await sendResponse(chatId, status, response, responseTime);
    } catch (error) {
        const unknownError = error as AxiosError;

        // Если произошла ошибка, запоминаем время и обновляем ответ
        const endTime = performance.now(); // Обновляем время отклика
        responseTime = endTime - startTime; // Рассчитываем время отклика

//        console.error('Ошибка при выполнении запроса:', unknownError.message);
//        console.error('Статус аппарата перед ошибкой:', status);

        await handleError(chatId, unknownError, status, responseTime);
    }
});
// Функция для выполнения команды перезагрузки
async function sendRebootCommand(token: string): Promise<any> {
    try {
        const response = await axios.post(
            `https://api.vendista.ru:99/terminals/${process.env.VENDISTA_ID}/commands/?token=${token}`,
            {
                command_id: "2"
            },
            {
                headers: {
                    Authorization: `Bearer ${token}` // Используем Bearer токен для авторизации
                }
            }
        );

        return response.data;
    } catch (error: any) {
        throw new Error(`Ошибка выполнения команды перезагрузки: ${error.message}`);
    }
}

// Обработчик для команды /reboot
bot.onText(/\/reboot/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const vendistaToken = await getVendistaToken();
        const rebootResponse = await sendRebootCommand(vendistaToken);

        const markdownResponse = `
Команда перезагрузки отправлена успешно.
Ответ от API:
\`\`\`json
${JSON.stringify(rebootResponse, null, 2)}
\`\`\`
    `;

        await bot.sendMessage(chatId, markdownResponse, { parse_mode: 'Markdown' });
    } catch (error: any) {
        await bot.sendMessage(chatId, `Ошибка при отправке команды перезагрузки: ${error.message}`, { parse_mode: 'Markdown' });
    }
});
// Функция для отправки команды проверки апи вендисты на удаленную выдачу.
async function sendCheckApiCommand(token: string): Promise<any> {
    try {
        const response = await axios.post(
            `https://api.vendista.ru:99/terminals/${process.env.VENDISTA_ID}/commands/?token=${token}`,
            {
                command_id: "40"
            },
            {
                headers: {
                    Authorization: `Bearer ${token}` // Используем Bearer токен для авторизации
                }
            }
        );

        return response.data;
    } catch (error: any) {
        throw new Error(`Ошибка выполнения команды проверки API: ${error.message}`);
    }
}

// Обработчик для команды /apivendistachk
bot.onText(/\/apivendistachk/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const vendistaToken = await getVendistaToken();
        const checkApiResponse = await sendCheckApiCommand(vendistaToken);

        const markdownResponse = `
Команда проверки API отправлена успешно.
Ответ от API:
\`\`\`json
${JSON.stringify(checkApiResponse, null, 2)}
\`\`\`
    `;

        await bot.sendMessage(chatId, markdownResponse, { parse_mode: 'Markdown' });
    } catch (error: any) {
        await bot.sendMessage(chatId, `Ошибка при отправке команды проверки API: ${error.message}`, { parse_mode: 'Markdown' });
    }
});

//Добавление команды Statistic
async function getStatistics(): Promise<string> {
    try {
        const data = await fs.promises.readFile('../check_dispense/reports/api_log.txt', 'utf-8');
        const lines = data.split('\n').filter(line => line.trim() !== ''); // Очищаем пустые строки

        // Возвращаем первые 20 строк, объединенные в одну строку
        return lines.slice(0, 20).join('\n'); // Убрали промежуточную переменную
    } catch (error) {
        return 'Произошла ошибка при получении статистики.';
    }
}



bot.onText(/\/statistic/, async (msg) => {
    const chatId = msg.chat.id;
//    console.log(`Запрос статистики от пользователя ${chatId}...`);

    const statistics = await getStatistics();

    if (statistics.trim() === '') {
//        console.log('Статистика пустая. Ничего не отправляем.');
        await bot.sendMessage(chatId, 'Нет данных для отображения статистики.');
    } else {
        await bot.sendMessage(chatId, statistics);
//        console.log(`Статистика отправлена пользователю ${chatId}`);
    }
});

// Добавление кнопки getfile
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
bot.onText(/\/getfile/, async (msg) => {
    const chatId = msg.chat.id;
//    console.log('Получена команда /getfile');
    const filePath = path.join(__dirname, '../../reports/logs_archive.txt');

//    console.log('Проверяем существование файла:', filePath);

    if (fs.existsSync(filePath)) {
//        console.log('Файл найден, начинаем отправку...');
        try {
            await bot.sendDocument(chatId, fs.createReadStream(filePath));
//            console.log('Файл успешно отправлен');
        } catch (err) {
            console.error('Ошибка при отправке файла:', err);
        }
    } else {
//        console.log('Файл не найден, отправляем сообщение об этом.');
        try {
            await bot.sendMessage(chatId, 'Файл не найден.');

        } catch (err) {
            console.error('Ошибка при отправке сообщения:', err);
        }
    }
});
//Перезапуск процесса в pm2
bot.onText(/\/restart/, async (msg) => {
    const chatId = msg.chat.id;

    // Отправка сообщения о начале перезапуска
    await bot.sendMessage(chatId, "Перезагрузка выполнена.");

    // Выполнение команды pm2 для перезапуска процесса
    exec('pm2 restart check_dispense', (error: any) => {
        if (error) {
            console.error(`Ошибка при перезапуске: ${error.message}`);
            // Отправка сообщения об ошибке, если возникает
            bot.sendMessage(chatId, `Ошибка при перезапуске: ${error.message}`);
            return;
        }
    });
});
// Обработка нажатия кнопки "Статус"
bot.onText(/status/, (msg) => {
    const chatId = msg.chat.id;

    exec('pm2 describe check_dispense', (error: any, stdout: any, stderr: any) => {
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

export {sendRebootCommand};