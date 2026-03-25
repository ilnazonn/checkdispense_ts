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
import { appendErrorLog } from './errorsLog.js';
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
            const token = yield getAuthToken();
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
                const tsRu = new Date().toLocaleString('ru-RU');
                const msg = `Error ${response.status}: ${JSON.stringify(data)}`;
                currentLog.errorDetails.push({ timestamp: tsRu, message: msg });
                if (currentLog.errorDetails.length > 50)
                    currentLog.errorDetails.shift();
                yield appendErrorLog({
                    ts: new Date(),
                    date: newDate,
                    source: 'telemetron_dispense',
                    httpStatus: response.status,
                    responseTimeS: responseTime,
                    message: msg,
                });
            }
            currentLog.successPercentage = (currentLog.successfulRequests / currentLog.totalRequests) * 100;
            currentLog.averageResponseTime = ((currentLog.averageResponseTime * (currentLog.totalRequests - 1)) + responseTime) / currentLog.totalRequests;
            return { response, responseTime, data }; // Возвращаем также данные
        }
        catch (error) {
            const endTime = performance.now();
            responseTime = (endTime - startTime) / 1000;
            currentLog.totalRequests += 1;
            currentLog.failedRequests += 1;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const tsRu = new Date().toLocaleString('ru-RU');
            currentLog.errorDetails.push({ timestamp: tsRu, message: errorMessage });
            if (currentLog.errorDetails.length > 50)
                currentLog.errorDetails.shift();
            yield appendErrorLog({
                ts: new Date(),
                date: newDate,
                source: 'telemetron_dispense',
                httpStatus: 500,
                responseTimeS: responseTime,
                message: errorMessage,
            });
            // Возвращаем синтетический ответ 500, чтобы сработала логика уведомлений
            const syntheticData = { error: errorMessage };
            const syntheticResponse = new Response(JSON.stringify(syntheticData), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
            return { response: syntheticResponse, responseTime, data: syntheticData };
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
        const previousErrorCode = lastErrorCode;
        if (errorCode) {
            // Увеличиваем счетчик ошибок
            errorCount++;
            // Если код ошибки изменился (например, 500 -> 422) — уведомляем сразу
            if (previousErrorCode !== null && previousErrorCode !== errorCode) {
                const machineStatus = yield getMachineStatus();
                const message = `*Статус ошибки изменился* 🔄
Было:           ${previousErrorCode}
Стало:          ${errorCode}
Статус аппарата: ${machineStatus}
*Время ответа API:* \`${responseTime.toFixed(2)} секунд\`
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`;
                try {
                    yield bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
                    isErrorNotified = true; // остаёмся в состоянии известной проблемы
                    lastErrorCode = errorCode; // фиксируем новый код ошибки
                }
                catch (error) {
                    console.error('Ошибка при отправке уведомления об изменении статуса:', error);
                }
                return;
            }
            // Если возникла ошибка и уведомление еще не отправлено — порог срабатывания
            if (!isErrorNotified && errorCount === 2) {
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
                return;
            }
            // Обновляем последний виденный код ошибки, даже если уведомление не отправляли
            lastErrorCode = errorCode;
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
