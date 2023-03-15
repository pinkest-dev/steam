import Base from "./Base.js";
import crypto from "crypto";
//@ts-ignore
import { hex2b64, Key } from "node-bignumber";
import { AuthentificationParams, ClientJsToken, ConstructorOptions, Cookie, CreateBuyOrderParams, DoLoginParams, RsaKey } from "./interfaces.js";
import got from "got";

class Steam extends Base {
    constructor(options?: ConstructorOptions) {
        super(options);
    }

    private async getClientJsToken() {
        const clientJsToken: ClientJsToken = await this.doRequest(`https://steamcommunity.com/chat/clientjstoken`, {
            headers: {
                Referer: `https://steamcommunity.com/market/`
            }
        });
        return clientJsToken;
    }

    /**Получить статус авторизации. Проверить авторизованы ли мы сейчас в Steam? Действительны ли наши куки*/
    async isAuthorized() {
        return (await this.getClientJsToken()).logged_in;
    }
    /**Получить статус авторизации у произвольных куков*/
    static async CheckCookiesSession(accountName: string, cookies: { [cookieName: string]: Cookie }) {
        try {
            const response: RsaKey = await got(`https://steamcommunity.com/login/getrsakey/`, {
                method: 'POST',
                headers: {
                    Referer: `https://steamcommunity.com/login/home/?goto=`,
                    cookie: Base.PackCookiesToString(cookies)
                },
                form: {
                    username: accountName,
                    donotcache: Date.now()
                }
            }).json();
            if (response.success) {
                const key = new Key();
                key.setPublic(response.publickey_mod, response.publickey_exp);
                return true;
            } else {
                return false;
            }
        } catch (err) {
            throw new Error(`Can't check cookies session: ${err}`);
        }
    }

    private async getRsaKey(login: string) {
        try {
            const response: RsaKey = await this.doRequest(`https://steamcommunity.com/login/getrsakey/`, {
                method: 'POST',
                headers: {
                    Referer: `https://steamcommunity.com/login/home/?goto=`
                },
                form: {
                    username: login,
                    donotcache: Date.now()
                }
            });
            if (response.success) {
                const key = new Key();
                key.setPublic(response.publickey_mod, response.publickey_exp);
                return { key, timestamp: response.timestamp };
            } else {
                throw new Error(`Can't get rsa key: ${JSON.stringify(response)}`);
            }
        } catch (err) {
            throw new Error(`Can't get Rsa Key: ${err}`);
        }
    }
    private async doLogin(options: DoLoginParams) {
        try {
            const { key, timestamp } = await this.getRsaKey(options.accountName);
            const encryptedPassword = hex2b64(key.encrypt(options.password));
            const twoFactorCode = options.shared_secret ? this.generateTwoFactorCode(options.shared_secret) : options.twoFactorCode;

            const response = await this.doRequest(`https://steamcommunity.com/login/dologin/`, {
                method: 'POST',
                headers: {
                    Referer: `https://steamcommunity.com/login/home/?goto=`
                },
                followRedirect: true,
                form: {
                    donotcache: Date.now(),
                    username: options.accountName,
                    password: encryptedPassword,
                    twofactorcode: twoFactorCode,
                    emailauth: null,
                    loginfriendlyname: null,
                    captchagid: -1,
                    captcha_text: null,
                    emailsteamid: null,
                    rsatimestamp: timestamp,
                    remember_login: true,
                    tokentype: -1,
                }
            });

            if (!response.success && response.emailauth_needed) {
                throw new Error(`Steam Guard`);
            } else if (!response.success && response.requires_twofactor) {
                throw new Error("SteamGuardMobile");
            } else if (!response.success && response.captcha_needed && response.message.match(/Please verify your humanity/)) {
                throw new Error("Captcha");
            } else if (!response.success) {
                throw new Error("Unknown error");
            } else {
                const sid = this.generateSessionID();
                const transfer_parameters = response.transfer_parameters;
                const newCookies = [
                    `sessionid=${sid}`,
                    `steamLoginSecure=${transfer_parameters.token_secure}`,
                    `steamMachineAuth${transfer_parameters.steamid}=${transfer_parameters.webcookie}`
                ];
                return newCookies;
            }
        } catch (err) {
            throw new Error(`Cant't do login: ${err}`);
        }
    }
    private generateSessionID() {
        return crypto.randomBytes(12).toString('hex');
    }
    private bufferizeSecret(shared_secret: string) {
        try {
            if (shared_secret.match(/[0-9a-f]{40}/i)) {
                return Buffer.from(shared_secret, 'hex')
            } else {
                return Buffer.from(shared_secret, 'base64')
            }
        } catch (err) {
            throw new Error(`Can't bufferize shared_secret: ${err}`);
        }
    }

