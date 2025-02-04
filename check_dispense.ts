import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import { AxiosError } from 'axios';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import zlib from 'zlib';

// Загрузить переменные окружения из файла .env
dotenv.config();

// Определение интерфейса для конфигурационных параметров
interface Config {
  TELEGRAM_TOKEN: string;
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  USERNME: string;
  PASSWORD: string;
  BASE_URL: string;
  TELEGRAM_CHAT_ID: string;
}

// Убедитесь, что все необходимые переменные окружения определены
const config: Config = {
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN!,
    CLIENT_ID: process.env.CLIENT_ID!,
    CLIENT_SECRET: process.env.CLIENT_SECRET!,
    USERNME: process.env.USERNME!,
    PASSWORD: process.env.PASSWORD!,
    BASE_URL: process.env.BASE_URL!,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID!

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

// Функция для получения авторизационного токена
async function getAuthToken(): Promise<string> {
  try {
    const response = await axios.post('https://api.telemetron.net/auth/', {
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
  } catch (error: any) {
    const errorMessage = `Ошибка авторизации: ${error.response?.data?.error_description || error.message}`;
    console.error(errorMessage);

    // Добавляем отладочные сообщения
    console.error('Response data:', error.response);
    console.error('Response status:', error.response?.status);

    // Проверяем на ошибки, требующие перезагрузки
    if (
        error.message.includes('Client network socket disconnected') ||
        error.message.includes('ECONNRESET')
    ) {
      exec('pm2 restart check_dispense', (execError: any) => {
        if (execError) {
          console.error(`Ошибка при перезапуске: ${execError.message}`);
          // Отправка сообщения об ошибке, если возникает
          bot.sendMessage(config.TELEGRAM_CHAT_ID, `Ошибка при перезапуске: ${execError.message}`);
          return;
        }

        console.log('Процесс успешно перезапущен.');
      });
    }

    throw new Error(errorMessage);
  }
}


// Функция для получения статуса аппарата
async function getMachineStatus(): Promise<string> {
  try {
    const response = await axios.get(`https://api.telemetron.net/v2/vending_machines/${process.env.VM_ID}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`
      }
    });

    const state: number | null = response.data.state;

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
  } catch (error: any) {
    return `Ошибка получения статуса: ${error.message}`;
  }
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

    console.error('Ошибка при выполнении запроса:', unknownError.message);
    console.error('Статус аппарата перед ошибкой:', status);

    await handleError(chatId, unknownError, status, responseTime);
  }
});


async function sendResponse(chatId: number, status: string, response: any, responseTime: number) {
  const markdownResponse = `
*Статус аппарата*: \`${status}\`
*Статус код*: \`${response.status}\`
*Время ответа API*: \`${responseTime.toFixed(2)} мс\`
*Ответ от API*:
\`\`\`json
${JSON.stringify(response.data, null, 2)}
\`\`\`
  `;
  await bot.sendMessage(chatId, markdownResponse, { parse_mode: 'Markdown' });
}

async function handleError(chatId: number, error: AxiosError, status: string, responseTime: number) {
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
  } else if (error.request) {
    errorMessage = `Ошибка: запрос был сделан, но ответа не получено\n*Время ответа API*: \`${responseTime.toFixed(2)} мс\`\n*Статус аппарата*: \`${status}\``;
  }

  await bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
}


// Функция для получения токена от Vendista
async function getVendistaToken(): Promise<string> {
  try {
    const response = await axios.get(`https://api.vendista.ru:99/token?login=${process.env.VENDISTA_LOGIN}&password=${process.env.VENDISTA_PASSWORD}`);
    return response.data.token;
  } catch (error: any) {
    throw new Error(`Ошибка получения токена Vendista: ${error.message}`);
  }
}

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

