import Steam from "../Steam.js";
import readConfig from "./readConfig.js";
import cookies from "./cookies.js";
import fs from "fs/promises";

const steam = new Steam();
const savedCookies = await cookies.readCookies();

steam.setCookies("steamcommunity.com", savedCookies);

console.log(steam.getMySteamid64());

const inventory = await steam.getInventory(steam.getMySteamid64());

const tradableItems = inventory.filter(i => i.tradable);

console.log(tradableItems[0]);


await steam.sendTrade("https://steamcommunity.com/tradeoffer/new/?partner=911902902&token=w9iF209M", [tradableItems[0]], [], "message");