    /**(основные методы) Сгенерировать 5-значный вход для входа в аккаунт. shared_secret - код из maFile*/
    generateTwoFactorCode(shared_secret: string) {
        try {
            const bufferizedSharedSecret = this.bufferizeSecret(shared_secret);
            const time = Math.floor(Date.now() / 1000);
            const buffer = Buffer.allocUnsafe(8);
            buffer.writeUInt32BE(0, 0);
            buffer.writeUInt32BE(Math.floor(time / 30), 4);

            const hmac = crypto.createHmac('sha1', bufferizedSharedSecret);
            const bufferHmac = hmac.update(buffer).digest();

            const start = bufferHmac[19] & 0x0f;
            const slicedHmac = bufferHmac.slice(start, start + 4);
            let fullcode = slicedHmac.readUInt32BE(0) & 0x7fffffff;

            const chars = '23456789BCDFGHJKMNPQRTVWXY';

            let code = '';
            for (let i = 0; i < 5; i++) {
                code += chars.charAt(fullcode % chars.length);
                fullcode /= chars.length;
            }

            return code;
        } catch (err) {
            throw new Error(`Can't generate auth code: ${err}`);
        }
    }

    /**openidMode - можно достать со страницы входа в Steam аккаунт
     * https://steamcommunity.com/openid/login?openid.mode= - нужно скопировать строку, которая идёт далее
     * На эту страницу можно попасть, нажав на нужном сайте кнопку ВОЙТИ ЧЕРЕЗ STEAM
    */
    private async getNonce(openidMode: string) {
        try {
            const response = await this.doRequest(`https://steamcommunity.com/openid/login?openid.mode=${openidMode}`, {}, { isJsonResult: false });
            const nonce = response.match(/<input type="hidden" name="nonce" value="{0-9a-z}/g).replaceAll('<input type="hidden" name="nonce" value="', '');
            return nonce;
        } catch (err) {
            throw new Error(String(err));
        }
    }

    /**Авторизоваться на каком-либо сайте через Steam. Отдаётся ссылка, при переходе по которой устанавливаются куки авторизации*/
    async serviceAuthorization(openidMode: string) {
        try {
            const nonce = await this.getNonce(openidMode);
        } catch (err){
            throw new Error(`Can't authorize in service: ${err}`);
        }
    }

    /**(основной метод) Пройти авторизацию в Steam (получить доступ к аккаунту) */
    async authorization(params: AuthentificationParams) {
        try {
            const isLoggedIn = await this.isAuthorized();
            if (isLoggedIn) {
                throw new Error(`Already logged in`);
            }
            if (params.accountName && params.password && (params.shared_secret || params.twoFactorCode)) {
                const cookies = await this.doLogin({
                    accountName: params.accountName,
                    password: params.password,
                    shared_secret: params.shared_secret,
                    twoFactorCode: params.twoFactorCode
                });
                return cookies;
            } else {
                throw new Error(`Authentification params is not valid`);
            }
        } catch (err) {
            throw new Error(`Can't authentificate in Steam: ${err}`);
        }
    }

    /**(метод аккаунта) получения баланса аккаунта (в установленной валюте)*/
    async getBalance() {
        try {
            const response = await this.doRequest("https://store.steampowered.com/account/", {}, { isJsonResult: false });
            if (response.includes('id="header_wallet_balance"'))
                var balanceInfo: string = response.split('<a class="global_action_link" id="header_wallet_balance" href="https://store.steampowered.com/account/store_transactions/">')[1].split("</a>")[0];
            else
                if (response.includes('<div class="accountData price">'))
                    var balanceInfo: string = response.split('<div class="accountData price">')[1].split("</div>")[0];
                else
                    throw new Error("Не удалось получить баланс");
            var balance: number;
            var rawBalance = /\d+,+\d+|\d+\.+\d+|\d+/.exec(balanceInfo);
            if (rawBalance)
                balance = parseFloat(rawBalance[0].replace(",", "."));
            else
                throw new Error("Не получилось отформатировать");

            const currency = balanceInfo.replace(/\d+,+\d+|\d+\.+\d+|\d+/, "");

            return { currency, balance }
        } catch (err) {
            throw new Error(`Can't get Steam balance: ${err}`);
        }
    }

    /**(работа с тп) Поставить запрос на покупку предмета */
    async createBuyOrder(params: CreateBuyOrderParams): Promise<void> {
        try {
            const cookies = this.getCookies(PopularDomens["steamcommunity.com"]);
            if (!cookies.sessionid) throw new Error(`Not logged in`);
            const response = await this.doRequest('https://steamcommunity.com/market/createbuyorder/', {
                method: 'POST',
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": `https://steamcommunity.com/market/listings/${params.appid}/${encodeURIComponent(params.market_hash_name)}`
                },
                form: {
                    sessionid: cookies.sessionid.value,
                    currency: params.currency,
                    appid: params.appid,
                    market_hash_name: params.market_hash_name,
                    price_total: params.price,
                    quantity: params.quantity,
                    save_my_address: 0
                }
            });
            if (response.success === 1) {
                return;
            } else if (response.success === 25) {
                throw new Error(`Maximum order amount exceeded`);
            } else if (response.success === 29) {
                throw new Error(`Order already exists`);
            }
        } catch (err) {
            throw new Error(`Can't create buy order: ${err}`);
        }
    }

