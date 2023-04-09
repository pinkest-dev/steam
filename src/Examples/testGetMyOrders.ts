import Steam from "../Steam.js";
import readConfig from "./readConfig.js";
import cookies from "./cookies.js";

const steam = new Steam();
const savedCookies = await cookies.readCookies();

steam.setCookies("steamcommunity.com", savedCookies);

const buyOrders = await steam.getMyBuyOrders();

console.log(buyOrders);