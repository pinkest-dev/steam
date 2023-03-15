import { OptionsOfTextResponseBody } from "got";
import { ConstructorOptions, Cookie } from "./interfaces.js";
declare class Base {
    private proxy;
    private cookies;
    private userAgent;
    constructor(options?: ConstructorOptions);
    setCookies(domen: string, cookies: {
        [cookieName: string]: Cookie;
    }): void;
    getAllDomens(): string[];
    getCookies(domen?: string): {
        [cookieName: string]: Cookie;
    } | {
        [domen: string]: {
            [cookieName: string]: Cookie;
        };
    };
    clearCookies(domen?: string): void;
    /**Метод для превращения объекта красивых куков в строку, которую можно уже использовать в запросе */
    protected static PackCookiesToString(cookies: {
        [cookieName: string]: Cookie;
    }): string;
    /**Метод для превращения строки куков в объект
     * Важное примечание: строка, которая передается в метод должна содержать лишь одну куку и её свойства (вызывается, когда приходят куки в set-cookie)
    */
    protected static ParseCookiesString(cookieStr: string): Cookie;
    /**Установка массива куков, куки должны браться из set-cookie */
    protected setDirtyCookies(domen: string, cookies: string[]): void;
    /**Универсальная функция для запроса */
    protected doRequest(url: string, requestOptions?: OptionsOfTextResponseBody, options?: {
        /**Ответ сервера в формате json? */
        isJsonResult?: boolean;
        /**Использовать ли прокси, установленный в конструкторе класса? Если параметр не передается, то прокси используется */
        useDefaultProxy?: boolean;
        /**Использовать ли сохраненные в оперативной памяти куки? */
        useSavedCookies?: boolean;
        /**Использовать ли на этот запрос отдельный прокси? Этот параметр перекрывает дефолтный прокси */
        customProxy?: string;
    }): Promise<any>;
    private getProxyAgent;
}
export default Base;
