import Base from "request-base";

class Test extends Base {
    static Run() {
        const cookies = Base.ParseCookiseString('_gcl_au=1.1.742946780.1676477447; _ga=GA1.1.2057668327.1676477447; intercom-id-cp3xwlag=527b50cc-c61b-452d-9ab3-742c734c250a; intercom-device-id-cp3xwlag=62bfcce8-ec42-4dc7-a212-608f14693c92; ss_id=4cf4e33993e6e6df5b45f473e7c89dd4856cf27c362e88d714117199562647fc; lang=ru; role=user; site_appid=252490; user_sort=price-desc; user_appid=252490; cf_clearance=EXwkuoZ9gynyDNyC6etUWKB_q8088T..nfaP3AC5kdc-1678902130-0-160; __cf_bm=STs.tiLoABPMtdXMGAiVcSC3CDd8KmTedjgzE4xCDhQ-1678902133-0-AU1+OpfGVM+gr6bIdwMYYBwDAm39Un58DqfIGC4BAsPtWaO9rtWrO9kL+vIA8wibyB79SYHRhB2+NvMIydWZ5MjHQSp0WtYIRXO9K0qB5OIEWzzIENXxSNeMx2srM6ETMA==; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc2NTYxMTk4MzE0MTIyNTQxIiwicm9sZSI6InVzZXIiLCJleHBpcmF0aW9uIjoxNjc5NTA2OTM4MTA0LCJpYXQiOjE2Nzg5MDIxMzh9.1qM9cjYRYUq8sxzVOcf52TKildG0rOiIlqwPWoglGCM; intercom-session-cp3xwlag=YnNGc29LYVdOTXRKVWJMMkl2RVNqMjBidU5FRHVJMVFBdXBvMlB0QXRocEplUENvQ2QwUnlnQytaVUt0M3FEZC0td1hDdlR6MndMU29DTHRSbEVFV3Q2dz09--8192e87e7951de508fc457a80bdaa1a3c8c1edf6; site_sort=price-asc; _ga_K36J05WMHB=GS1.1.1678902131.14.1.1678902270.0.0.0')
        console.log(cookies);
    }
}

Test.Run();