import Steam from "../Steam.js";
import config from "./config/config.js";

const steam = new Steam();

const prices = await steam.getSkinsPrice('Black Hoodie', 252490);

console.log(prices);