// Обработка ошибок авторизации
process.on('uncaughtException', (err) => {
  if (err.message.includes('Ошибка авторизации: connect ETIMEDOUT')) {
    console.error('Произошла ошибка авторизации. Приложение будет перезапущено PM2...');
    process.exit(1); // Завершаем процесс с кодом 1 для указания ошибки
  }
});

// Запуск проверки удаленной выдачи
interface LogEntry {
  date: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successPercentage: number;
  averageResponseTime: number;
  errorDetails: Array<{ timestamp: string; message: string }>;
}

const logs: LogEntry[] = [];
let currentLog: LogEntry | null = null;

async function sendRequest(): Promise<{ response: Response | null; responseTime: number; data: any }> {
  let response: Response | null = null;
  let responseTime: number;
  const body = JSON.stringify({
    number: "106",
    cup: "0",
    sugar: "0",
    discount: "0"
  });
  const token = await getAuthToken();
  const startTime = performance.now();
  const newDate = new Date().toISOString().split('T')[0];

// Проверка на смену даты
  if (!currentLog || currentLog.date !== newDate) {
    // Архивируем старые логи
    await archiveOldLogs(currentLog); // Убедитесь, что это действие происходит до переинициализации currentLog

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
    response = await fetch(`https://api.telemetron.net/v2/vending_machines/${process.env.VM_ID}/dispense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body
    });
    const endTime = performance.now();
    responseTime = endTime - startTime;
    const data = await response.json(); // Получение данных

    currentLog.totalRequests += 1;
    if (response.ok) {
      currentLog.successfulRequests += 1;
    } else {
      currentLog.failedRequests += 1;
      currentLog.errorDetails.push({ timestamp: new Date().toISOString(), message: `Error ${response.status}: ${JSON.stringify(data)}` });
    }

    currentLog.successPercentage = (currentLog.successfulRequests / currentLog.totalRequests) * 100;
    currentLog.averageResponseTime = ((currentLog.averageResponseTime * (currentLog.totalRequests - 1)) + responseTime) / currentLog.totalRequests;

    return { response, responseTime, data }; // Возвращаем также данные
  } catch (error) {
    responseTime = performance.now() - startTime;
    currentLog.totalRequests += 1;
    currentLog.failedRequests += 1;
    currentLog.errorDetails.push({ timestamp: new Date().toISOString(), message: error instanceof Error ? error.message : 'Unknown error' });
    return { response: null, responseTime, data: null }; // Возвращаем null для данных
  }
}


let isErrorNotified = false; // Переменная для отслеживания состояния уведомления об ошибке
let lastErrorCode: number | null = null; // Переменная для хранения последнего кода ошибки
let errorCount = 0;
async function handleResponse(response: Response, responseTime: number, data: any): Promise<void> {
  const errorCode = response.ok ? null : response.status; // Устанавливаем код ошибки, если есть ошибка

  if (errorCode) {
    // Увеличиваем счетчик ошибок
    errorCount++;
    console.log('Счетчик ошибок сейчас', errorCount);
    // Если возникла ошибка и уведомление еще не отправлено
    if ((!isErrorNotified || lastErrorCode !== errorCode) && errorCount === 2) {
      const machineStatus = await getMachineStatus();
      const message =
          `*Ошибка! ⛔️ 
Статус аппарата:  ${machineStatus}
Статус код:       ${errorCode}
Время ответа API:* \`${responseTime.toFixed(2)} мс\`
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`;
      try {
        await bot.sendMessage(process.env.TELEGRAM_CHAT_ID!, message, { parse_mode: 'Markdown' });
        console.log('Уведомление об ошибке отправлено успешно.');
        console.log('Счетчик ошибок сейчас', errorCount);
        isErrorNotified = true; // Устанавливаем флаг, что уведомление об ошибке отправлено
        lastErrorCode = errorCode; // Сохраняем код ошибки
      } catch (error) {
        console.error('Ошибка при отправке уведомления об ошибке:', error);
      }
    }
  } else {
    // Сбрасываем счетчик ошибок при успешном запросе
    errorCount = 0;
    console.log('Счетчик ошибок сейчас', errorCount);
    // Если запрос завершился успешно и ошибка была ранее зафиксирована
    if (isErrorNotified) {
      const resolvedMessage = `
*Проблема решена!*        ✅
*Запрос завершился успешно.*
*Время ответа API:*       \`${responseTime.toFixed(2)} мс\`
      `;

      try {
        await bot.sendMessage(process.env.TELEGRAM_CHAT_ID!, resolvedMessage, { parse_mode: 'Markdown' });
        console.log('Уведомление о решении проблемы отправлено успешно.');
        isErrorNotified = false; // Сбрасываем флаг, так как проблема решена
        lastErrorCode = null; // Сбрасываем код ошибки
      } catch (error) {
        console.error('Ошибка при отправке уведомления о решении проблемы:', error);
      }
    }
  }
}

