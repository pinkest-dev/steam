import Steam from "../Steam.js";
import readConfig from "./readConfig.js";
import cookies from "./cookies.js";
import fs from "fs/promises";

const steam = new Steam();
const config = await readConfig();
const savedCookies = await cookies.readCookies();

steam.setCookies("steamcommunity.com", savedCookies);

const inventory = await steam.getInventory(steam.getMySteamid64(), 730, '2');

const tradableItems = inventory.filter(i => i.tradable);

console.log(tradableItems[0]);

await steam.sendTrade("https://steamcommunity.com/tradeoffer/new/?partner=911902902&token=w9iF209M", [tradableItems[0]], [], "message");

let confirmations = await steam.getConfirmations(config.identity_secret);

console.log(confirmations);

await steam.acceptManyConfirmations(confirmations.map(i => i.id), confirmations.map(i => i.key), config.identity_secret);

confirmations = await steam.getConfirmations(config.identity_secret);

console.log(confirmations);