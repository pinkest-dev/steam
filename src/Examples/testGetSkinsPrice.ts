import Steam from "../Steam.js";

const steam = new Steam();

const prices = await steam.getSkinsPrice('Black Hoodie', 252490);

console.log(prices);