// Функция для запуска периодического выполнения запроса
async function startInterval(): Promise<void> {
  // Проверяем и архивируем существующие логи перед запуском
  await checkAndArchiveExistingLogs();

  setInterval(async () => {
    const { response, responseTime, data } = await sendRequest(); // Получаем данные

    if (response) {
      await handleResponse(response, responseTime, data); // Передаем данные
    }
    await saveLogsToFile();
    archiveLogIfNeeded(statsFilePath);
  }, 60 * 1000);
}

startInterval().catch(error => {
  console.error('Error starting interval:', error);
});

// Архивирование логов
const MAX_FILE_SIZE = 500 * 1024; // 5 КБ в байтах
const statsFilePath = 'logs_archive.txt';

function archiveLogIfNeeded(filePath: string) {
  // Проверяем, существует ли файл
  if (!fs.existsSync(filePath)) {
    console.error(`Файл ${filePath} не существует.`);
    return;
  }

  try {
    const fileStats = fs.statSync(filePath);

    if (fileStats.size > MAX_FILE_SIZE) {
      const gzip = zlib.createGzip();
      const source = fs.createReadStream(filePath);
      const currentDate = new Date().toISOString().split('T')[0]; // Пример формирования текущей даты

      // Архивируем с добавлением текущей даты в имя архива
      const archiveFilePath = `statistics_${currentDate.replace(/\./g, '-')}.csv.gz`;
      const destination = fs.createWriteStream(archiveFilePath);

      // Обработка ошибок при чтении исходного файла
      source.on('error', (err) => {
        console.error('Ошибка при чтении файла:', err);
      });

      // Обработка ошибок при записи в архив
      destination.on('error', (err) => {
        console.error('Ошибка при записи архива:', err);
      });

      // Архивируем файл
      source.pipe(gzip).pipe(destination);

      // Удаляем оригинальный файл после успешного архивирования
      destination.on('finish', () => {
        console.log(`Файл успешно архивирован: ${archiveFilePath}`);
        fs.unlinkSync(filePath);
        console.log(`Оригинальный файл удален: ${filePath}`);

        // Создаем файл logs_archive.txt
        const logArchiveFilePath = 'logs_archive.txt';
        fs.writeFileSync(logArchiveFilePath, `Файл успешно архивирован: ${archiveFilePath}\n`, { flag: 'a' });
        console.log(`Создан файл: ${logArchiveFilePath}`);
      });
    } else {
      console.log('Размер файла не превышает лимит, архивация не требуется.');
    }
  } catch (err) {
    console.error('Ошибка при обработке файла:', err);
  }
}


//Добавление команды Statistic
async function getStatistics(): Promise<string> {
  try {
    console.log('Чтение файла api_log.txt...');
    const data = await fs.promises.readFile('api_log.txt', 'utf-8');
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
  } catch (error) {
    console.error('Ошибка при получении статистики: ', error);
    return 'Произошла ошибка при получении статистики.';
  }
}

