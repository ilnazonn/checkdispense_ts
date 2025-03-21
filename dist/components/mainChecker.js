var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getAuthToken } from './auth.js';
import { bot } from "./createBot.js";
import { getMachineStatus } from './machineStatus.js';
import { archiveOldLogs } from './archive.js';
import { getMachineState } from './machineStatus.js';
import { sendRebootCommand } from './commands.js';
import { getVendistaToken } from './auth.js';
// Запуск проверки удаленной выдачи
export const logs = [];
export let currentLog = null;
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
            yield archiveOldLogs(currentLog); // Убедитесь, что это действие происходит до инициализации currentLog
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
            responseTime = (endTime - startTime) / 1000;
            const data = yield response.json(); // Получение данных
            currentLog.totalRequests += 1;
            if (response.ok) {
                currentLog.successfulRequests += 1;
            }
            else {
                currentLog.failedRequests += 1;
                currentLog.errorDetails.push({
                    timestamp: new Date().toLocaleString('ru-RU'), // Конвертируем время в Ru-Ru local
                    message: `Error ${response.status}: ${JSON.stringify(data)}`
                });
            }
            currentLog.successPercentage = (currentLog.successfulRequests / currentLog.totalRequests) * 100;
            currentLog.averageResponseTime = ((currentLog.averageResponseTime * (currentLog.totalRequests - 1)) + responseTime) / currentLog.totalRequests;
            return { response, responseTime, data }; // Возвращаем также данные
        }
        catch (error) {
            responseTime = performance.now() - startTime;
            currentLog.totalRequests += 1;
            currentLog.failedRequests += 1;
            currentLog.errorDetails.push({
                timestamp: new Date().toLocaleString('ru-RU'), // Конвертируем время в Ru-Ru local
                message: error instanceof Error ? error.message : 'Unknown error'
            });
            return { response: null, responseTime, data: null }; // Возвращаем null для данных
        }
    });
}
let isErrorNotified = false; // Переменная для отслеживания состояния уведомления об ошибке
let lastErrorCode = null; // Переменная для хранения последнего кода ошибки
let errorCount = 0;
let isRebootCommandSent = false;
function handleResponse(response, responseTime, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const errorCode = response.ok ? null : response.status; // Устанавливаем код ошибки, если есть ошибка
        if (errorCode) {
            // Увеличиваем счетчик ошибок
            errorCount++;
            // Если возникла ошибка и уведомление еще не отправлено
            if ((!isErrorNotified || lastErrorCode !== errorCode) && errorCount === 2) {
                const machineStatus = yield getMachineStatus();
                const machineState = yield getMachineState();
                const message = `*Ошибка! ⛔️ 
Статус аппарата:  ${machineStatus}
Статус код:       ${errorCode}
Время ответа API:* \`${responseTime.toFixed(2)} секунд\`
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`;
                try {
                    yield bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
                    isErrorNotified = true; // Устанавливаем флаг, что уведомление об ошибке отправлено
                    lastErrorCode = errorCode; // Сохраняем код ошибки
                    // проверяем статус машины и отправляем команду перезагрузки, если нужно
                    if ((machineState === 2 || machineState === 3) && !isRebootCommandSent) {
                        const vendistaToken = yield getVendistaToken();
                        yield sendRebootCommand(vendistaToken);
                        yield bot.sendMessage(process.env.TELEGRAM_CHAT_ID, 'На терминал отправлена команда перезагрузки.', { parse_mode: 'Markdown' });
                        isRebootCommandSent = true; // Устанавливаем флаг, что команда перезагрузки отправлена
                    }
                }
                catch (error) {
                    console.error('Ошибка при отправке уведомления об ошибке:', error);
                }
            }
        }
        else {
            // Сбрасываем счетчик ошибок при успешном запросе
            errorCount = 0;
            isRebootCommandSent = false;
            // Если запрос завершился успешно и ошибка была ранее зафиксирована
            if (isErrorNotified) {
                const resolvedMessage = `
*Проблема решена!*        ✅
*Запрос завершился успешно.*
*Время ответа API:*       \`${responseTime.toFixed(2)} секунд\`
      `;
                try {
                    yield bot.sendMessage(process.env.TELEGRAM_CHAT_ID, resolvedMessage, { parse_mode: 'Markdown' });
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
export { handleResponse, sendRequest };
