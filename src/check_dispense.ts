import { bot } from './components/createBot.js';
import './components/commands.js';
import './components/runInterval.js';

// Запуск бота
bot.on('polling_error', (error) => {
  console.log(error);  // Вывод ошибок
});