bot.onText(/\/statistic/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`Запрос статистики от пользователя ${chatId}...`);

  const statistics = await getStatistics();

  if (statistics.trim() === '') {
    console.log('Статистика пустая. Ничего не отправляем.');
    await bot.sendMessage(chatId, 'Нет данных для отображения статистики.');
  } else {
    await bot.sendMessage(chatId, statistics);
    console.log(`Статистика отправлена пользователю ${chatId}`);
  }
});

// Добавление кнопки getfile
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
bot.onText(/\/getfile/, async (msg) => {
  const chatId = msg.chat.id;
  console.log('Получена команда /getfile');
  const filePath = path.join(__dirname, 'logs_archive.txt');

  console.log('Проверяем существование файла:', filePath);

  if (fs.existsSync(filePath)) {
    console.log('Файл найден, начинаем отправку...');
    try {
      await bot.sendDocument(chatId, fs.createReadStream(filePath));
      console.log('Файл успешно отправлен');
    } catch (err) {
      console.error('Ошибка при отправке файла:', err);
    }
  } else {
    console.log('Файл не найден, отправляем сообщение об этом.');
    try {
      await bot.sendMessage(chatId, 'Файл не найден.');

    } catch (err) {
      console.error('Ошибка при отправке сообщения:', err);
    }
  }
});
// Функция для архивирования старых логов
async function archiveOldLogs(log: LogEntry | null): Promise<void> {
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
        await fs.promises.writeFile(filePath, logContent);
      } else {
        await fs.promises.appendFile(filePath, logContent);
      }
    } catch (error) {
      console.error('Ошибка при архивировании логов:', error);
    }
  } else {
    console.error('Лог для архивирования не определен или равен null.');
  }
}
// Функция для записи логов в файл
async function saveLogsToFile(): Promise<void> {
  if (currentLog) logs.push(currentLog);

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

  await fs.promises.writeFile('api_log.txt', logContent);
}

// Функция для проверки и архивирования существующих логов перед запуском
async function checkAndArchiveExistingLogs(): Promise<void> {
  if (fs.existsSync('api_log.txt')) {
    const data = await fs.promises.readFile('api_log.txt', 'utf-8');
    // Парсинг и сохранение в архив
    const oldLog: LogEntry = parseLog(data);
    await archiveOldLogs(oldLog);
    // Очищаем файл логов
    await fs.promises.writeFile('api_log.txt', '');
  }
}

// Парсинг логов из строки
function parseLog(logData: string): LogEntry {
  const lines = logData.split('\n').filter(line => line.trim() !== '');
  const logEntry: Partial<LogEntry> = {};

  for (const line of lines) {
    if (line.startsWith('Дата:')) {
      logEntry.date = line.split(': ')[1];
    } else if (line.startsWith('Всего запросов:')) {
      logEntry.totalRequests = parseInt(line.split(': ')[1]);
    } else if (line.startsWith('Успешных:')) {
      logEntry.successfulRequests = parseInt(line.split(': ')[1]);
    } else if (line.startsWith('Не успешных:')) {
      logEntry.failedRequests = parseInt(line.split(': ')[1]);
    } else if (line.startsWith('Процент успешных:')) {
      logEntry.successPercentage = parseFloat(line.split(': ')[1]);
    } else if (line.startsWith('Среднее время ответа API:')) {
      logEntry.averageResponseTime = parseFloat(line.split(': ')[1]);
    } else if (line.startsWith('Ошибки:')) {
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

  return logEntry as LogEntry;
}
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

  exec('pm2 status check_dispense', (error: any, stdout: any, stderr: any) => {
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
    const formattedOutput = `Статус приложения:\n\`\`\`\n${stdout}\n\`\`\``;
    bot.sendMessage(chatId, formattedOutput, { parse_mode: 'Markdown' })
        .catch(err => console.error(`Ошибка при отправке сообщения: ${err.message}`));
  });
});

// Запуск бота
bot.on('polling_error', (error) => {
  console.log(error);  // Вывод ошибок
});




