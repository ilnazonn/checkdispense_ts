import axios from 'axios';

// Функция для получения авторизационного токена
async function getAuthToken(): Promise<string> {
    try {
        const response = await axios.post('https://api.telemetron.net/auth/', {
            grant_type: 'password',
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            scope: 'teleport',
            username: process.env.USERNME, // Исправлено 'USERNME' на 'USERNAME'
            password: process.env.PASSWORD
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return response.data.access_token;
    } catch (error: any) {
        const errorMessage = `Ошибка авторизации: ${error.response?.data?.error_description || error.message}`;
        console.error(errorMessage);

        // Добавляем отладочные сообщения
//        console.error('Response data:', error.response);
//        console.error('Response status:', error.response?.status);

        throw new Error(errorMessage); // Выбрасываем ошибку для обработки в вызывающем коде
    }
}
// Функция для получения токена от Vendista
async function getVendistaToken(): Promise<string> {
    try {
        const response = await axios.get(`https://api.vendista.ru:99/token?login=${process.env.VENDISTA_LOGIN}&password=${process.env.VENDISTA_PASSWORD}`);
        return response.data.token;
    } catch (error: any) {
        throw new Error(`Ошибка получения токена Vendista: ${error.message}`);
    }
}

// Обработка ошибок авторизации
process.on('uncaughtException', (err) => {
    if (err.message.includes('Ошибка авторизации: connect ETIMEDOUT')) {
        console.error('Произошла ошибка авторизации. Приложение будет перезапущено PM2...');
        process.exit(1); // Завершаем процесс с кодом 1 для указания ошибки
    }
});


export { getAuthToken, getVendistaToken };