import Base from "./Base.js";
import { AuthentificationParams, ConstructorOptions, Cookie, CreateBuyOrderParams } from "./interfaces.js";
declare class Steam extends Base {
    constructor(options?: ConstructorOptions);
    private getClientJsToken;
    /**Получить статус авторизации. Проверить авторизованы ли мы сейчас в Steam? Действительны ли наши куки*/
    isAuthorized(): Promise<boolean>;
    /**Получить статус авторизации у произвольных куков*/
    static CheckCookiesSession(accountName: string, cookies: {
        [cookieName: string]: Cookie;
    }): Promise<boolean>;
    private getRsaKey;
    private doLogin;
    private generateSessionID;
    private bufferizeSecret;
    /**(основные методы) Сгенерировать 5-значный вход для входа в аккаунт. shared_secret - код из maFile*/
    generateTwoFactorCode(shared_secret: string): string;
    /**openidMode - можно достать со страницы входа в Steam аккаунт
     * https://steamcommunity.com/openid/login?openid.mode= - нужно скопировать строку, которая идёт далее
     * На эту страницу можно попасть, нажав на нужном сайте кнопку ВОЙТИ ЧЕРЕЗ STEAM
    */
    private getNonce;
    /**Авторизоваться на каком-либо сайте через Steam. Отдаётся ссылка, при переходе по которой устанавливаются куки авторизации*/
    serviceAuthorization(openidMode: string): Promise<void>;
    /**(основной метод) Пройти авторизацию в Steam (получить доступ к аккаунту) */
    authorization(params: AuthentificationParams): Promise<string[]>;
    /**(метод аккаунта) получения баланса аккаунта (в установленной валюте)*/
    getBalance(): Promise<{
        currency: string;
        balance: number;
    }>;
    /**(работа с тп) Поставить запрос на покупку предмета */
    createBuyOrder(params: CreateBuyOrderParams): Promise<void>;
    /**(работа с тп) Возвращает все точки на графике определенного предмета торговой площадки, отображаемые в Steam [date, price, quantity][] В ДОЛЛАРАХ США!
     * @param market_hash_name - полное название предмета
     * @param options - настройки запроса
    */
    getSkinSales(market_hash_name: string, options?: {
        /**прокси в формате http://username:password@ip:port, через который пройдет запрос (он будет приоритетнее, чем тот, который передан в конструктор класса) */
        proxy?: string;
        /**Использовать ли куки аккаунта в запросе */
        withLogin?: boolean;
    }): Promise<[Date, number, number][]>;
    /**(НЕ РАБОТАЕТ) Подгрузка nameid со стима. Довольно ресурсоёмкая операция, поэтому следует минимизировать её использование
     * @param market_hash_name - полное название предмета
    */
    parseNameid(market_hash_name: string): Promise<void>;
    /**(работа с тп) Возвращает максимальный и минимальный рыночный зарос на определенный предмет торговой площадки
     * @param market_hash_name - полное название предмета
     * @param options - настройки запроса
    */
    getSkinOrders(nameid: number, options?: {
        /**прокси в формате http://username:password@ip:port, через который пройдет запрос (он будет приоритетнее, чем тот, который передан в конструктор класса) */
        proxy?: string;
        /**Использовать ли куки аккаунта в запросе */
        withLogin?: boolean;
    }): Promise<{
        lowest_sell_order: number;
        highest_buy_order: number;
    }>;
}
export default Steam;
