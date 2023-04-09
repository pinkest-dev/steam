import cookies from "./cookies.js";
import readConfig from "./readConfig.js";

import Steam from "../Steam.js";

const steam = new Steam();
const config = await readConfig();
const savedCookies = await cookies.readCookies();

const isAuth = await Steam.CheckCookiesSession(config.accountName, savedCookies);

if (!isAuth){
    console.log("Куки не действительный! Логинимся еще раз...");
    await steam.authorization({
        accountName: config.accountName,
        password: config.password,
        shared_secret: config.shared_secret
    });
    const steamCookies = steam.getCookies("steamcommunity.com");
    await cookies.saveCookies(steamCookies);
    console.log("Сохранили активные куки");
} else {
    console.log("Сохраненные куки действительные!");
}