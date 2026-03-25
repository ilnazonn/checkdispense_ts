import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const errorsPath = path.join(__dirname, '../../reports/errors.csv');
const ERRORS_HEADER = 'ts,date,source,http_status,response_time_s,message\n';

function formatIsoWithOffset(date: Date, offsetMinutes: number): string {
    const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');

    const y = shifted.getUTCFullYear();
    const m = pad(shifted.getUTCMonth() + 1);
    const d = pad(shifted.getUTCDate());
    const hh = pad(shifted.getUTCHours());
    const mm = pad(shifted.getUTCMinutes());
    const ss = pad(shifted.getUTCSeconds());
    const ms = pad(shifted.getUTCMilliseconds(), 3);

    const sign = offsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMinutes);
    const oh = pad(Math.floor(abs / 60));
    const om = pad(abs % 60);

    return `${y}-${m}-${d}T${hh}:${mm}:${ss}.${ms}${sign}${oh}:${om}`;
}

function escapeCsvCell(value: string): string {
    const normalized = value.replace(/\r?\n/g, ' ').trim();
    const mustQuote = /[",\n]/.test(normalized);
    const escaped = normalized.replace(/"/g, '""');
    return mustQuote ? `"${escaped}"` : escaped;
}

async function ensureErrorsCsv(): Promise<void> {
    if (!fs.existsSync(errorsPath)) {
        await fs.promises.writeFile(errorsPath, ERRORS_HEADER, { flag: 'wx' });
        return;
    }
    const stat = fs.statSync(errorsPath);
    if (stat.size === 0) {
        await fs.promises.writeFile(errorsPath, ERRORS_HEADER);
    }
}

export async function appendErrorLog(params: {
    ts: Date;
    date: string;
    source: 'telemetron_dispense';
    httpStatus: number;
    responseTimeS: number;
    message: string;
}): Promise<void> {
    await ensureErrorsCsv();

    const row = [
        formatIsoWithOffset(params.ts, 180),
        params.date,
        params.source,
        String(params.httpStatus),
        Number.isFinite(params.responseTimeS) ? params.responseTimeS.toFixed(3) : '',
        params.message,
    ].map(v => escapeCsvCell(String(v))).join(',') + '\n';

    await fs.promises.appendFile(errorsPath, row);
}

export { errorsPath };

