import Base from "./Base.js";
import crypto from "crypto";
//@ts-ignore
import { hex2b64, Key } from "node-bignumber";
import { AuthentificationParams, BuyOrder, ClientJsToken, ConstructorOptions, Cookie, CreateBuyOrderParams, DoLoginParams, RsaKey } from "./interfaces.js";
import got from "got";
import PopularDomens from "./Enums/PopularDomens.js";

class Steam extends Base {
    constructor(options?: ConstructorOptions) {
        super(options);
    }

    private async getClientJsToken() {
        const { body } = await this.doRequest(`https://steamcommunity.com/chat/clientjstoken`, {
            headers: {
                Referer: `https://steamcommunity.com/market/`
            }
        });
        return body as ClientJsToken;
    }

    /**Получить статус авторизации. Проверить авторизованы ли мы сейчас в Steam? Действительны ли наши куки*/
    async isAuthorized() {
        return (await this.getClientJsToken()).logged_in;
    }
    /**Получить статус авторизации у произвольных куков*/
    static async CheckCookiesSession(accountName: string, cookies: { [cookieName: string]: Cookie }) {
        try {
            const response: any = await got(`https://steamcommunity.com/chat/clientjstoken`, {
                headers: {
                    cookie: Base.PackCookiesToString(cookies)
                }
            }).json();

            if (response.logged_in && accountName === response.account_name) {
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
            const { body } = await this.doRequest(`https://steamcommunity.com/login/getrsakey/`, {
                method: 'POST',
                headers: {
                    Referer: `https://steamcommunity.com/login/home/?goto=`
                },
                form: {
                    username: login,
                    donotcache: Date.now()
                }
            });
            if (body.success) {
                const key = new Key();
                key.setPublic(body.publickey_mod, body.publickey_exp);
                return { key, timestamp: body.timestamp };
            } else {
                throw new Error(`Can't get rsa key: ${JSON.stringify(body)}`);
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

            const { body } = await this.doRequest(`https://steamcommunity.com/login/dologin/`, {
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

            if (!body.success && body.emailauth_needed) {
                throw new Error(`Steam Guard`);
            } else if (!body.success && body.requires_twofactor) {
                throw new Error("SteamGuardMobile");
            } else if (!body.success && body.captcha_needed && body.message.match(/Please verify your humanity/)) {
                throw new Error("Captcha");
            } else if (!body.success) {
                throw new Error("Unknown error");
            } else {
                const sid = this.generateSessionID();
                const transfer_parameters = body.transfer_parameters;
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

    /**Получение параметров для авторизации на каком-то сервисе через Steam
     * @param link - ссылка на авторизацию в Steam, на которую пересылает сервис
    */
    private async getLoginFormData(link: string) {
        try {
            const { body } = await this.doRequest(link, {}, { isJsonResult: false });

            const rawNonce = body.match(/<input type="hidden" name="nonce" value="[0-9a-z]*/g);
            const rawOpenidparams = body.match(/<input type="hidden" name="openidparams" value="[0-9a-zA-Z]*/);
            if (!rawNonce) throw new Error('Nonce is not found on login page');
            if (!rawOpenidparams) throw new Error('Openid is not found on login page');

            const nonce = rawNonce[0].replaceAll('<input type="hidden" name="nonce" value="', '');
            const openid = rawOpenidparams[0].replaceAll('<input type="hidden" name="openidparams" value="', '');
            return { nonce, openid };
        } catch (err) {
            throw err;
        }
    }

    private async openidLogin(link: string, nonce: string, openid: string) {
        const { headers } = await this.doRequest(`https://steamcommunity.com/openid/login`, {
            method: 'POST',
            headers: {
                Referer: link,
                Origin: `https://steamcommunity.com`
            },
            form: {
                action: "steam_openid_login",
                nonce: nonce,
                "openid.mode": "checkid_setup",
                openidparams: openid
            },
            followRedirect: false
        }, {
            isJsonResult: false
        });
        return headers.location;
    }

    /**Авторизоваться на каком-либо сайте через Steam. Отдаётся ссылка, при переходе по которой устанавливаются куки авторизации 
     * для разных сайтов нужны разные параметры для запроса, чтобы из этой ссылки получить хорошие куки, где-то надо просто установить Referer, 
     * а где-то придется знатно потанцевать с бубном
    */
    async getServiceAuthirizationLink(link: string) {
        try {
            const params = await this.getLoginFormData(link);
            const location = await this.openidLogin(link, params.nonce, params.openid);
            return location;
        } catch (err) {
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
            const { body } = await this.doRequest("https://store.steampowered.com/account/", {}, { isJsonResult: false });
            if (body.includes('id="header_wallet_balance"'))
                var balanceInfo: string = body.split('<a class="global_action_link" id="header_wallet_balance" href="https://store.steampowered.com/account/store_transactions/">')[1].split("</a>")[0];
            else
                if (body.includes('<div class="accountData price">'))
                    var balanceInfo: string = body.split('<div class="accountData price">')[1].split("</div>")[0];
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
    async createBuyOrder(params: CreateBuyOrderParams) {
        try {
            const cookies = this.getCookies(PopularDomens["steamcommunity.com"]);
            if (!cookies.sessionid) throw new Error(`Not logged in`);
            const { body } = await this.doRequest('https://steamcommunity.com/market/createbuyorder/', {
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
            if (body.success === 1) {
                return;
            } else if (body.success === 25) {
                throw new Error(`Maximum order amount exceeded`);
            } else if (body.success === 29) {
                throw new Error(`Order already exists`);
            }
        } catch (err) {
            throw new Error(`Can't create buy order: ${err}`);
        }
    }

    /**(работа с тп) Удалить запрос на покупку */
    async cancelBuyOrder(orderid: number) {
        try {
            const cookies = this.getCookies("steamcommunity.com");

            const { body } = await this.doRequest('https://steamcommunity.com/market/cancelbuyorder/', {
                method: 'POST',
                headers: {
                    "Referer": `https://steamcommunity.com/market/`,
                    "Referrer-Policy": "strict-origin-when-cross-origin"
                },
                form: {
                    sessionid: cookies.sessionid.value,
                    buy_orderid: orderid
                }
            });
            if (body.success != 1) {
                throw new Error(body);
            }
        } catch (err) {
            throw new Error(`Can't cancel buy order #${orderid}: ${err}`);
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
            const { body } = await this.doRequest(
                `https://steamcommunity.com/market/listings/730/${encodeURIComponent(market_hash_name)}`,
                {

                },
                { isJsonResult: false, useSavedCookies: options?.withLogin === true, customProxy: options?.proxy }
            );
            const pos1 = body.indexOf("var line1=", 0) + "var line1=".length;
            const pos2 = body.indexOf(';', pos1);
            const arr: [string, number, string][] = JSON.parse(body.slice(pos1, pos2));
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

    /**(работа с тп) Подгрузка nameid со стима. Довольно ресурсоёмкая операция, поэтому следует минимизировать её использование 
     * @param market_hash_name - полное название предмета
    */
    async getSkinNameid(market_hash_name: string, options?: {
        /**прокси в формате http://username:password@ip:port, через который пройдет запрос (он будет приоритетнее, чем тот, который передан в конструктор класса) */
        proxy?: string,
        /**Использовать ли куки аккаунта в запросе */
        withLogin?: boolean
    }) {
        try {
            const { body } = await this.doRequest(`https://steamcommunity.com/market/listings/730/${encodeURIComponent(market_hash_name)}`, {}, {
                customProxy: options?.proxy,
                useSavedCookies: options?.withLogin === true
            });
            const startPos = body.indexOf('Market_LoadOrderSpread( ') + 'Market_LoadOrderSpread( '.length;
            const endPos = body.indexOf(' )', startPos);
            const nameid = Number(body.slice(startPos, endPos));
            if (!nameid) throw new Error(`nameid not found in page`);
            return nameid;
        } catch (err) {
            throw new Error(`Can't get skins nameid: ${err}`);
        }
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
            const { body } = await this.doRequest(
                `https://steamcommunity.com/market/itemordershistogram?country=RU&language=russian&currency=5&item_nameid=${nameid}&two_factor=0`,
                {},
                { useSavedCookies: options?.withLogin === true, customProxy: options?.proxy }
            );
            if (body.success === 1) {
                return {
                    lowest_sell_order: Number(body.lowest_sell_order) / 100,
                    highest_buy_order: Number(body.highest_buy_order) / 100
                }
            } else {
                throw new Error(body);
            }
        } catch (err) {
            throw new Error(`Can't get skin orders: ${err}`);
        }
    }
    /**(работа с тп) Возвращает список выставленных ордеров на покупку на торговой площадке */
    async getMyBuyOrders() {
        try {
            const { body } = await this.doRequest(`https://steamcommunity.com/market/mylistings`);
            const html: string = body.results_html;
            if (!html || typeof (html) != 'string') throw new Error(`steam don't return orders data (1)`);
            let pos = html.indexOf('my_listing_section market_content_block market_home_listing_table');
            if (pos === -1) throw new Error(`steam don't return orders data (1)`);

            const buyOrders: BuyOrder[] = [];
            while (true) {
                if (html.indexOf(`id="mybuyorder_`, pos) === -1) break;
                const orderidStartPos = html.indexOf(`id="mybuyorder_`, pos) + `id="mybuyorder_`.length;
                const orderidEndPos = html.indexOf(`"`, orderidStartPos);

                const quantityStartPos = html.indexOf(`market_listing_inline_buyorder_qty">`, pos) + `market_listing_inline_buyorder_qty">`.length;
                const quantityEndPos = html.indexOf(`@`, quantityStartPos);

                const priceStartPos = html.indexOf(`</span>`, quantityEndPos) + `</span>`.length;
                const priceEndPos = html.indexOf(`</span>`, priceStartPos);

                const mhnStartPos = html.indexOf(`market_listing_item_name_link`, priceEndPos) + `market_listing_item_name_link`.length;
                const mhnMiddlePos = html.indexOf('>', mhnStartPos) + '>'.length;
                const mhnEndPos = html.indexOf(`</a>`, mhnMiddlePos);

                const gameidStartPos = html.indexOf(`https://steamcommunity.com/market/listings/`, mhnStartPos) + `https://steamcommunity.com/market/listings/`.length;
                const gameidEndPos = html.indexOf('/', gameidStartPos);

                const orderid = Number(html.slice(orderidStartPos, orderidEndPos));
                const quantity = Number(html.slice(quantityStartPos, quantityEndPos));
                const priceData = html.slice(priceStartPos, priceEndPos);
                const price = Number(priceData.split(' ')[0].trim().replaceAll(' ', '').replaceAll(',', '.'));
                const currency = priceData.split(' ')[1].trim();
                const mhn = html.slice(mhnMiddlePos, mhnEndPos);
                const gameid = Number(html.slice(gameidStartPos, gameidEndPos));

                pos = quantityEndPos;
                buyOrders.push({
                    id: orderid,
                    quantity,
                    price,
                    currency,
                    market_hash_name: mhn,
                    gameid
                });
            }
            return buyOrders;
        } catch (err) {
            throw new Error(`Can't get my buy orders: ${err}`);
        }
    }
}

export default Steam;