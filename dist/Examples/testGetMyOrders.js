import Steam from "../Steam.js";
import config from "./config/config.js";
const steam = new Steam();
steam.setCookies("steamcommunity.com", config.cookies);
const buyOrders = await steam.getMyBuyOrders();
console.log(buyOrders);
if (buyOrders[0])
    await steam.cancelBuyOrder(buyOrders[0].id);
