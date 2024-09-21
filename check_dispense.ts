import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import dotenv from 'dotenv';

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
console.log('TELEGRAM_TOKEN:', config.CLIENT_ID);
console.log('TELEGRAM_TOKEN:', config.CLIENT_SECRET);
console.log('TELEGRAM_TOKEN:', config.USERNME);
console.log('TELEGRAM_TOKEN:', config.PASSWORD);
console.log('TELEGRAM_TOKEN:', config.BASE_URL);
console.log('TELEGRAM_TOKEN:', config.TELEGRAM_CHAT_ID);
console.log('TELEGRAM_TOKEN:', config.BASE_URL);

// Создание экземпляра бота
const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });


// Функция для получения авторизационного токена
async function getAuthToken(): Promise<string> {
  try {
    const response = await axios.post(`https://api.telemetron.net/auth/`, {
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
    throw new Error(`Ошибка авторизации: ${error.response?.data?.error_description || error.message}`);
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

  try {
    const token = await getAuthToken();
    const status = await getMachineStatus();

    const response = await axios.post(`https://api.telemetron.net/v2/vending_machines/${process.env.VM_ID}/dispense`, {
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

    const markdownResponse = `
*Статус аппарата*: \`${status}\`
*Статус код*: \`${response.status}\`
*Ответ от API*:
\`\`\`json
${JSON.stringify(response.data, null, 2)}
\`\`\`
    `;

    await bot.sendMessage(chatId, markdownResponse, { parse_mode: 'Markdown' });
  } catch (error: any) {
    const status = await getMachineStatus();
    if (error.response) {
      const markdownErrorResponse = `
*Статус аппарата*: \`${status}\`
*Статус код*: \`${error.response.status}\`
*Ответ от API*:
\`\`\`json
${JSON.stringify(error.response.data, null, 2)}
\`\`\`
      `;
      await bot.sendMessage(chatId, markdownErrorResponse, { parse_mode: 'Markdown' });
    } else if (error.request) {
      await bot.sendMessage(chatId, `Ошибка: запрос был сделан, но ответа не получено\n*Статус аппарата*: \`${status}\``, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, `Ошибка. ${error.message}\n*Статус аппарата*: \`${status}\``, { parse_mode: 'Markdown' });
    }
  }
});



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

// Запуск проверки удаленной выдачи
async function sendRequest(): Promise<Response | void> {
  try {
    const token = await getAuthToken();

    return await fetch(`https://api.telemetron.net/v2/vending_machines/${process.env.VM_ID}/dispense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        number: "106",
        cup: "0",
        sugar: "0",
        discount: "0"
      })
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Ошибка выполнения запроса: ${error.message}`);
    } else {
      console.error(`Неизвестная ошибка: ${error}`);
    }
  }
}

// Обработка ответа
async function handleResponse(response: Response): Promise<void> {
  let data;
  try {
    data = await response.json();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Ошибка при обработке ответа: ${error.message}`);
    } else {
      console.error(`Неизвестная ошибка: ${error}`);
    }
    return; // Если произошла ошибка, выходим из функции
  }

  // Отправка уведомления в Telegram, если статус не равен 200
  if (response.status !== 200) {
    const status: string = await getMachineStatus(); // Предположим, что getMachineStatus() возвращает Promise<string>

    const message = `
*Статус аппарата*: \`${status}\`
*Запрос завершился ошибкой*: ${response.status}
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
    `;

    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID!, message, { parse_mode: 'Markdown' });
  }
}

// Функция для запуска периодического выполнения запроса
function startInterval(): void {
  setInterval(async () => {
    const response = await sendRequest();
    if(response) {
      await handleResponse(response);
    }
  }, 2 * 60 * 1000);
}

// Запускаем интервал
startInterval();

// Запуск бота
bot.on('polling_error', (error) => {
  console.log(error);  // Вывод ошибок
});



