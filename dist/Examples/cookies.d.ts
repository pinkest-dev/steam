import { Cookie } from "request-base/dist/interfaces";
declare const _default: {
    readCookies: () => Promise<{
        [cookieName: string]: Cookie;
    }>;
    saveCookies: (cookies: {
        [cookieName: string]: Cookie;
    }) => Promise<void>;
};
export default _default;
