var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { bot } from "./createBot.js";
function sendResponse(chatId, status, response, responseTime) {
    return __awaiter(this, void 0, void 0, function* () {
        const markdownResponse = `
*Статус аппарата*: \`${status}\`
*Статус код*: \`${response.status}\`
*Время ответа API*: \`${responseTime.toFixed(2)} секунд\`
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
*Время ответа API*: \`${responseTime.toFixed(2)} секунд\`
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
export { sendResponse, handleError };
