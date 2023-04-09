import fs from "fs/promises";
export default {
    readCookies: async () => {
        return JSON.parse(await fs.readFile("../../config/cookies.json", "utf-8"));
    },
    saveCookies: async (cookies) => {
        await fs.writeFile("../../config/cookies.json", JSON.stringify(cookies));
    }
};
