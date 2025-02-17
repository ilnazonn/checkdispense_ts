import './archive.js';
import { checkAndArchiveExistingLogs, archiveLogIfNeeded, saveLogsToFile } from './archive.js';
import { sendRequest, handleResponse } from './mainChecker.js';
import { statsFilePath } from './archive.js';

// Функция для запуска периодического выполнения запроса
async function startInterval(): Promise<void> {
    // Проверяем и архивируем существующие логи перед запуском
    await checkAndArchiveExistingLogs();

    setInterval(async () => {
        try {
            const { response, responseTime, data } = await sendRequest(); // Получаем данные

            if (response) {
                await handleResponse(response, responseTime, data); // Передаем данные
            }
            await saveLogsToFile();
            await archiveLogIfNeeded(statsFilePath);
        } catch (error) {
            console.error('Произошла ошибка при выполнении задачи:', error);
        }
    }, 60 * 1000);
}


startInterval().catch(error => {
    console.error('Error starting interval:', error);
});
