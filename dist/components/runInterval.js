var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import './archive.js';
import { checkAndArchiveExistingLogs, archiveLogIfNeeded, saveLogsToFile } from './archive.js';
import { sendRequest, handleResponse } from './mainChecker.js';
import { statsFilePath } from './archive.js';
// Функция для запуска периодического выполнения запроса
function startInterval() {
    return __awaiter(this, void 0, void 0, function* () {
        // Проверяем и архивируем существующие логи перед запуском
        yield checkAndArchiveExistingLogs();
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            const { response, responseTime, data } = yield sendRequest(); // Получаем данные
            if (response) {
                yield handleResponse(response, responseTime, data); // Передаем данные
            }
            yield saveLogsToFile();
            archiveLogIfNeeded(statsFilePath);
        }), 60 * 1000);
    });
}
startInterval().catch(error => {
    console.error('Error starting interval:', error);
});
