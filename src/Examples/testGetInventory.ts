import Steam from "../Steam.js";
import cookies from "./cookies.js";

const steam = new Steam();
const savedCookies = await cookies.readCookies();

steam.setCookies("steamcommunity.com", savedCookies);
const inventory = await steam.getInventory(steam.getMySteamid64());

console.log(inventory);