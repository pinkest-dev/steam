import fs from "fs/promises";
import { Cookie } from "request-base/dist/interfaces";

export default {
    readCookies: async (): Promise<{
        [cookieName: string]: Cookie;
    }> => {
        return JSON.parse(await fs.readFile("../../config/cookies.json", "utf-8"));
    },
    saveCookies: async (cookies: {
        [cookieName: string]: Cookie;
    }) => {
        await fs.writeFile("../../config/cookies.json", JSON.stringify(cookies));
    }
}