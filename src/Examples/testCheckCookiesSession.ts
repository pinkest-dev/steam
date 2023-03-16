import Steam from '../Steam.js';

const isAuth = await Steam.CheckCookiesSession("aboba", {});
console.log(isAuth);