    /**(работа с тп) Возвращает все точки на графике определенного предмета торговой площадки, отображаемые в Steam [date, price, quantity][] В ДОЛЛАРАХ США!
     * @param market_hash_name - полное название предмета
     * @param options - настройки запроса
    */
    async getSkinSales(market_hash_name: string, options?: {
        /**прокси в формате http://username:password@ip:port, через который пройдет запрос (он будет приоритетнее, чем тот, который передан в конструктор класса) */
        proxy?: string,
        /**Использовать ли куки аккаунта в запросе */
        withLogin?: boolean
    }): Promise<[Date, number, number][]> {
        try {
            const response = await this.doRequest(
                `https://steamcommunity.com/market/listings/730/${encodeURIComponent(market_hash_name)}`,
                {

                },
                { isJsonResult: false, useSavedCookies: options?.withLogin === true, customProxy: options?.proxy }
            );
            const pos1 = response.indexOf("var line1=", 0) + "var line1=".length;
            const pos2 = response.indexOf(';', pos1);
            const arr: [string, number, string][] = JSON.parse(response.slice(pos1, pos2));
            const results = arr.map(el => {
                const newEl: [Date, number, number] = [
                    new Date(el[0]),
                    el[1],
                    Number(el[2])
                ];
                return newEl;
            });
            return results;
        } catch (err) {
            throw new Error(`Can't get last sales: ${err}`);
        }
    }

    /**(НЕ РАБОТАЕТ) Подгрузка nameid со стима. Довольно ресурсоёмкая операция, поэтому следует минимизировать её использование 
     * @param market_hash_name - полное название предмета
    */
    async parseNameid(market_hash_name: string) {
        throw new Error(`This method is not avalible`);
    }

    /**(работа с тп) Возвращает максимальный и минимальный рыночный зарос на определенный предмет торговой площадки
     * @param market_hash_name - полное название предмета
     * @param options - настройки запроса
    */
    async getSkinOrders(nameid: number, options?: {
        /**прокси в формате http://username:password@ip:port, через который пройдет запрос (он будет приоритетнее, чем тот, который передан в конструктор класса) */
        proxy?: string,
        /**Использовать ли куки аккаунта в запросе */
        withLogin?: boolean
    }) {
        try {
            const response = await this.doRequest(
                `https://steamcommunity.com/market/itemordershistogram?country=RU&language=russian&currency=5&item_nameid=${nameid}&two_factor=0`,
                {},
                { useSavedCookies: options?.withLogin === true, customProxy: options?.proxy }
            );
            if (response.success === 1) {
                return {
                    lowest_sell_order: Number(response.lowest_sell_order) / 100,
                    highest_buy_order: Number(response.highest_buy_order) / 100
                }
            } else {
                throw new Error(response);
            }
        } catch (err) {
            throw new Error(`Can't get skin orders: ${err}`);
        }
    }
}

export default Steam;