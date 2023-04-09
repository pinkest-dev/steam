import fs from "fs/promises";

export default async () => {
    return JSON.parse(await fs.readFile("../../config/config.json", "utf-8"));
}