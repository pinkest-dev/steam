import readConfig from "./readConfig.js";
import cookies from "./cookies.js";
import Steam from "../Steam.js";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const config = await readConfig();
const steam = new Steam();
const savedCookies = await cookies.readCookies();

steam.setCookies("steamcommunity.com", savedCookies);

const offers = await steam.getReceivedOffers(config.api);

for (var offer of offers) {
    await steam.acceptTrade(offer).then(() => {
        console.log(`Успешно приняли трейд`);
    }).catch(err => {
        console.log(`Ошибка принятия трейда: ${err}`);
    });
    await sleep(5000);
}


