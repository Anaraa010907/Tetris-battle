# Khan Blocks: орлого (зар ба худалдан авалт)

Энэ баримт тоглоомын зар (AdMob), Google Play-ийн худалдан авалт, тэдгээрийг сервер дээр шалгах хэсэг хэрхэн ажилладаг, мөн эзэмшигч юу тохируулахыг тайлбарлана. Хувилбар, бодлогыг **2026 оны 11-р сарын 16-ны** байдлаар шалгасан. Эх сурвалжийг хамгийн доор жагсаасан.

## Агуулга

0. [Хамгийн түрүүнд мэдэх зүйл: Монгол дахь худалдан авалт](#0-хамгийн-түрүүнд-мэдэх-зүйл-монгол-дахь-худалдан-авалт)
1. [Тоглоомд юу байгаа вэ](#1-тоглоомд-юу-байгаа-вэ)
2. [Зарын дүрэм](#2-зарын-дүрэм)
3. [Бүтээгдэхүүн ба санал болгох үнэ](#3-бүтээгдэхүүн-ба-санал-болгох-үнэ)
4. [Хэрхэн ажилладаг вэ](#4-хэрхэн-ажилладаг-вэ)
5. [Play Console: бүтээгдэхүүн үүсгэх](#5-play-console-бүтээгдэхүүн-үүсгэх)
6. [AdMob: бүртгэл, жинхэнэ ID-г GitHub secret болгох](#6-admob-бүртгэл-жинхэнэ-id-г-github-secret-болгох)
7. [Зөвшөөрлийн мессеж (UMP, Европ)](#7-зөвшөөрлийн-мессеж-ump-европ)
8. [Supabase: migration, Edge Function, secret](#8-supabase-migration-edge-function-secret)
9. [Туршилт](#9-туршилт)
10. [Бодлого ба Data safety](#10-бодлого-ба-data-safety)
11. [App Store (дараа)](#11-app-store-дараа)
12. [Шалгах жагсаалт](#12-шалгах-жагсаалт)
13. [Юуг шалгаж чадаагүй вэ](#13-юуг-шалгаж-чадаагүй-вэ)
14. [Эх сурвалж](#14-эх-сурвалж)

---

## 0. Хамгийн түрүүнд мэдэх зүйл: Монгол дахь худалдан авалт

Google Play-ийн тусламжийн хуудсанд **Монгол «Rest of the world» ангилалд** багтдаг. Тэр ангиллын хэрэглэгчид үнэгүй апп татаж болох ч **«Make Google Play purchases»: ✘**, өөрөөр хэлбэл төлбөртэй апп, апп доторх худалдан авалт хийх боломжгүй гэж бичсэн (хуудасны хувилбар 2023/02). Төлбөртэй апп худалдаалагддаг улсын жагсаалтад ч Монгол байхгүй.

Үүний утга:

- Google Play бүртгэлийнх нь улс Монгол бол тоглогч зоосны багц, «Зар хасах»-ыг **худалдаж авч чадахгүй** байх магадлалтай. Тоглоом үүнийг харгалзсан: Play бүтээгдэхүүнээ буцаахгүй бол дэлгүүрийн хэсэг «Таны Google Play-н улсад одоогоор худалдан авалт хийх боломжгүй байна» гэж бичээд товчнуудыг идэвхгүй болгоно.
- **Монголд орлогын гол эх үүсвэр нь зар** (AdMob) болно. Зар Монголд харагдана.
- Худалдан авалт өөр улсын Play бүртгэлтэй тоглогчдод (гадаадад байгаа монголчууд, бусад улсын тоглогчид) ажиллана.
- Монголд суурилсан хөгжүүлэгч Google Play-д merchant болж (төлбөр хүлээн авах) бүртгүүлж болно: тусламжийн хүснэгтэд Монгол merchant бүртгэлд ✔, хөгжүүлэгчийн анхдагч валют **USD**.
- Play Console-д үнэ тохируулахдаа улсын жагсаалтад Монгол гарч байгаа эсэхийг хараарай. Гарч байвал Google нөхцөлөө өөрчилсөн гэсэн үг (тусламжийн хуудас 2023 онд шинэчлэгдсэн).

---

## 1. Тоглоомд юу байгаа вэ

| Хэсэг | Хаана | Юу хийдэг | Зөвхөн Android аппад |
| --- | --- | --- | --- |
| **Шагналтай зар: «Зар үзээд +30 зоос ав»** | Дэлгүүр («Зоос ба нэмэлт» хэсэг) | Тоглогч өөрөө дарж богино видео үзнэ, дуустал үзвэл 30 зоос. Өдөрт 5 удаа | ✔ |
| **Шагналтай зар: «Зар үзээд зоосоо 2 дахин»** | Дүнгийн дэлгэц (бэлтгэл, ботой тоглолтын дараа, зоос авсан бол) | Тухайн тоглолтоор авсан зоосыг дахин нэг удаа өгнө (дээд тал нь 150). Тоглолт бүрд нэг удаа, өдөрт 10 | ✔ |
| **Тоглолт хоорондын зар (interstitial)** | Бэлтгэл, ботой тоглолтын дүнгийн дэлгэц гарсны дараа | 2-р хэсгийн дүрмээр ховор гарна. Онлайн, найзтай тоглолтод хэзээ ч гарахгүй | ✔ |
| **Зар хасах (remove_ads)** | Дэлгүүр | Нэг удаа худалдаж авна: тоглолт хоорондын зар бүрмөсөн алга болно. Шагналтай зар хүсвэл үзэх боломжтой хэвээр | ✔ |
| **Зоосны багц** | Дэлгүүр | 500 / 1,200 / 3,500 зоос | ✔ |
| **Улирлын пасс (pass_s1 гэх мэт)** | Пассын дэлгэц (progression хэсэг) | Premium замыг нээнэ. Худалдан авалтыг энэ хэсэг (`Store.buy`) хийдэг | ✔ |
| «Худалдан авалтаа сэргээх» | Дэлгүүр | Google Play дээрх худалдан авалтаа энэ бүртгэлд буцааж авна | ✔ |
| «Нууцлал ба зарын сонголт» | Тохиргоо | Зөвшөөрлөө өөрчлөх UMP цонх. Хуулиар шаардлагатай үед л (Европ гэх мэт) харагдана | ✔ |

Энгийн хөтчид (вэб хувилбар) зар, худалдан авалт огт байхгүй: дэлгүүрт «Зоосны багц, «Зар хасах»-ыг утасны аппаас Google Play-ээр худалдаж авна» гэсэн тайлбар л харагдана.

Зар WebView дотор биш, AdMob-ийн өөрийн цонхоор (native) гарна. Тиймээс хуудасны CSP өөрчлөгдөөгүй, гадны скрипт ачаалагдахгүй.

---

## 2. Зарын дүрэм

Тоглолт хоорондын зар (`onMatchEnd`, `src/js/55-store.js`) дараах **бүх** нөхцөл биелсэн үед л гарна:

| Дүрэм | Утга |
| --- | --- |
| Тоглолтын төрөл | Зөвхөн бэлтгэл (AI) ба ботой rank тоглолт. **Онлайн ба найзтай тоглолтод хэзээ ч үгүй** (тоолохгүй ч) |
| Худалдан авалт | «Зар хасах» эсвэл **ямар нэг юм худалдаж авсан** тоглогчид хэзээ ч үгүй |
| Шинэ тоглогч | Эхний **5 тоглолт** болон анх нээснээс хойш **24 цагийн** дотор үгүй |
| Давтамж | **3 тоглолт тутамд дээд тал нь 1** |
| Завсар | Өмнөх зараас хойш **дор хаяж 3 минут** |
| Шагналтай зарын дараа | Шагналтай зар үзсэнээс хойш **3 минутын дотор** үгүй |
| Хэзээ | Дүнгийн дэлгэц гарснаас 0.9 секундын дараа, тоглогч тэр дэлгэц дээр хэвээр, өөр цонх (тохиргоо, баярын дэлгэц) нээгээгүй үед. Дараагийн тоглолтыг эхлүүлчихсэн бол гаргахгүй |
| Зөвшөөрөл | UMP «зар хүсч болно» (`canRequestAds`) гэсэн үед л |

Шагналтай зар зөвхөн тоглогч товч дарсан үед гарна. Товч дээр шагнал нь бичигдсэн («+30 зоос», «2 дахин: +60»), «ЗАР» гэсэн шошготой. Дуустал үзээгүй бол шагналгүй гэж хэлнэ, тоглоомд өөр саад болохгүй. Энэ нь AdMob-ийн шагналтай зарын бодлого (сонголтоор үзэх, шагналыг урьдчилан хэлэх, заавал биш) болон тоглолт хоорондын зарын зааварт (логик завсарт, апп нээх/хаах үед биш, үйлдэл бүрийн дараа биш, урьдчилан ачаалах) нийцнэ.

Тоонуудыг `AD_RULES` (`src/js/55-store.js`) болон серверийн `claim_ad_reward`-аас өөрчилнө (хоёуланг нь).

---

## 3. Бүтээгдэхүүн ба санал болгох үнэ

Бүтээгдэхүүний ID-г **яг ингэж** үүсгэнэ (жижиг үсгээр). Код, сервер эдгээр ID-г л таньдаг.

| Product ID | Төрөл | Юу өгөх | Санал болгох үнэ (USD) | ≈ төгрөгөөр (лавлах) |
| --- | --- | --- | --- | --- |
| `coins_small` | consumable (дахин авч болно) | 500 зоос | $0.99 | ≈ 3,500₮ |
| `coins_medium` | consumable | 1,200 зоос | $1.99 | ≈ 7,100₮ |
| `coins_large` | consumable | 3,500 зоос | $4.99 | ≈ 17,800₮ |
| `remove_ads` | non-consumable (нэг удаа) | Тоглолт хоорондын зар алга | $2.99 | ≈ 10,700₮ |
| `pass_s1` | non-consumable | 1-р улирлын пасс (дараагийнх нь `pass_s2` гэх мэт, progression хэсгийн улирлын ID-тай ижил) | $3.99 | ≈ 14,200₮ |

- Төгрөгийн дүн 1 USD ≈ 3,570₮ (CEIC, 2025 оны 11-р сарын дундаж) ханшаар тооцсон лавлах тоо. Google Play Монголын худалдан авагчид MNT-ээр үнэ гаргадаггүй (0-р хэсгийг үз).
- Тоглоомын эдийн засагтай харьцуулбал: бэлтгэлд хожвол 60, хожигдвол 20 зоос, өдрийн шагнал 10–70, шагналтай зар 30, загвар 100 зоос (progression хэсгийн шинэ загварууд өөр үнэтэй байж болно). Багцын хэмжээг тоглоомын үнээс хамааруулж өөрчилж болно. Өөрчилбөл **гурван газар** зэрэг: `COIN_PACKS` (`src/js/55-store.js`), `sku_coins()` (шинэ migration), `PACKS` (`supabase/functions/_shared/play.mjs`).
- Play Console дээр «consumable/non-consumable» гэсэн тохиргоо байхгүй: апп зоосны багцыг **consume**, бусдыг **acknowledge** хийдгээр ялгагдана.
- Дэлгүүрт харагдах үнийг Google Play өөрөө (тоглогчийн улсын валютаар) өгдөг. Play-ийн бодлогоор апп доторх үнэ Play-ийн цонхтой таарах ёстой: тоглоом үнийг өөрөө бичдэггүй.

---

## 4. Хэрхэн ажилладаг вэ

```
Тоглоом (index.html)                      Android апп (android/)                 Сервер
src/js/55-store.js  ──KhanNative.post──▶  NativeBridge ─▶ BillingManager ─▶ Google Play
       ▲                                         └──────▶ AdsManager ─────▶ AdMob (UMP зөвшөөрлийн дараа)
       └──window.__khanNative(хариу)──────────────┘
       │
       └─(онлайн build) verify-purchase ─▶ Supabase Edge Function ─▶ Google Play Developer API
                         claim_ad_reward ─▶ SQL функц                └─▶ record_purchase (SQL)
```

**Худалдан авалт**

1. Тоглогч товч дарна → апп Google Play-ийн худалдан авах цонхыг нээнэ (`launchBillingFlow`). Онлайн build-д тоглогчийн Supabase ID-ийн SHA-256-г Play-д `obfuscatedAccountId` болгон дамжуулна.
2. Play «худалдаж авлаа» гэвэл:
   - **Онлайн build** (Supabase тохируулсан): тоглоом токеныг `verify-purchase` функц руу илгээнэ. Функц Google Play Developer API-аас (`purchases.productsv2`) токеныг шалгана: бүтээгдэхүүн таарч байна уу, төлөгдсөн үү (`PURCHASED`), өөр бүртгэлийнх биш үү. Тэгээд `record_purchase` нэг токенд нэг л удаа олгоно (зоос нэмэх эсвэл entitlement), дараа нь Google-д consume/acknowledge хийнэ. Тоглоом серверийн хариугаар профайл, entitlement-ээ солино.
   - **Офлайн build**: Play-ийн хариу баталгаа болно. Зоос, «Зар хасах»-ыг утсанд олгоод consume/acknowledge хийнэ.
3. Сервер хүрэх боломжгүй үед (онлайн build) худалдан авалтыг **дуусгахгүй**: Play түүнийг хадгална, тоглоом эхлэх бүрд болон дахин холбогдоход дахин илгээнэ. 3 хоногийн дотор баталгаажихгүй бол Google мөнгийг нь автоматаар буцаана (тоглогч хохирохгүй).
4. Төлбөр хүлээгдэж байвал (pending) юу ч олгохгүй. Төлөгдсөний дараа (апп ажиллаж байхад эсвэл дараагийн нээлтэд) олгоно.
5. Буцаалт (refund, chargeback): `voided-purchases` функц өдөр бүр Voided Purchases API-аас уншиж `revoke_purchase`-ээр entitlement-ийг хасна, зоосны багцынх бол тэр зоосыг буцааж авна (0-ээс доош оруулахгүй).

**Шагналтай зар**: AdMob «шагнал авлаа» гэсний дараа онлайн build-д `claim_ad_reward` (өдрийн хязгаар, нэг тоглолтод нэг удаа, 150-аас ихгүй, 10 секундээс ойр давтахгүй), офлайн build-д утсанд олгоно. Онлайн build интернэтгүй үед шагналыг шууд харуулаад дараа нь сервер рүү илгээнэ.

**Хүснэгтүүд** (`supabase/migrations/20261118000000_payments.sql`):

| Хүснэгт | Юу | Тоглогч |
| --- | --- | --- |
| `entitlements` | Эзэмшиж буй non-consumable (`remove_ads`, `pass_*`). Progression migration-тай **ижил** хэсэг | Өөрийнхөө мөрийг уншина |
| `purchases` | Худалдан авалт бүр: токен (давтагдашгүй), бүтээгдэхүүн, төлөв, order ID, туршилтын эсэх, огноо | Өөрийнхөө мөрийг уншина |
| `ad_rewards` | Шагналтай зар бүр: байршил, тоглолтын ref, зоос, өдөр | Өөрийнхөө мөрийг уншина |

Бүх хүснэгт RLS-тэй, шууд бичих эрхгүй. Функц: `my_entitlements()`, `claim_ad_reward(placement, ref, coins)` (тоглогч); `record_purchase`, `revoke_purchase` (зөвхөн Edge Function, service role). Бүртгэл устгахад гурвуулаа устна.

**JavaScript hook** (бусад файл `window.X?.(...)` гэж дууддаг): `Store` (зөвхөн Android аппад), `renderIapSection(el)`, `renderResultAd(el, info)`, `onMatchEnd(info)`, `renderStoreSettings(el)`.

---

## 5. Play Console: бүтээгдэхүүн үүсгэх

Эхлээд апп Play Console-д байж, billing-тэй build (энэ хувилбар) дор хаяж нэг удаа (internal testing хангалттай) upload хийгдсэн байх ёстой.

1. **Monetize with Play → Products → One-time products → Create one-time product.**
2. **Product ID**: 3-р хэсгийн ID-г яг хуулна (`coins_small` гэх мэт). Дараа нь өөрчлөх боломжгүй.
3. **Name / Description**: монгол, англиар (жишээ: «500 зоос» / «500 coins», «Зар хасах» / «Remove ads: no ads between matches»).
4. **Purchase option**: «Buy» төрлийн нэг сонголт, үнээ USD-ээр тавиад **Set prices**-аар бусад улсын үнийг автоматаар гаргана. **Multi-quantity**-г бүү асаа (тоглоом нэг ширхэгээр тооцдог).
5. **Activate** дарна. Таван бүтээгдэхүүнээ ингэж үүсгэнэ. Шинэ улирал нэмэгдэхэд `pass_s2` гэх мэтийг нэмнэ.
6. **Monetize with Play → Monetization setup**-д **Real-time developer notifications** заавал биш (энэ хувилбар ашигладаггүй, voided purchases-ийг өдөр бүр шалгадаг).
7. Payments profile (Play Console → Setup → Payments profile) бөглөгдсөн байх ёстой, эс тэгвээс бүтээгдэхүүн идэвхжихгүй.

---

## 6. AdMob: бүртгэл, жинхэнэ ID-г GitHub secret болгох

Код анхнаасаа Google-ийн **туршилтын** ID-тай: debug build үргэлж, release build нь secret байхгүй бол туршилтын зар харуулна (зар дээр «Test Ad»). Жинхэнэ ID repo-д хэзээ ч орохгүй.

1. https://admob.google.com дээр Google бүртгэлээрээ AdMob бүртгэл нээнэ (төлбөрийн мэдээлэл, татварын мэдээллийг бөглөнө).
2. **Apps → Add app → Android**. Апп Play-д нийтлэгдээгүй бол «not listed» гэж үүсгээд дараа нь холбоно.
3. **Ad units → Add ad unit** хоёрыг үүсгэнэ:
   - **Rewarded**: нэр нь «Rewarded coins». Шагналын тоо, төрлийг 1 / «reward» гэж үлдээж болно (тоглоом зоосоо өөрөө тооцдог).
   - **Interstitial**: нэр нь «Between matches».
4. ID-уудаа хуулна: App ID `ca-app-pub-…~…`, ad unit ID `ca-app-pub-…/…`.
5. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**, гурвуулаа (дутуу бол build зогсоно):

   | Нэр | Утга |
   | --- | --- |
   | `ADMOB_APP_ID` | `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY` |
   | `ADMOB_REWARDED_ID` | rewarded ad unit ID |
   | `ADMOB_INTERSTITIAL_ID` | interstitial ad unit ID |

6. Дараагийн **Build release AAB** run-ийн Summary-д «Ads: REAL AdMob IDs» гэж гарна (байхгүй бол «TEST ad IDs»).
7. Өөрийн утсан дээр жинхэнэ зар дээр **бүү дар**: AdMob хүчингүй гэж үзэж бүртгэлийг хааж болно. Утсаа туршилтын төхөөрөмж болгох бол logcat-д гарах «hashed device ID»-г repo-ийн **Variables**-д `ADS_TEST_DEVICE` гэж хадгална (secret биш), эсвэл AdMob → Settings → Test devices-д нэмнэ.
8. (Санал) Хөгжүүлэгчийн вэбсайтын үндсэн домэйнд `app-ads.txt` тавьбал AdMob илүү итгэдэг. GitHub Pages-ийн `…github.io/khan-blocks/` шиг дэд замд ажиллахгүй (домэйны үндэс шаардлагатай), өөрийн домэйнтэй болох үед хийнэ.

---

## 7. Зөвшөөрлийн мессеж (UMP, Европ)

Европын эдийн засгийн бүс (EEA), Их Британи, Швейцарьт зар үзүүлэхэд хэрэглэгчийн зөвшөөрөл (GDPR) шаардлагатай. Апп эхлэх бүрд UMP SDK зөвшөөрлийн мэдээллийг шинэчилж, шаардлагатай үед цонх гаргана. Зөвшөөрөл ирэхээс өмнө нэг ч зар хүсэхгүй.

1. AdMob → **Privacy & messaging → European regulations** → **Create message**.
2. Аппаа сонгоно, хэл: English (монгол хэл UMP-ийн жагсаалтад байхгүй бол англиар үлдээнэ), нууцлалын бодлогын хаяг (`…/privacy/`).
3. **Publish**. (Хүсвэл **US state regulations** мессежийг мөн нийтэлнэ.)
4. Мессеж нийтлээгүй бол UMP «зар хүсч болно» гэж хариулдаг ч Европын хэрэглэгчдэд зар хязгаарлагдана.
5. Тохиргоо → «Нууцлал ба зарын сонголт» товч зөвхөн UMP «шаардлагатай» гэсэн үед (Европын хэрэглэгч) гарна.

**Шалгах**: Монгол EEA биш тул цонх гарахгүй. Actions → **Build Android APK** → «Consent test» сонголтыг асааж build хийгээд **emulator** дээр (emulator автоматаар туршилтын төхөөрөмж), эсвэл `ADS_TEST_DEVICE` variable-д утасныхаа ID-г хадгалаад туршина.

---

## 8. Supabase: migration, Edge Function, secret

Онлайн build-д худалдан авалт **заавал** сервер дээр баталгаажна. Функцийг байршуулаагүй бол худалдан авалт олгогдохгүй (3 хоногийн дараа Google мөнгийг буцаана). Тиймээс худалдан авалттай онлайн build гаргахаас **өмнө** доорхыг хийнэ.

### 8.1. Migration

`docs/SUPABASE.md`-ийн дарааллаар `20261118000000_payments.sql`-ийг ажиллуулна (progression хэсгийн `20261118100000_progression.sql` мөн байгаа бол түүний дараа). Хоёулаа `entitlements` хүснэгтийн ижил хэсгийг агуулдаг тул дараалал хамаагүй.

### 8.2. Google-ийн service account

1. https://console.cloud.google.com дээр project үүсгэнэ (эсвэл байгааг ашиглана).
2. **Google Play Android Developer API**-г **Enable** хийнэ.
3. **IAM & Admin → Service accounts → Create service account** (жишээ нь `play-verifier`). Role өгөх шаардлагагүй.
4. Тэр account → **Keys → Add key → Create new key → JSON**. Татагдсан файлыг **repo-гийн гадна** хадгална, git-д хэзээ ч бүү оруул.
5. Play Console → **Users and permissions → Invite new users** → service account-ийн имэйл → аппдаа эрх: **View financial data, orders, and cancellation survey responses** ба **Manage orders and subscriptions** → **Invite user**. (Эрх идэвхжихэд хэдэн цаг болж магадгүй.)

### 8.3. Secret ба байршуулах

[Supabase CLI](https://supabase.com/docs/guides/functions/secrets) ашиглан (repo-гийн хавтаснаас):

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(jq -c . /path/to/play-verifier.json)" \
  PLAY_PACKAGE_NAME=com.anaraa.khanblocks CRON_SECRET="$(openssl rand -hex 24)"
supabase functions deploy verify-purchase
supabase functions deploy voided-purchases --no-verify-jwt
```

- `jq` байхгүй бол Dashboard → **Edge Functions → Secrets**-д JSON файлын агуулгыг бүхэлд нь хуулж тавьж болно.
- `SUPABASE_URL` болон түлхүүрүүдийг (`SUPABASE_SECRET_KEYS` эсвэл хуучин `SUPABASE_SERVICE_ROLE_KEY`) Supabase өөрөө өгдөг. Функц шинэ `sb_secret_…` түлхүүрийг ч, хуучин service_role түлхүүрийг ч таньдаг.
- `verify-purchase` нь JWT шалгалттай (анхдагч) байна: тоглогчийн session-ыг платформ шалгаж, функц өөрөө `auth/v1/user`-ээр дахин шалгадаг. Хэрэв утсан дээр CORS-ийн preflight 401 буцааж худалдан авалт «баталгаажуулж чадсангүй» гэвэл `supabase functions deploy verify-purchase --no-verify-jwt` гэж дахин байршуулна (функц хэрэглэгчийг өөрөө шалгадаг тул аюулгүй).
- `voided-purchases` нь JWT-гүй, `x-cron-secret` толгойгоор хамгаалагдсан.

### 8.4. Буцаалтыг өдөр бүр шалгах (Supabase Cron)

Database → Extensions-д **pg_cron**, **pg_net**-ийг асаагаад SQL Editor-т (`<PROJECT_REF>`, `<CRON_SECRET>`-ийг солино):

```sql
select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
select vault.create_secret('<CRON_SECRET>', 'voided_cron_secret');
select cron.schedule('khan-voided-purchases', '17 3 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/voided-purchases?days=3',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'voided_cron_secret')),
    body := '{}'::jsonb) as request_id
$$);
```

Өдөр бүр 03:17 UTC-д сүүлийн 3 хоногийг шалгана (API 30 хоног хадгалдаг; удаан зогссон бол `?days=30`-аар нэг удаа гараар дуудна). Хариу: `{ok, checked, revoked}`.

### 8.5. Шалгах (компьютер дээр)

- `tests/run.sh`: SQL функцүүд (`supabase/tests/local_test.sql`-ийн «payments and ads» хэсэг), тоглоомын «store» тест (хуурамч KhanNative, хуурамч Supabase), Edge Function-ийн логик (Node 22: `supabase/functions/tests/play_test.mjs`).

---

## 9. Туршилт

**Худалдан авалт (license tester)**

1. Play Console → **Settings → License testing**: туршигчдын Gmail-ийг нэмнэ.
2. Туршигч internal testing track-аас (эсвэл ижил package name-тэй debug APK) суулгана. License tester-ийн худалдан авалт жинхэнэ мөнгө авахгүй, цонхонд «test» гэж бичигдэнэ.
3. Төлбөрийн туршилтын хэрэгслүүд: **always approves** (амжилттай), **always declines** (амжилтгүй), **slow test card, approves after a few minutes** (pending → дараа нь олгогдох), **slow test card, declines after a few minutes** (pending → олгогдохгүй).
4. License tester-ийн худалдан авалтыг 3 минутын дотор acknowledge хийхгүй бол буцаагдана: сервер ажиллаж байгааг шалгах сайн арга.
5. «Зар хасах»-ыг дахин турших бол Play Console → **Order management**-аас refund + revoke хийгээд аппад «Худалдан авалтаа сэргээх» дарна (эсвэл `voided-purchases`-ийг ажиллуулна).

**Зар**: debug APK үргэлж туршилтын зар харуулна. Жинхэнэ ID-тай release-ийг өөрийн утсан дээр `ADS_TEST_DEVICE`-гүйгээр туршихдаа зар дээр бүү дар.

**Утсан дээр шалгах зүйлс**: 12-р хэсгийг үз.

---

## 10. Бодлого ба Data safety

- **Төлбөр**: апп доторх дижитал бараа (зоос, зар хасах, пасс) Google Play-ийн төлбөрийн системээр л зарагдана. Өөр төлбөрийн арга руу (QPay, банкны шилжүүлэг гэх мэт) апп дотроос, дэлгүүрийн хуудаснаас **бүү** чиглүүл. Худалдаж авсан зоос зөвхөн энэ тоглоомд хэрэглэгдэнэ.
- **Шагналтай зар**: зөвхөн тоглогч сонгосон үед, шагналыг урьдчилан хэлж, дуустал үзвэл заавал олгоно. Мөнгөн шагнал өгөхгүй.
- **Тоглолт хоорондын зар**: логик завсарт (тоглолт дууссаны дараа), апп нээх, хаах үед биш, хоёр зар дараалуулахгүй.
- **Хүүхэд**: зорилтот насыг **13+** (13–15, 16–17, 18+) гэж сонгоно. 13-аас доош сонговол Families бодлого (зар, мэдээлэл) хамаарна. Апп хүсэлтдээ «өсвөр насныханд тохирох (T) хүртэлх зар» гэж хязгаарладаг.
- **Advertising ID**: ads SDK manifest-д `com.google.android.gms.permission.AD_ID`-г автоматаар нэмдэг. Play Console-ийн Advertising ID асуултад **Yes** (зар, аналитик, луйвраас сэргийлэх).
- Data safety, контентын үнэлгээ, «Contains ads», «In-app purchases»-ийн дэлгэрэнгүй хариулт: `docs/LAUNCH.md` (2.8, 2.9). Нууцлалын бодлого шинэчлэгдсэн: `docs/privacy/index.html`.

---

## 11. App Store (дараа)

iOS-д одоогоор код байхгүй (`docs/IOS.md`). Хийх үед:

- **Худалдан авалт**: Apple-ийн дүрмээр апп доторх дижитал бараа заавал In-App Purchase (StoreKit 2)-оор зарагдана (App Review Guideline 3.1.1). App Store Connect-д ижил ID-тай бүтээгдэхүүн (consumable: зоос; non-consumable: `remove_ads`, `pass_s1`) үүсгэнэ.
- **Bridge**: Capacitor plugin нь ижил `KhanNative` протоколыг (`info()`, `post({id, op, args})`, `window.__khanNative` хариу) хэрэгжүүлбэл `55-store.js` өөрчлөлтгүй ажиллана.
- **Сервер**: App Store Server API-аар гүйлгээг шалгах тусдаа Edge Function (`verify-purchase`-тэй ижил бүтэц), entitlement-ийн `source = 'appstore'`.
- **Зар**: Google Mobile Ads iOS SDK + UMP. IDFA ашиглах бол App Tracking Transparency зөвшөөрлийн цонх, `NSUserTrackingUsageDescription`, App Privacy-д «Identifiers», «Purchases»-ийг зарлана.

---

## 12. Шалгах жагсаалт

**Тохиргоо**
- [ ] Play Console: 5 бүтээгдэхүүн (3-р хэсэг) идэвхтэй, Payments profile бөглөгдсөн
- [ ] AdMob: апп, rewarded ба interstitial ad unit, төлбөрийн мэдээлэл
- [ ] GitHub secret: `ADMOB_APP_ID`, `ADMOB_REWARDED_ID`, `ADMOB_INTERSTITIAL_ID`
- [ ] AdMob Privacy & messaging: GDPR мессеж нийтлэгдсэн
- [ ] (Онлайн) migration `20261118000000_payments.sql` ажилласан
- [ ] (Онлайн) Google Play Android Developer API идэвхтэй, service account Play Console-д 2 эрхтэй
- [ ] (Онлайн) secret: `GOOGLE_SERVICE_ACCOUNT_JSON`, `PLAY_PACKAGE_NAME`, `CRON_SECRET`; функц хоёулаа байршсан; cron тохируулсан
- [ ] Play Console App content: Ads → **Yes**, Advertising ID → **Yes**, Data safety шинэчлэгдсэн, контентын үнэлгээ дахин бөглөгдсөн, зорилтот нас 13+
- [ ] Нууцлалын бодлого (зар, advertising ID, худалдан авалт) GitHub Pages-д шинэчлэгдсэн

**Утсан дээр (license tester-ээр)**
- [ ] Дэлгүүрт үнэ Play-ээс гарна; Play-ийн улс худалдан авалтгүй бол тайлбар гарна
- [ ] Зоосны багц: always approves → зоос нэмэгдэнэ, дахин авч болно
- [ ] Цуцлах → юу ч өөрчлөгдөхгүй; always declines → юу ч олгохгүй
- [ ] Slow card (approves) → «Төлбөр хүлээгдэж байна», хэдэн минутын дараа олгогдоно
- [ ] Зар хасах → тоглолт хоорондын зар гарахаа болино; refund + revoke → дахин гарна
- [ ] Аппыг устгаад дахин суулгах → «Худалдан авалтаа сэргээх» «Зар хасах»-ыг буцаана
- [ ] Шагналтай зар: +30 (өдөрт 5), дүнгийн дэлгэц дээр 2 дахин (тоглолтод нэг удаа)
- [ ] Тоглолт хоорондын зар: эхний 5 тоглолт, эхний өдөр гарахгүй; дараа нь 3 тоглолтод нэг; онлайн, найзтай тоглолтод хэзээ ч үгүй
- [ ] Consent test build: emulator дээр GDPR цонх гарна, Тохиргоонд «Нууцлал ба зарын сонголт» гарна
- [ ] (Онлайн) Supabase-ийн `purchases`, `ad_rewards` хүснэгтэд мөр нэмэгдэнэ

---

## 13. Юуг шалгаж чадаагүй вэ

- **Gradle build**: энэ орчинд Android SDK байхгүй. Java кодыг Google Maven-аас татсан жинхэнэ SDK class-уудтай (ads-mobile-sdk 1.6.0, user-messaging-platform 4.0.0, billing 9.1.0) `javac --release 17`-оор хөрвүүлж шалгасан, Android-ийн өөрийн class-уудад (android.*, org.json, BuildConfig) хуурамч stub ашигласан. Manifest merge, resource, жинхэнэ утсан дээрх ажиллагааг шалгаагүй. Эхний APK build дээр алдаа гарвал Actions-ийн log-ийг харна.
- **Deno**: Edge Function-ийн логикийг Node 22 дээр (ижил вэб API) хуурамч fetch-ээр шалгасан. Supabase дээр байршуулж жинхэнэ Google API, жинхэнэ токентой шалгаагүй.
- **Жинхэнэ Google дуудлага, AdMob, UMP цонх**: зөвхөн утсан дээр, license tester-ээр шалгагдана (9, 12-р хэсэг).

---

## 14. Эх сурвалж

2026 оны 11-р сарын 16-нд шалгасан.

**Зар (AdMob)**
- GMA Next-Gen SDK-г Android-ийн давуу SDK болгосон (2026-07-06), хуучин SDK-ийн хугацаа (2027-06-30 deprecated, 2028-06-30 sunset): https://developers.google.com/ads/blog/posts/2026/07/announcing-google-mobile-ads-next-gen
- Next-Gen SDK-ийн хувилбарууд (1.6.0, 2026-10-22): https://developers.google.cn/admob/android/next-gen/rel-notes?hl=en
- Next-Gen SDK тохиргоо (dependency, minSdk 24, compileSdk 35+, InitializationConfig, UMP-д manifest-ийн app ID): https://developers.google.com/admob/android/next-gen/quick-start.md.txt
- Callback-ууд background thread дээр ирдэг: https://developers.google.com/admob/android/next-gen/migration/handle-callbacks
- Rewarded (AdLoadCallback, OnUserEarnedRewardListener, SSV): https://developers.google.com/admob/android/next-gen/rewarded/single-load
- Interstitial ба preloading (туршилтын unit ID, логик завсарт): https://developers.google.com/admob/android/next-gen/interstitial.md.txt
- Google-ийн жишээ код (Java, import, play-services-ads-ийг exclude хийх): https://github.com/googleads/gma-next-gen-sdk-android-examples
- Хуучин SDK-ийн хувилбарууд (25.5.0, maintenance): https://developers.google.com/admob/android/rel-notes
- Туршилтын app ID `ca-app-pub-3940256099942544~3347511713`, rewarded `…/5224354917`, interstitial `…/1033173712`: дээрх quick-start, rewarded, interstitial хуудсууд
- Хувилбарыг Google Maven-ийн metadata-аас шалгасан: https://dl.google.com/dl/android/maven2/com/google/android/libraries/ads/mobile/sdk/ads-mobile-sdk/maven-metadata.xml
- Шагналтай зарын бодлого: https://support.google.com/admob/answer/7313578
- Тоглолт хоорондын зарын хориотой хэрэгжүүлэлт: https://support.google.com/admob/answer/6201362
- Advertising ID (AD_ID зөвшөөрөл, Android 13): https://support.google.com/admob/answer/11402075
- Ads SDK-ийн цуглуулдаг мэдээлэл (Data safety): https://developers.google.cn/admob/android/play-data-disclosure
- Server-side verification (callback параметр, verifier-keys.json): https://developers.google.cn/admob/cpp/ssv?hl=en

**Зөвшөөрөл (UMP)**
- UMP SDK 4.0.0 (2025-10-31): https://developers.google.cn/ad-manager/mobile-ads-sdk/android/privacy/release-notes?hl=en

**Google Play Billing**
- Play Billing Library 9.1.0 (2026-06-18), 8.0-ийн өөрчлөлт (queryPurchaseHistory хасагдсан, enablePendingPurchases(params), QueryProductDetailsResult, enableAutoServiceReconnection), 2026-08-31-нээс 8+ шаардлагатай: https://developer.android.com/google/play/billing/release-notes
- One-time product-ийн backend урсгал (productsv2, acknowledge/consume, 3 хоног): https://developer.android.com/google/play/billing/lifecycle/one-time
- Billing-ийг турших (license tester, test card, 3 минут): https://developer.android.com/google/play/billing/test
- Payments бодлого (Play Billing заавал, virtual currency, ad-free version): https://support.google.com/googleplay/android-developer/answer/9858738

**Google Play Developer API**
- purchases.products (get, acknowledge, consume, ProductPurchase талбарууд): https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products
- purchases.productsv2.getproductpurchasev2 (ProductPurchaseV2): https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2
- Discovery document (HTTP зам, voidedpurchases.list-ийн параметр, revision 20261112): https://androidpublisher.googleapis.com/$discovery/rest?version=v3
- API-д service account-аар хандах, Play Console-ийн 2 эрх: https://developers.google.cn/android-publisher/getting_started?hl=en

**Google Play-ийн улс, валют**
- Худалдан авалт хийх боломжтой улс («Rest of the world»: ✘): https://support.google.com/googleplay/android-developer/answer/138294
- «Rest of the world»-д Монгол багтдаг: https://support.google.com/googleplay/android-developer/answer/12201481
- Төлбөртэй апп худалдаалагддаг улс (Монгол байхгүй): https://support.google.com/googleplay/answer/143779
- Merchant бүртгэл (Монгол ✔, USD): https://support.google.com/googleplay/android-developer/answer/9306917
- Ханш (≈3,571₮/USD, 2025-11): https://www.ceicdata.com/en/indicator/mongolia/exchange-rate-against-usd

**Supabase**
- Edge Function-ийн анхдагч secret (SUPABASE_SECRET_KEYS, SUPABASE_SERVICE_ROLE_KEY), `supabase secrets set`: https://supabase.com/docs/guides/functions/secrets.md
- verify_jwt, функцийг хамгаалах: https://supabase.com/docs/guides/functions/auth.md
- Authorization ба apikey толгой, шинэ түлхүүрүүд: https://supabase.com/docs/guides/functions/auth-headers.md
- Edge Function-ийг хуваарьтай ажиллуулах (pg_cron, pg_net, Vault): https://supabase.com/docs/guides/functions/schedule-functions.md

**Apple (дараа)**
- App Review Guidelines (3.1.1 In-App Purchase): https://developer.apple.com/app-store/review/guidelines/
