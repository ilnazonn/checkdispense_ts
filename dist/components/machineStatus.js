var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import axios from 'axios';
import { getAuthToken } from './auth.js';
// Функция для получения статуса аппарата
function getMachineStatus() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios.get(`https://api.telemetron.net/v2/vending_machines/${process.env.VM_ID}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${yield getAuthToken()}`
                }
            });
            const state = response.data.state;
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
        }
        catch (error) {
            return `Ошибка получения статуса: ${error.message}`;
        }
    });
}
export { getMachineStatus };
