import Steam from "../Steam.js";
const steam = new Steam();
await steam.authorization({
    accountName: 'karabindota',
    password: 'Vbif 2528',
    shared_secret: 'yJ290zpQmiSlgvf7IrZ5buiNAxo='
});
console.log(steam.getCookies("steamcommunity.com"));
