import Steam from '../Steam.js';
import config from './config/config.js';

const isAuth = await Steam.CheckCookiesSession("aboba", config.cookies);
console.log(isAuth);