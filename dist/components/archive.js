var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import zlib from 'zlib';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logs, currentLog } from './mainChecker.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Архивирование логов
const MAX_FILE_SIZE = 500 * 1024; // 5 КБ в байтах
export const statsFilePath = path.join(__dirname, '../../reports/logs_archive.txt');
function archiveLogIfNeeded(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(filePath)) {
            //        console.error(`Файл ${filePath} не существует.`);
            yield fs.promises.writeFile(filePath, '...\n', { flag: 'wx' });
            //        console.log(`Создан новый файл: ${filePath}`);
            return;
        }
        try {
            const fileStats = fs.statSync(filePath);
            if (fileStats.size > MAX_FILE_SIZE) {
                const gzip = zlib.createGzip();
                const source = fs.createReadStream(filePath);
                const currentDate = new Date().toISOString().split('T')[0];
                const archiveDir = path.join(__dirname, '../../reports');
                const archiveFilePath = path.join(archiveDir, `statistics_${currentDate.replace(/\./g, '-')}.csv.gz`);
                const destination = fs.createWriteStream(archiveFilePath);
                source.on('error', (err) => {
                    console.error('Ошибка при чтении файла:', err);
                });
                destination.on('error', (err) => {
                    console.error('Ошибка при записи архива:', err);
                });
                yield new Promise((resolve, reject) => {
                    source.pipe(gzip).pipe(destination)
                        .on('finish', resolve)
                        .on('error', reject);
                });
                //        console.log(`Файл успешно архивирован: ${archiveFilePath}`);
                yield fs.promises.unlink(filePath);
                //        console.log(`Оригинальный файл удален: ${filePath}`);
                yield fs.promises.writeFile(filePath, '...\n', { flag: 'wx' });
                const logArchiveFilePath = '../reports/logs_archive.txt';
                yield fs.promises.appendFile(logArchiveFilePath, `Файл успешно архивирован: ${archiveFilePath}\n`);
                //        console.log(`Создан файл: ${logArchiveFilePath}`);
            }
            else {
                //        console.log('Размер файла не превышает лимит, архивация не требуется.');
            }
        }
        catch (err) {
            console.error('Ошибка при обработке файла:', err);
        }
    });
}
// Функция для архивирования старых логов
function archiveOldLogs(log) {
    return __awaiter(this, void 0, void 0, function* () {
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
                const filePath = path.join(__dirname, '../../reports/logs_archive.txt');
                //      console.log('Путь к файлу:', filePath);
                // Проверка на существование файла и запись в архив
                if (!fs.existsSync(filePath)) {
                    yield fs.promises.writeFile(filePath, logContent);
                }
                else {
                    yield fs.promises.appendFile(filePath, logContent);
                }
            }
            catch (error) {
                //      console.error('Ошибка при архивировании логов:', error);
            }
        }
        else {
            //    console.error('Лог для архивирования не определен или равен null.');
        }
    });
}
// Функция для записи логов в файл
function saveLogsToFile() {
    return __awaiter(this, void 0, void 0, function* () {
        if (currentLog)
            logs.push(currentLog);
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
        yield fs.promises.writeFile('../check_dispense/reports/api_log.txt', logContent);
    });
}
// Функция для проверки и архивирования существующих логов перед запуском
function checkAndArchiveExistingLogs() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (fs.existsSync('../check_dispense/reports/api_log.txt')) {
                const data = yield fs.promises.readFile('../check_dispense/reports/api_log.txt', 'utf-8');
                // Парсинг и сохранение в архив
                const oldLog = parseLog(data);
                yield archiveOldLogs(oldLog);
                // Очищаем файл логов
                yield fs.promises.writeFile('../check_dispense/reports/api_log.txt', '');
            }
        }
        catch (error) {
            console.error('Ошибка при проверке и архивировании логов:', error);
        }
    });
}
// Парсинг логов из строки
function parseLog(logData) {
    const lines = logData.split('\n').filter(line => line.trim() !== '');
    const logEntry = {};
    for (const line of lines) {
        if (line.startsWith('Дата:')) {
            logEntry.date = line.split(': ')[1];
        }
        else if (line.startsWith('Всего запросов:')) {
            logEntry.totalRequests = parseInt(line.split(': ')[1]);
        }
        else if (line.startsWith('Успешных:')) {
            logEntry.successfulRequests = parseInt(line.split(': ')[1]);
        }
        else if (line.startsWith('Не успешных:')) {
            logEntry.failedRequests = parseInt(line.split(': ')[1]);
        }
        else if (line.startsWith('Процент успешных:')) {
            logEntry.successPercentage = parseFloat(line.split(': ')[1]);
        }
        else if (line.startsWith('Среднее время ответа API:')) {
            logEntry.averageResponseTime = parseFloat(line.split(': ')[1]);
        }
        else if (line.startsWith('Ошибки:')) {
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
    return logEntry;
}
export { archiveLogIfNeeded, archiveOldLogs, checkAndArchiveExistingLogs, parseLog, saveLogsToFile };
