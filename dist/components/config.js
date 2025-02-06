// config.ts
import dotenv from 'dotenv';
dotenv.config();
const config = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    USERNME: process.env.USERNME,
    PASSWORD: process.env.PASSWORD,
    BASE_URL: process.env.BASE_URL,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    VM_ID: process.env.VM_ID,
    VENDISTA_LOGIN: process.env.VENDISTA_LOGIN,
    VENDISTA_PASSWORD: process.env.VENDISTA_PASSWORD,
    VENDISTA_ID: process.env.VENDISTA_ID,
};
//Логирование токена для проверки
console.log('TELEGRAM_TOKEN:', config.TELEGRAM_TOKEN);
console.log('clientid:', config.CLIENT_ID);
console.log('clientsecret:', config.CLIENT_SECRET);
console.log('username:', config.USERNME);
console.log('password:', config.PASSWORD);
console.log('base_url:', config.BASE_URL);
console.log('TELEGRAM_chat_id:', config.TELEGRAM_CHAT_ID);
export { config };
