import axios from 'axios';
import { getAuthToken } from './auth.js';

// Функция для получения статуса аппарата
async function getMachineStatus(): Promise<string> {
    try {
        const response = await axios.get(`https://api.telemetron.net/v2/vending_machines/${process.env.VM_ID}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await getAuthToken()}`
            }
        });

        const state: number | null = response.data.state;

        switch (state) {
            case 0:
            case null:
                return `${state} - неизвестно`;
            case 1:
                return `${state} - работает`;
            case 2:
                return `${state} - не работает`;
            case 3:
                return `${state} - нет GSM-связи`;
            default:
                return `${state} - неизвестное состояние`;
        }
    } catch (error: any) {
        return `Ошибка получения статуса: ${error.message}`;
    }
}

// Функция для получения числового значения состояния
async function getMachineState(): Promise<number | null> {
    try {
        const response = await axios.get(`https://api.telemetron.net/v2/vending_machines/${process.env.VM_ID}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await getAuthToken()}`
            }
        });

        return response.data.state; // Возвращаем только состояние
    } catch (error: any) {
        console.error(`Ошибка получения статуса: ${error.message}`);
        return null; // Возвращаем null в случае ошибки
    }
}

// Экспорт функций
export { getMachineStatus, getMachineState };