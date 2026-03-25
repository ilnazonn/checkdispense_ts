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
const MAX_FILE_SIZE = 500 * 1024; // 500 КБ
export const statsFilePath = path.join(__dirname, '../../reports/logs_archive.csv');
const dataPath = path.join(__dirname, '../../reports/api_log.csv');
const CSV_HEADER = 'Дата,Всего запросов,Успешных,Не успешных,Процент успешных,Среднее время ответа,Ошибки\n';
function escapeCsvCell(value) {
    const normalized = value.replace(/\r?\n/g, ' ').trim();
    const mustQuote = /[",\n]/.test(normalized);
    const escaped = normalized.replace(/"/g, '""');
    return mustQuote ? `"${escaped}"` : escaped;
}
function toDailyCsvRow(log) {
    const successPct = log.totalRequests === 0 ? 0 : (log.successfulRequests / log.totalRequests) * 100;
    const avg = Number.isFinite(log.averageResponseTime) ? log.averageResponseTime : 0;
    const cells = [
        log.date,
        String(log.totalRequests),
        String(log.successfulRequests),
        String(log.failedRequests),
        successPct.toFixed(2),
        avg.toFixed(2),
        String(log.failedRequests),
    ];
    return cells.map(c => escapeCsvCell(c)).join(',') + '\n';
}
function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                const next = line[i + 1];
                if (next === '"') {
                    cur += '"';
                    i++;
                }
                else {
                    inQuotes = false;
                }
            }
            else {
                cur += ch;
            }
        }
        else {
            if (ch === ',') {
                out.push(cur);
                cur = '';
            }
            else if (ch === '"') {
                inQuotes = true;
            }
            else {
                cur += ch;
            }
        }
    }
    out.push(cur);
    return out;
}
function parseDailyCsvRow(rowLine) {
    var _a, _b, _c, _d, _e, _f;
    const cols = parseCsvLine(rowLine);
    const date = (_a = cols[0]) !== null && _a !== void 0 ? _a : '';
    const totalRequests = parseInt((_b = cols[1]) !== null && _b !== void 0 ? _b : '0', 10) || 0;
    const successfulRequests = parseInt((_c = cols[2]) !== null && _c !== void 0 ? _c : '0', 10) || 0;
    const failedRequests = parseInt((_d = cols[3]) !== null && _d !== void 0 ? _d : '0', 10) || 0;
    const successPercentage = parseFloat((_e = cols[4]) !== null && _e !== void 0 ? _e : '0') || 0;
    const averageResponseTime = parseFloat((_f = cols[5]) !== null && _f !== void 0 ? _f : '0') || 0;
    const errorDetails = [];
    return {
        date,
        totalRequests,
        successfulRequests,
        failedRequests,
        successPercentage,
        averageResponseTime,
        errorDetails,
    };
}
function ensureCsvWithHeader(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(filePath)) {
            yield fs.promises.writeFile(filePath, CSV_HEADER, { flag: 'wx' });
            return;
        }
        const stat = fs.statSync(filePath);
        if (stat.size === 0) {
            yield fs.promises.writeFile(filePath, CSV_HEADER);
        }
    });
}
function archiveLogIfNeeded(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(filePath)) {
            //        console.error(`Файл ${filePath} не существует.`);
            yield fs.promises.writeFile(filePath, CSV_HEADER, { flag: 'wx' });
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
                console.log(`Файл успешно архивирован: ${archiveFilePath}`);
                yield fs.promises.unlink(filePath);
                console.log(`Оригинальный файл удален: ${filePath}`);
                yield fs.promises.writeFile(filePath, CSV_HEADER, { flag: 'wx' });
                const logArchiveFilePath = '../reports/logs_archive.csv';
                yield fs.promises.appendFile(logArchiveFilePath, `Файл успешно архивирован: ${archiveFilePath}\n`);
                console.log(`Создан файл: ${logArchiveFilePath}`);
            }
            else {
                console.log('Размер файла не превышает лимит, архивация не требуется.');
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
                const filePath = path.join(__dirname, '../../reports/logs_archive.csv');
                yield ensureCsvWithHeader(filePath);
                const row = toDailyCsvRow(log);
                //      console.log('Путь к файлу:', filePath);
                // Проверка на существование файла и запись в архив
                yield fs.promises.appendFile(filePath, row);
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
        yield ensureCsvWithHeader(dataPath);
        const content = CSV_HEADER + toDailyCsvRow(latestLog);
        yield fs.promises.writeFile(dataPath, content);
    });
}
// Функция для проверки и архивирования существующих логов перед запуском
function checkAndArchiveExistingLogs() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (fs.existsSync(dataPath)) {
                const data = yield fs.promises.readFile(dataPath, 'utf-8');
                const lines = data.split('\n').map(l => l.trim()).filter(Boolean);
                const lastLine = lines.length ? lines[lines.length - 1] : '';
                if (lastLine && !lastLine.startsWith('Дата,')) {
                    const oldLog = parseDailyCsvRow(lastLine);
                    yield archiveOldLogs(oldLog);
                }
                // Очищаем файл логов (оставляем заголовок)
                yield fs.promises.writeFile(dataPath, CSV_HEADER);
            }
        }
        catch (error) {
            console.error('Ошибка при проверке и архивировании логов:', error);
        }
    });
}
export { archiveLogIfNeeded, archiveOldLogs, checkAndArchiveExistingLogs, saveLogsToFile };
