import Base from "./Base.js";
import { AuthentificationParams, BuyOrder, ConstructorOptions, Cookie, CreateBuyOrderParams } from "./interfaces.js";
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
    /**Получение параметров для авторизации на каком-то сервисе через Steam
     * @param link - ссылка на авторизацию в Steam, на которую пересылает сервис
    */
    private getLoginFormData;
    private openidLogin;
    /**Авторизоваться на каком-либо сайте через Steam. Отдаётся ссылка, при переходе по которой устанавливаются куки авторизации
     * для разных сайтов нужны разные параметры для запроса, чтобы из этой ссылки получить хорошие куки, где-то надо просто установить Referer,
     * а где-то придется знатно потанцевать с бубном
    */
    getServiceAuthirizationLink(link: string): Promise<any>;
    /**(основной метод) Пройти авторизацию в Steam (получить доступ к аккаунту) */
    authorization(params: AuthentificationParams): Promise<string[]>;
    /**(метод аккаунта) получения баланса аккаунта (в установленной валюте)*/
    getBalance(): Promise<{
        currency: string;
        balance: number;
    }>;
    /**(работа с тп) Поставить запрос на покупку предмета */
    createBuyOrder(params: CreateBuyOrderParams): Promise<void>;
    /**(работа с тп) Удалить запрос на покупку */
    cancelBuyOrder(orderid: number): Promise<void>;
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
    /**(работа с тп) Подгрузка nameid со стима. Довольно ресурсоёмкая операция, поэтому следует минимизировать её использование
     * @param market_hash_name - полное название предмета
    */
    getSkinsNameid(market_hash_name: string, options?: {
        /**прокси в формате http://username:password@ip:port, через который пройдет запрос (он будет приоритетнее, чем тот, который передан в конструктор класса) */
        proxy?: string;
        /**Использовать ли куки аккаунта в запросе */
        withLogin?: boolean;
    }): Promise<number>;
    /**(работа с тп) Возвращает максимальный и минимальный рыночный зарос на определенный предмет торговой площадки
     * Возвращает истинное значение. Например: 123.32 рубля (на 100 ничего не умножается)
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
    /**(работа с тп) Возвращает список выставленных ордеров на покупку на торговой площадке */
    getMyBuyOrders(): Promise<BuyOrder[]>;
}
export default Steam;
