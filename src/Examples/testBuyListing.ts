import Steam from "../Steam.js";
import config from "./config/config.js";

const steam = new Steam();

steam.setCookies("steamcommunity.com", config.cookies);
const isAuth = await steam.isAuthorized();
console.log(isAuth);
const listings = await steam.getListings("Nova | Sand Dune (Field-Tested)", 730, 1, 5, {
    proxy: "http://login:password@ip:port",
    withLogin: false
});

await steam.buyListing(listings[listings.length - 1].listingid, 730, "Nova | Sand Dune (Field-Tested)", 5, listings[listings.length - 1].price, listings[listings.length - 1].fee);