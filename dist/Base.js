import got from "got";
import { HttpsProxyAgent } from 'hpagent';
import settings from "./settings.js";
class Base {
    proxy;
    cookies = {};
    userAgent;
    constructor(options) {
        this.proxy = options ? (options.proxy ? options.proxy : null) : null;
        this.userAgent = options && options.userAgent ? options.userAgent : settings.defaultUserAgent;
    }
    setCookies(domen, cookies) {
        this.cookies[domen] = cookies;
    }
    getAllDomens() {
        return Object.keys(this.cookies);
    }
    getCookies(domen) {
        if (domen)
            return this.cookies[domen];
        else
            return this.cookies;
    }
    clearCookies(domen) {
        if (typeof (domen) === 'undefined')
            this.cookies = {};
        else
            delete (this.cookies[domen]);
    }
    /**Метод для превращения объекта красивых куков в строку, которую можно уже использовать в запросе */
    static PackCookiesToString(cookies) {
        let result = ``;
        for (const cookieName in cookies) {
            const cookie = cookies[cookieName];
            result += `${cookieName}=${cookie.value}; `;
        }
        return result;
    }
    static ParseCookiseString(cookieStr) {
        const splittedCookies = cookieStr.split('; ');
        let cookies = {};
        for (var str of splittedCookies) {
            const splittedCookie = str.split('=');
            if (splittedCookie.length === 2) {
                cookies[splittedCookie[0]] = {
                    name: splittedCookie[0],
                    value: splittedCookie[1],
                    expires: null
                };
            }
        }
        return cookies;
    }
    /**Метод для превращения строки куков в объект
     * Важное примечание: строка, которая передается в метод должна содержать лишь одну куку и её свойства (вызывается, когда приходят куки в set-cookie)
    */
    static ParseNewCookiesString(cookieStr) {
        const splittedCookies = cookieStr.split('; ');
        const expiresCookie = splittedCookies.filter(c => c.includes('Expires'))[0];
        const cookie = {
            name: splittedCookies[0].split('=')[0],
            value: splittedCookies[0].split('=')[1],
            expires: expiresCookie ? new Date(expiresCookie.split('=')[1]) : null
        };
        return cookie;
    }
    /**Установка массива куков, куки должны браться из set-cookie */
    setDirtyCookies(domen, cookies) {
        for (const cookie of cookies) {
            const parsedCookie = Base.ParseNewCookiesString(cookie);
            if (!this.cookies[domen])
                this.cookies[domen] = {};
            this.cookies[domen][parsedCookie.name] = parsedCookie;
        }
    }
    /**Универсальная функция для запроса */
    async doRequest(url, requestOptions, options) {
        try {
            const domen = url.replaceAll('http://', '').replaceAll('https://', '').split('/')[0];
            const headers = requestOptions && requestOptions.headers ? requestOptions.headers : {};
            const cookies = requestOptions && requestOptions.headers && requestOptions.headers.cookie ? Base.ParseCookiseString(requestOptions.headers.cookie) : {};
            delete (requestOptions?.headers);
            const allCookies = { ...this.cookies[domen], ...cookies };
            const actualRequestOptions = {
                headers: {
                    cookie: options?.useSavedCookies === false ? undefined : Base.PackCookiesToString(allCookies),
                    'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36`,
                    ...headers
                },
                timeout: {
                    lookup: 100,
                    connect: 50,
                    secureConnect: 50,
                    socket: 1000,
                    send: 10000,
                    response: 1000,
                    request: 10000
                },
                ...requestOptions
            };
            if (options?.customProxy) {
                actualRequestOptions.agent = {
                    https: this.getProxyAgent(options.customProxy),
                    http: this.getProxyAgent(options.customProxy)
                };
            }
            else if (this.proxy && (options?.useDefaultProxy || typeof (options) === 'undefined'))
                actualRequestOptions.agent = {
                    https: this.getProxyAgent(this.proxy),
                    http: this.getProxyAgent(this.proxy)
                };
            const result = await got(url, actualRequestOptions).then(({ headers, body, statusCode }) => {
                const newCookies = headers["set-cookie"];
                if (newCookies)
                    this.setDirtyCookies(domen, newCookies);
                if (options?.isJsonResult === true || typeof (options?.isJsonResult) === 'undefined') {
                    try {
                        return { headers, body: JSON.parse(body) };
                    }
                    catch (err) {
                        throw new Error(`Cant parse response. It's not in json format`);
                    }
                }
                else {
                    return { headers, body, statusCode: statusCode };
                }
            }).catch(err => {
                if (err.response)
                    return { headers: err.response.headers, body: err.response.body, statusCode: err.statusCode };
                else {
                    throw new Error(err);
                }
            });
            return result;
        }
        catch (err) {
            console.log(err);
            throw new Error(`Request error: ${err}`);
        }
    }
    getProxyAgent(proxy) {
        return new HttpsProxyAgent({
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxSockets: 256,
            maxFreeSockets: 256,
            scheduling: 'lifo',
            proxy: proxy
        });
    }
}
export default Base;
