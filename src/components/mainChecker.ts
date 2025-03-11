import { getAuthToken} from './auth.js';
import {bot} from "./createBot.js";
import { getMachineStatus } from './machineStatus.js';
import { archiveOldLogs } from './archive.js';
import { getMachineState } from './machineStatus.js';
import { sendRebootCommand } from './commands.js';
import { getVendistaToken} from './auth.js';

export interface LogEntry {
    date: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successPercentage: number;
    averageResponseTime: number;
    errorDetails: Array<{ timestamp: string; message: string }>;
}

// Запуск проверки удаленной выдачи
export const logs: LogEntry[] = [];
export let currentLog: LogEntry | null = null;

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
        await archiveOldLogs(currentLog); // Убедитесь, что это действие происходит до инициализации currentLog
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
            currentLog.errorDetails.push({
                timestamp: new Date().toLocaleString('ru-RU'), // Конвертируем время в Ru-Ru local
                message: `Error ${response.status}: ${JSON.stringify(data)}`
            });
        }

        currentLog.successPercentage = (currentLog.successfulRequests / currentLog.totalRequests) * 100;
        currentLog.averageResponseTime = ((currentLog.averageResponseTime * (currentLog.totalRequests - 1)) + responseTime) / currentLog.totalRequests;

        return { response, responseTime, data }; // Возвращаем также данные
    } catch (error) {
        responseTime = performance.now() - startTime;
        currentLog.totalRequests += 1;
        currentLog.failedRequests += 1;
        currentLog.errorDetails.push({
            timestamp: new Date().toLocaleString('ru-RU'), // Конвертируем время в Ru-Ru local
            message: error instanceof Error ? error.message : 'Unknown error'
        });
        return { response: null, responseTime, data: null }; // Возвращаем null для данных
    }
}

let isErrorNotified = false; // Переменная для отслеживания состояния уведомления об ошибке
let lastErrorCode: number | null = null; // Переменная для хранения последнего кода ошибки
let errorCount = 0;
let isRebootCommandSent = false;

async function handleResponse(response: Response, responseTime: number, data: any): Promise<void> {
    const errorCode = response.ok ? null : response.status; // Устанавливаем код ошибки, если есть ошибка

    if (errorCode) {
        // Увеличиваем счетчик ошибок
        errorCount++;
        // Если возникла ошибка и уведомление еще не отправлено
        if ((!isErrorNotified || lastErrorCode !== errorCode) && errorCount === 2) {
            const machineStatus = await getMachineStatus();
            const machineState = await getMachineState()
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
                isErrorNotified = true; // Устанавливаем флаг, что уведомление об ошибке отправлено
                lastErrorCode = errorCode; // Сохраняем код ошибки
                // проверяем статус машины и отправляем команду перезагрузки, если нужно
                if ((machineState === 2 || machineState === 1) && !isRebootCommandSent) {
                    const vendistaToken = await getVendistaToken();
                    await sendRebootCommand(vendistaToken);
                    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID!, 'На терминал отправлена команда перезагрузки.', { parse_mode: 'Markdown' });
                    isRebootCommandSent = true; // Устанавливаем флаг, что команда перезагрузки отправлена
                }

            } catch (error) {
                console.error('Ошибка при отправке уведомления об ошибке:', error);
            }
        }
    } else {
        // Сбрасываем счетчик ошибок при успешном запросе
        errorCount = 0;
        isRebootCommandSent = false;
        // Если запрос завершился успешно и ошибка была ранее зафиксирована
        if (isErrorNotified) {
            const resolvedMessage = `
*Проблема решена!*        ✅
*Запрос завершился успешно.*
*Время ответа API:*       \`${responseTime.toFixed(2)} мс\`
      `;

            try {
                await bot.sendMessage(process.env.TELEGRAM_CHAT_ID!, resolvedMessage, { parse_mode: 'Markdown' });
                isErrorNotified = false; // Сбрасываем флаг, так как проблема решена
                lastErrorCode = null; // Сбрасываем код ошибки
            } catch (error) {
                console.error('Ошибка при отправке уведомления о решении проблемы:', error);
            }
        }
    }
}

export { handleResponse, sendRequest };