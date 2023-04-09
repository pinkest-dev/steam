import Steam from "../Steam.js";
import PopularDomens from "../Enums/PopularDomens.js";
import cookies from "./cookies.js";

const steam = new Steam();
const savedCookeis = await cookies.readCookies();

steam.setCookies(PopularDomens["steamcommunity.com"], savedCookeis);

const link = await steam.getServiceAuthirizationLink("https://steamcommunity.com/openid/login?openid.mode=checkid_setup&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.return_to=https%3A%2F%2Fswapauth.com%2Fauth%2Fverify&openid.realm=https%3A%2F%2Fswapauth.com");
console.log(link);
//=> https://swapauth.com/auth/verify?openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0&openid.mode=id_res&openid.op_endpoint=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Flogin&openid.claimed_id=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F76561198295390138&openid.identity=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F76561198295390138&openid.return_to=https%3A%2F%2Fswapauth.com%2Fauth%2Fverify&openid.response_nonce=2023-03-15T14%3A04%3A12ZekvG6h%2F%2FKBGxD1JbtbRDFXwTZQk%3D&openid.assoc_handle=1234567890&openid.signed=signed%2Cop_endpoint%2Cclaimed_id%2Cidentity%2Creturn_to%2Cresponse_nonce%2Cassoc_handle&openid.sig=jldKBk%2FclGV8UaB8Av20tMmc%2BGw%3D