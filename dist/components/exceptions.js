import { exec } from 'child_process';
// Функция для перезапуска приложения через PM2
function restartApplication() {
    exec('pm2 restart check_dispense', (error, stdout, stderr) => {
        if (error) {
            console.error(`Ошибка при перезапуске приложения: ${error.message}`);
            return;
        }
        console.log(`Вывод команды: ${stdout}`);
        console.error(`Ошибка команды: ${stderr}`);
    });
}
process.on('unhandledRejection', (reason, promise) => {
    console.error('Необработанный промис:', promise, 'Причина:', reason);
    console.log('Перезапускаем приложение через PM2...');
    // Пробуем перезапустить приложение
    restartApplication();
    // Завершаем процесс после небольшой задержки
    setTimeout(() => {
        console.log('Завершаем процесс после обработки исключения');
        process.exit(1);
    }, 1000);
});
// Обработчик необработанных исключений
process.on('uncaughtException', (error) => {
    console.error('Необработанное исключение:', error);
    console.log('Перезапускаем приложение через PM2...');
    // Пробуем перезапустить приложение
    restartApplication();
    // Завершаем процесс после небольшой задержки
    setTimeout(() => {
        console.log('Завершаем процесс после обработки исключения');
        process.exit(1);
    }, 1000);
});
