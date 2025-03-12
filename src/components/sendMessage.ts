import {bot} from "./createBot.js";
import {AxiosError} from "axios";

async function sendResponse(chatId: number, status: string, response: any, responseTime: number) {
    const markdownResponse = `
*Статус аппарата*: \`${status}\`
*Статус код*: \`${response.status}\`
*Время ответа API*: \`${responseTime.toFixed(2)} секунд\`
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
*Время ответа API*: \`${responseTime.toFixed(2)} секунд\`
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

export { sendResponse, handleError };