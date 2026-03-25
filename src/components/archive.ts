import zlib from 'zlib';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { LogEntry, logs, currentLog } from './mainChecker.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Архивирование логов
const MAX_FILE_SIZE = 500 * 1024; // 500 КБ
export const statsFilePath = path.join(__dirname, '../../reports/logs_archive.csv');
const dataPath = path.join(__dirname, '../../reports/api_log.csv');

const CSV_HEADER =
    'Дата,Всего запросов,Успешных,Не успешных,Процент успешных,Среднее время ответа,Ошибки\n';

function escapeCsvCell(value: string): string {
    const normalized = value.replace(/\r?\n/g, ' ').trim();
    const mustQuote = /[",\n]/.test(normalized);
    const escaped = normalized.replace(/"/g, '""');
    return mustQuote ? `"${escaped}"` : escaped;
}

function toDailyCsvRow(log: LogEntry): string {
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

function parseCsvLine(line: string): string[] {
    const out: string[] = [];
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
                } else {
                    inQuotes = false;
                }
            } else {
                cur += ch;
            }
        } else {
            if (ch === ',') {
                out.push(cur);
                cur = '';
            } else if (ch === '"') {
                inQuotes = true;
            } else {
                cur += ch;
            }
        }
    }

    out.push(cur);
    return out;
}

function parseDailyCsvRow(rowLine: string): LogEntry {
    const cols = parseCsvLine(rowLine);
    const date = cols[0] ?? '';
    const totalRequests = parseInt(cols[1] ?? '0', 10) || 0;
    const successfulRequests = parseInt(cols[2] ?? '0', 10) || 0;
    const failedRequests = parseInt(cols[3] ?? '0', 10) || 0;
    const successPercentage = parseFloat(cols[4] ?? '0') || 0;
    const averageResponseTime = parseFloat(cols[5] ?? '0') || 0;
    const errorDetails: Array<{ timestamp: string; message: string }> = [];

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

async function ensureCsvWithHeader(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
        await fs.promises.writeFile(filePath, CSV_HEADER, { flag: 'wx' });
        return;
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
        await fs.promises.writeFile(filePath, CSV_HEADER);
    }
}
async function archiveLogIfNeeded(filePath: string) {
    if (!fs.existsSync(filePath)) {
//        console.error(`Файл ${filePath} не существует.`);
        await fs.promises.writeFile(filePath, CSV_HEADER, { flag: 'wx' });
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

            await new Promise((resolve, reject) => {
                source.pipe(gzip).pipe(destination)
                    .on('finish', resolve)
                    .on('error', reject);
            });

            console.log(`Файл успешно архивирован: ${archiveFilePath}`);
            await fs.promises.unlink(filePath);
            console.log(`Оригинальный файл удален: ${filePath}`);
            await fs.promises.writeFile(filePath, CSV_HEADER, { flag: 'wx' });
            const logArchiveFilePath = '../reports/logs_archive.csv';
            await fs.promises.appendFile(logArchiveFilePath, `Файл успешно архивирован: ${archiveFilePath}\n`);
            console.log(`Создан файл: ${logArchiveFilePath}`);
        } else {
            console.log('Размер файла не превышает лимит, архивация не требуется.');
        }
    } catch (err) {
        console.error('Ошибка при обработке файла:', err);
    }
}
// Функция для архивирования старых логов
async function archiveOldLogs(log: LogEntry | null): Promise<void> {
    if (log) {
        try {
            const filePath = path.join(__dirname, '../../reports/logs_archive.csv');
            await ensureCsvWithHeader(filePath);
            const row = toDailyCsvRow(log);
      //      console.log('Путь к файлу:', filePath);

            // Проверка на существование файла и запись в архив
            await fs.promises.appendFile(filePath, row);
        } catch (error) {
      //      console.error('Ошибка при архивировании логов:', error);
        }
    } else {
    //    console.error('Лог для архивирования не определен или равен null.');
    }
}
// Функция для записи логов в файл
async function saveLogsToFile(): Promise<void> {
    if (currentLog) logs.push(currentLog);

    const latestLog = logs[logs.length - 1]; // Получаем последний лог
    await ensureCsvWithHeader(dataPath);
    const content = CSV_HEADER + toDailyCsvRow(latestLog);
    await fs.promises.writeFile(dataPath, content);
}

// Функция для проверки и архивирования существующих логов перед запуском
async function checkAndArchiveExistingLogs(): Promise<void> {
    try{
    if (fs.existsSync(dataPath)) {
        const data = await fs.promises.readFile(dataPath, 'utf-8');
        const lines = data.split('\n').map(l => l.trim()).filter(Boolean);
        const lastLine = lines.length ? lines[lines.length - 1] : '';
        if (lastLine && !lastLine.startsWith('Дата,')) {
            const oldLog = parseDailyCsvRow(lastLine);
            await archiveOldLogs(oldLog);
        }
        // Очищаем файл логов (оставляем заголовок)
        await fs.promises.writeFile(dataPath, CSV_HEADER);
    }
} catch (error) {
        console.error('Ошибка при проверке и архивировании логов:', error);
    }
}

export { archiveLogIfNeeded, archiveOldLogs, checkAndArchiveExistingLogs, saveLogsToFile };
