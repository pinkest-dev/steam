import Base from "request-base";
import crypto from "crypto";
//@ts-ignore
import { hex2b64, Key } from "node-bignumber";
import { UINT64 } from "cuint";
import { AuthentificationParams, BuyOrder, ClientJsToken, Confirmation, ConstructorOptions, Cookie, CreateBuyOrderParams, DoLoginParams, Inventory, InventoryItem, Offer, RawInventory, RsaKey, TradeItem } from "./interfaces.js";
import got from "got";
import PopularDomens from "./Enums/PopularDomens.js";
import cheerio from "cheerio";

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

    getMySteamid64() {
        const cookies = this.getCookies("steamcommunity.com");
        for (var cookieName in cookies) {
            if (cookieName.includes("steamMachineAuth")) {
                return cookieName.replace("steamMachineAuth", '');
            }
        }
        throw new Error("No Steamid in cookies");
    }

    async getConfirmations(identity_secret: string) {
        try {
            const time = Math.ceil(Number(new Date()) / 1000);

            const { body, requestOptions } = await this.doRequest(`https://steamcommunity.com/mobileconf/conf`, {
                headers: {
                    'User-Agent': `Android`
                },
                searchParams: {
                    p: this.getDeviceId(),
                    a: this.getMySteamid64(),
                    k: this.getConfirmationKey(identity_secret, time, "conf"),
                    t: time,
                    m: `android`,
                    tag: `conf`,
                }
            },
                {
                    isJsonResult: false
                }
            );

            let $ = cheerio.load(body);
            let empty = $('#mobileconf_empty');
            if (empty.length > 0) {
                if (!$(empty).hasClass('mobileconf_done')) {
                    // An error occurred
                    throw new Error(`No content`);
                }
                // nothingToConfirm
                return []
            }

            // We have something to confirm
            let confirmations = $('#mobileconf_list');
            if (!confirmations) {
                throw new Error(`Malform response`);
            }

            let confs: Confirmation[] = [];
            Array.prototype.forEach.call(confirmations.find('.mobileconf_list_entry'), (conf) => {
                conf = $(conf);
                let img = conf.find('.mobileconf_list_entry_icon img');
                confs.push({
                    id: conf.data('confid'),
                    type: conf.data('type'),
                    creator: conf.data('creator'),
                    key: conf.data('key'),
                    title: conf.find('.mobileconf_list_entry_description>div:nth-of-type(1)').text().trim(),
                    receiving: conf.find('.mobileconf_list_entry_description>div:nth-of-type(2)').text().trim(),
                    time: conf.find('.mobileconf_list_entry_description>div:nth-of-type(3)').text().trim(),
                    icon: img.length < 1 ? '' : $(img).attr('src'),
                });
            })

            return confs;
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Accept confirmation error: ${message}`);
        }
    }

    /* НЕ РАБОТАЕТ! ПОЧИНИТЬ!*/
    async acceptManyConfirmations(cid: number[], cKey: string[], identity_secret: string) {
        try {
            if (!this.getMySteamid64() || !identity_secret) {
                throw new Error("Must have steamid+identity_secret before to do anything with confirmations");
            }

            let time = Math.floor(Date.now() / 1000);

            const { body, requestOptions } = await this.doRequest(`https://steamcommunity.com/mobileconf/multiajaxop`, {
                method: "POST",
                headers: {
                    "User-Agent": "Android",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": `https://steamcommunity.com/mobileconf/multiajaxop`
                },
                form: {
                    op: "allow",
                    cid: cid,
                    ck: cKey,
                    p: this.getDeviceId(),
                    a: this.getMySteamid64(),
                    k: this.getConfirmationKey(identity_secret, time, 'allow'),
                    t: time,
                    m: `android`,
                    tag: `allow`,
                }
            })
            console.log(requestOptions);
            console.log(body);
            if (!body.success) {
                throw new Error(`Not confirmed ${body.error}`);
            }
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Accept confirmation error: ${message}`);
        }
    }

    async acceptConfirmation(cid: number, cKey: string, identity_secret: string) {
        try {
            if (!this.getMySteamid64() || !identity_secret) {
                throw new Error("Must have steamid+identity_secret before to do anything with confirmations");
            }

            let time = Math.floor(Date.now() / 1000);

            const { body, requestOptions } = await this.doRequest(`https://steamcommunity.com/mobileconf/ajaxop`, {
                headers: {
                    "User-Agent": "Android"
                },
                searchParams: {
                    op: "allow",
                    cid: cid as any,
                    ck: cKey as any,
                    p: this.getDeviceId(),
                    a: this.getMySteamid64(),
                    k: this.getConfirmationKey(identity_secret, time, 'allow'),
                    t: time,
                    m: `android`,
                    tag: `allow`,
                }
            })
            if (!body.success) {
                throw new Error(`Not confirmed ${body.error}`);
            }
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Accept confirmation error: ${message}`);
        }
    }

    getConfirmationKey(identity_secret: string, time: number, tag: string) {
        try {
            let data_len = 8;

            if (tag)
                if (tag.length > 32)
                    data_len += 32;
                else
                    data_len += tag.length;

            let buffer = Buffer.allocUnsafe(data_len);

            if (buffer.writeBigUInt64BE) {
                buffer.writeBigUInt64BE(BigInt(time), 0);
            } else {
                buffer.writeUInt32BE(0, 0)
                buffer.writeUInt32BE(time, 4);
            }

            if (tag)
                buffer.write(tag, 8);

            let hmac = crypto.createHmac('sha1', this.bufferizeSecret(identity_secret));
            return hmac.update(buffer).digest('base64');
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Get confirmation key error: ${message}`);
        }
    }

    getDeviceId() {
        return (
            'android:' +
            crypto
                .createHash('sha1')
                .update(this.getMySteamid64() + ``)
                .digest('hex')
                .replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12}).*$/, '$1-$2-$3-$4-$5')
        )
    }

    cancelConfirmation() {
        try {

        } catch (err) {

        }
    }

    async getInventory(steamid: string, appid: number, contextid: string, options?: {
        proxy?: string
    }): Promise<Inventory> {
        try {
            const { body } = await this.doRequest(`https://steamcommunity.com/inventory/${steamid}/${appid}/${contextid}`, {
                timeout: {
                    response: 10000,
                    request: 10000
                }
            }, { customProxy: options?.proxy });
            if (body.success) {
                if (body.total_inventory_count == 0) {
                    return [];
                }
                const inventory: Inventory = [];
                const rawInventory: RawInventory = body;
                const assets = rawInventory.assets;
                const descriptions = rawInventory.descriptions;

                for (let i = 0; i < assets.length; i++) {
                    const currentAsset = assets[i];
                    for (let j = 0; j < descriptions.length; j++) {
                        if (currentAsset.classid === descriptions[j].classid) {
                            const item: InventoryItem = {
                                ...assets[i],
                                tradable: descriptions[j].tradable,
                                market_hash_name: descriptions[j].market_hash_name
                            }
                            inventory.push(item);
                        }
                    }
                }
                return inventory;
            } else {
                throw new Error(body.error);
            }
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Get inventory error: ${message}`);
        }
    }

    async sendTrade(tradeurl: string, myItems: TradeItem[], partnerItems: TradeItem[], message?: string): Promise<string> {
        try {
            //https://steamcommunity.com/tradeoffer/new/?partner=1025103026&token=cNxaf2qH
            const token = tradeurl.match(/token=[0-9a-zA-Z]*/g)![0].replace("token=", '');
            const partner = tradeurl.match(/partner=[0-9a-zA-Z]*/g)![0].replace("partner=", '');
            const steamCookies = this.getCookies("steamcommunity.com");
            const sessionid = steamCookies.sessionid;

            const newMyItems: any[] = [];

            for (var i of myItems) {
                newMyItems.push({
                    assetid: i.assetid,
                    appid: i.appid,
                    contextid: i.contextid,
                    amount: i.amount
                });
            }

            if (!sessionid) {
                throw new Error("Not logged in");
            }

            const { body, requestOptions } = await this.doRequest(`https://steamcommunity.com/tradeoffer/new/send`, {
                method: 'POST',
                headers: {
                    Referer: "https://steamcommunity.com/tradeoffer/new",
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                },
                form: {
                    sessionid: sessionid.value,
                    serverid: 1,
                    partner: this.getSteamID64fromAccountID(partner),
                    tradeoffermessage: message || "",
                    json_tradeoffer: JSON.stringify({
                        newversion: true,
                        version: myItems.length + partnerItems.length + 1,
                        me: { assets: newMyItems, currency: [], ready: false },
                        them: { assets: partnerItems, currency: [], ready: false }
                    }),
                    captcha: "",
                    trade_offer_create_params: JSON.stringify({ trade_offer_access_token: token })
                }
            });

            return body.tradeofferid;
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Send trade error: ${message}`);
        }
    }

    getSteamID64fromAccountID(id: string) {
        return new UINT64(+id, (1 << 24) | (1 << 20) | 1).toString()
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`Check cookies active status error: ${message}`);
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`Get rsa key error: ${message}`);
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`doLogin error: ${message}`);
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`Bufferize secret error: ${message}`);
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`Generate auth code error: ${message}`);
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`Get nonceid error: ${message}`);
        }
    }

    private async openidLogin(link: string, nonce: string, openid: string) {
        try {
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
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Openid login error: ${message}`);
        }
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`Service authorization error: ${message}`);
        }
    }

    async getReceivedOffers(steamApikey: string): Promise<Offer[]> {
        try {
            const { body } = await this.doRequest(`https://api.steampowered.com/IEconService/GetTradeOffers/v1?key=${steamApikey}&get_received_offers=1&language=en&active_only=1`);

            if (!body || !body.response || !body.response.trade_offers_received) throw new Error(`no content`);
            return body.response.trade_offers_received;
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Get received offers error: ${message}`);
        }
    }

    async acceptTrade(offer: Offer): Promise<string> {
        try {
            const cookies = this.getCookies(PopularDomens["steamcommunity.com"]);
            if (!cookies.sessionid) throw new Error(`Not logged in`);

            const { body, requestOptions } = await this.doRequest(`https://steamcommunity.com/tradeoffer/${offer.tradeofferid}/accept`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    Referer: `https://steamcommunity.com/tradeoffer/${offer.tradeofferid}/`
                },
                form: {
                    sessionid: cookies.sessionid.value,
                    serverid: 1,
                    tradeofferid: +offer.tradeofferid,
                    partner: this.getSteamID64fromAccountID(String(offer.accountid_other)),
                    captcha: ''
                }
            });
            if (body.tradeid) return body.tradeid;
            throw new Error(body.strError);
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Get received offers error: ${message}`);
        }
    }

    async loginByMaFile() {

    }

    async oauthLogin() {

    }

    /**(основной метод) Залогиниться в Steam (получить доступ к аккаунту) */
    async login(params: AuthentificationParams) {
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`Steam authorization error: ${message}`);
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`Get balance error: ${message}`);
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`Buy order error: ${message}`);
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`Buy order error: ${message}`);
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`Get skin sales error: ${message}`);
        }
    }

    /**(работа с тп) Подгрузка nameid со стима. Довольно ресурсоёмкая операция, поэтому следует минимизировать её использование 
     * @param market_hash_name - полное название предмета
    */
    async getSkinsNameid(market_hash_name: string, gameid: number, options?: {
        /**прокси в формате http://username:password@ip:port, через который пройдет запрос (он будет приоритетнее, чем тот, который передан в конструктор класса) */
        proxy?: string,
        /**Использовать ли куки аккаунта в запросе */
        withLogin?: boolean
    }) {
        try {
            const { body } = await this.doRequest(`https://steamcommunity.com/market/listings/${gameid}/${encodeURIComponent(market_hash_name)}`, {}, {
                customProxy: options?.proxy,
                useSavedCookies: options?.withLogin === true,
                isJsonResult: false
            });
            const startPos = body.indexOf('Market_LoadOrderSpread( ') + 'Market_LoadOrderSpread( '.length;
            const endPos = body.indexOf(' )', startPos);
            const nameid = Number(body.slice(startPos, endPos));
            if (!nameid) throw new Error(`nameid not found in page`);
            return nameid;
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Get nameid error: ${message}`);
        }
    }

    /**(работа с тп) Возвращает максимальный и минимальный рыночный зарос на определенный предмет торговой площадки
     * Возвращает истинное значение. Например: 123.32 рубля (на 100 ничего не умножается)
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`get Skin orders error: ${message}`);
        }
    }

    /**(работа с тп) В основе этого метода лежит запрос, который в стиме используется для получения цены предмета в инвентаре*/
    async getSkinsPrice(market_hash_name: string, appid: number, options?: {
        /**прокси в формате http://username:password@ip:port, через который пройдет запрос (он будет приоритетнее, чем тот, который передан в конструктор класса) */
        proxy?: string,
        /**Использовать ли куки аккаунта в запросе */
        withLogin?: boolean
    }) {
        try {
            const { body } = await this.doRequest(
                `https://steamcommunity.com/market/priceoverview/?country=RU&currency=5&appid=${appid}&market_hash_name=${encodeURIComponent(market_hash_name)}`,
                {},
                { useSavedCookies: options?.withLogin === true, customProxy: options?.proxy }
            );
            if (body.success) {
                return {
                    lowest_price: Number(body.lowest_price.split(' ')[0].replace(',', '.')),
                    currency: body.lowest_price.split(' ')[1],
                    volume: Number(body.volume.replace(',', '')),
                    median_price: Number(body.median_price.split(' ')[0].replace(',', '.'))
                }
            } else {
                throw new Error(body);
            }
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Get skins price error: ${message}`);
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
            const message = (err as any).message || "Unknown error";
            throw new Error(`Get buy orders error: ${message}`);
        }
    }

    /**(работа с тп) Получить выставленные на тп предметы (определенная страница определенного скина). Получает сразу 100 лотов */
    async getListings(market_hash_name: string, appid: number, pageNumber: number, currency: number, options?: {
        /**прокси в формате http://username:password@ip:port, через который пройдет запрос (он будет приоритетнее, чем тот, который передан в конструктор класса) */
        proxy?: string,
        /**Использовать ли куки аккаунта в запросе */
        withLogin?: boolean
    }): Promise<{
        assetid: string;
        listingid: string;
        link: string;
        price: number;
        subtotal: number;
        fee: number;
    }[]> {
        try {
            console.log(`https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(market_hash_name)}/render/?query=&start=${(pageNumber * 100).toFixed(0)}&count=${100}&currency=${currency}`);
            const { body } = await this.doRequest(`https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(market_hash_name)}/render/?query=&start=${(pageNumber * 100).toFixed(0)}&count=${100}&currency=${currency}`, {

            }, {
                useSavedCookies: options?.withLogin,
                customProxy: options?.proxy
            });
            const results: any[] = [];
            console.log(body);
            const listinginfo = body.listinginfo;
            for (var listingid in listinginfo) {
                const assetid = listinginfo[listingid].asset.id;
                const link = listinginfo[listingid].asset.market_actions[0].link;
                const price = listinginfo[listingid].converted_price + listinginfo[listingid].converted_fee;
                const fee = listinginfo[listingid].converted_fee;
                results.push({
                    listingid,
                    assetid,
                    link,
                    price,
                    subtotal: listinginfo[listingid].converted_price,
                    fee
                });
            }
            return results;
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Get listings error: ${message}`);
        }
    }

    /**(работа с тп) Купить определённый скин на торговой площадке
     * listingid - айди лота на торговой площадке
     * price - полная цена предмета
     * fee - комиссия
     */
    async buyListing(listingid: string, appid: number, market_hash_name: string, currency: number, price: number, fee: number) {
        try {
            const cookies = this.getCookies(PopularDomens["steamcommunity.com"]);
            if (!cookies.sessionid) throw new Error(`Not logged in`);
            const { body, statusCode } = await this.doRequest(`https://steamcommunity.com/market/buylisting/${listingid}`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    cookie: ``,
                    Referer: `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(market_hash_name)}`
                },
                form: {
                    sessionid: cookies.sessionid.value,
                    currency,
                    subtotal: price - fee,
                    fee,
                    total: price,
                    quantity: 1,
                    save_my_adress: 0
                }
            });
            console.log(body, statusCode);
            if (!body.wallet_info) {
                throw new Error(body);
            }
        } catch (err) {
            const message = (err as any).message || "Unknown error";
            throw new Error(`Buy listing error: ${message}`);
        }
    }
}

export default Steam;