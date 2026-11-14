# Neon Duel: iOS (iPhone) хувилбар бэлтгэх

Тоглоом бүхэлдээ нэг `index.html` файл. iPhone-д гаргахдаа [Capacitor](https://capacitorjs.com) ашиглана: Capacitor нь `index.html`-ийг аппын дотор хийж, iOS-ийн WebView (WKWebView)-д ачаалдаг Xcode project үүсгэнэ. Тоглоомын кодыг өөрчлөх шаардлагагүй.

Энэ repo-д бэлэн байгаа зүйл:

| Файл | Юу хийдэг |
| --- | --- |
| `package.json` | Capacitor 8-ийн багцууд (`@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`) ба доорх командууд |
| `capacitor.config.json` | Аппын ID `com.anaraa.neonduel`, нэр `Neon Duel`, вэб файлын хавтас `www`, iOS-ийн тохиргоо |
| `tools/prepare-web.mjs` | `index.html`-ийг `www/` руу хуулна, Supabase-ийн тохиргоо өгвөл онлайн хувилбар болгоно |
| `.gitignore` | `node_modules/`, `www/`, iOS-ийн build файлуудыг git-ээс хасна |

Android-д бидний өөрсдийн `android/` project хэвээр ашиглагдана. Capacitor-ын Android хэсгийг ашиглахгүй. `capacitor.config.json`-д `"android": {"path": "capacitor-android"}` гэж байхгүй хавтас зориуд заасан нь Capacitor-ын командууд `android/` хавтсанд хүрэхээс сэргийлнэ. **`npx cap add android` бүү ажиллуул.**

Энэ бүхнийг Mac дээр ажиллуулж үзээгүй (энд Mac байхгүй). Доорх алхмуудыг анх удаа хийхдээ гарсан алдааг тэмдэглэж аваарай.

---

## 0. Юу хэрэгтэй вэ

- **Mac** болон **Xcode 26 эсвэл шинэ хувилбар** (App Store-оос үнэгүй). 2026 оны 4-р сарын 28-аас App Store Connect зөвхөн Xcode 26+ болон iOS 26 SDK-гаар бүтээсэн аппыг хүлээж авдаг.
- **Node.js 22 эсвэл шинэ** (Capacitor 8-ийн шаардлага): `node -v` гэж шалгана. https://nodejs.org-оос LTS хувилбарыг суулгана.
- **Apple Developer Program** гишүүнчлэл (жилд 99 USD): App Store болон TestFlight-д заавал хэрэгтэй. Үнэгүй Apple Account-аар зөвхөн өөрийн iPhone-д туршиж болох бөгөөд суулгасан апп 7 хоногийн дараа ажиллахаа больдог.
- Энэ repo-г Mac дээр татсан байх (`git clone`).

**Mac байхгүй бол:** macOS-тэй CI (жишээ нь GitHub Actions-ийн macOS runner) эсвэл түрээсийн cloud Mac ашиглаж болно. Тэр тохиолдолд signing сертификат, provisioning profile-ийг GitHub secret болгох хэрэгтэй болно. Энэ PR-д iOS-ийн CI тохируулаагүй.

---

## 1. Анх удаа: iOS project үүсгэх

Terminal нээгээд:

```bash
git clone https://github.com/Anaraa010907/Tetris-battle.git neon-duel
cd neon-duel
npm install
npm run ios:add
```

- Repo-гийн нэрийг сольсон бол (`docs/LAUNCH.md`, 1.2) clone хийх хаяг нь шинэ нэртэй болно.
- `npm install` нь Capacitor 8.x-ийн хамгийн сүүлийн хувилбарыг суулгаж `package-lock.json` үүсгэнэ. **`package-lock.json`-оо commit хий**, дараа нь бүх Mac дээр ижил хувилбар суух болно. (9.0 одоохондоо туршилтын хувилбар тул `package.json` 8.x-д түгжсэн.)
- `npm run ios:add` нь `node tools/prepare-web.mjs && npx cap add ios`-тэй адил: эхлээд `www/index.html` үүсгээд, дараа нь `ios/` хавтсанд Xcode project үүсгэнэ. Capacitor 8 шинэ project-ийг Swift Package Manager-ээр үүсгэдэг тул CocoaPods суулгах шаардлагагүй.
- Үүссэн **`ios/` хавтсыг commit хийнэ** (доторх `.gitignore` build файлуудыг өөрөө хасдаг). Xcode-д хийсэн тохиргоо (icon, signing, Info.plist) энд хадгалагдана.

```bash
git add package-lock.json ios
git commit -m "Add the iOS project (Capacitor)"
```

---

## 2. Онлайн тохиргоо (Supabase) iOS-д хэрхэн орох вэ

`tools/prepare-web.mjs` нь `index.html`-ийг `www/` руу хуулдаг. Хуулахдаа `SUPABASE_URL` ба `SUPABASE_ANON_KEY` орчны хувьсагч байвал тоглоомын `neon-config` блокийг бөглөж **онлайн хувилбар** болгоно. Энэ нь Android-ийн workflow GitHub secret-ээр хийдэгтэй яг адил. Хувьсагч байхгүй бол **офлайн хувилбар**.

```bash
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=eyJ... npm run ios:sync
```

- Утгуудыг Supabase → **Project Settings → API**-аас авна (`docs/SUPABASE.md`, 4-р хэсэг).
- `index.html` өөрөө өөрчлөгдөхгүй. Өөрчлөгдөх нь зөвхөн git-д ордоггүй `www/index.html`.
- Команд бүрд бичихээс залхвал `~/.zshrc` файлд `export SUPABASE_URL=...` ба `export SUPABASE_ANON_KEY=...` гэж нэмж болно.
- Зөвхөн нэгийг нь өгвөл скрипт алдаа өгч зогсоно. `*.supabase.co`-оос өөр хаяг өгвөл анхааруулна: тоглоомын CSP зөвхөн `https://*.supabase.co` руу холбогдохыг зөвшөөрдөг.
- Шалгах: `grep -o '"supabaseUrl":"[^"]*"' www/index.html`

---

## 3. Өөрчлөлт бүрийн дараа

Тоглоом шинэчлэгдсэн бүрд (`git pull` хийсний дараа):

```bash
git pull
npm run ios:sync
```

`ios:sync` нь `www/`-г дахин үүсгээд `npx cap sync ios`-оор iOS project руу хуулна. Хэрэв `src/` дотор өөрөө өөрчлөлт хийсэн бол эхлээд `python3 tools/build.py` ажиллуулж `index.html`-ээ шинэчил.

Capacitor-ын командуудад үргэлж `ios` гэж зааж өгөөрэй (`npx cap sync ios`, `npx cap open ios`).

---

## 4. Xcode-д нээж тохируулах

```bash
npm run ios:open
```

(`npx cap open ios`-тэй адил.) Xcode-ийн зүүн талд **App** project → **TARGETS: App** сонгоно.

### General

| Тохиргоо | Утга |
| --- | --- |
| Display Name | `Neon Duel` |
| Bundle Identifier | `com.anaraa.neonduel` (өөрчлөхгүй: App Store Connect-д энэ ID-гаар бүртгэнэ) |
| Version | `1.3` (Android-ийн `versionName`-тэй ижил байлгавал ойлгомжтой) |
| Build | `1`, дараагийн upload бүрд нэгээр нэмнэ |
| Minimum Deployments | iOS 15.0 (Capacitor 8-ийн доод хэмжээ) |
| Supported Destinations | Зөвхөн **iPhone** үлдээхийг санал болгож байна (iPad, Mac, Vision-ийг хас). Ингэвэл App Store-д iPad-ийн дэлгэцийн зураг шаардахгүй. iPhone-ий апп iPad дээр ч ажиллана |
| Device Orientation | Зөвхөн **Portrait** |

### Signing & Capabilities

1. **Automatically manage signing**-ийг асаана.
2. **Team**: Apple Developer Program-д бүртгүүлсэн өөрийн team-ээ сонгоно. Xcode App ID болон provisioning profile-ийг өөрөө үүсгэнэ.

### Info (Info.plist)

Нэмэх мөрүүд (Info tab дээр `+` дарж):

| Key | Type | Value | Яагаад |
| --- | --- | --- | --- |
| `UIUserInterfaceStyle` (Appearance) | String | `Dark` | Утас цайвар горимд байсан ч статус мөрийн бичиг цагаан, систем цонхнууд бараан болно. Тоглоомын бараан дэвсгэр дээр харагдана |
| `ITSAppUsesNonExemptEncryption` | Boolean | `NO` | Апп зөвхөн HTTPS ашигладаг. Ингэвэл upload бүрд экспортын шифрлэлтийн асуулт гарахгүй. App Store Connect-ийн асуултыг өөрөө уншиж баталгаажуулаарай |

### Icon ба нээгдэх дэлгэц

- **Icon:** `App/App/Assets.xcassets/AppIcon` → 1024 × 1024 PNG (тунгалаг хэсэггүй, булангаа дугуйруулахгүй). `docs/store/listing.md`-ийн "Icon" хэсгийг үз.
- **Нээгдэх дэлгэц (launch screen):** Capacitor-ын загварт `Assets.xcassets/Splash` зураг байдаг. Түүнийг бараан хөх (#070C1B) дэвсгэртэй, голдоо логотой зургаар солино. Ингэвэл тоглоом ачаалах хүртэл цагаан дэлгэц гарахгүй.

---

## 5. Турших

1. Xcode-ийн дээд хэсгээс simulator сонгоно (Dynamic Island-тай, жишээ нь iPhone 17 Pro) → **▶ Run**.
2. Шалгах зүйлс:
   - Дээд талын оноо, товчнууд Dynamic Island-ийн доор, доод товчнууд гэрийн зурвасаас (home indicator) дээр байна уу
   - Хуруугаар удирдах (товших, гулсуулах, шудрах), дуу, хөгжим
   - Тохиргоо, тэргүүлэгчдийн жагсаалт доош гүйлгэгдэж байна уу
   - Профайл дээр имэйл бичихэд гар (keyboard) нүдийг таглахгүй байна уу
   - Онлайн хувилбар бол "ОНЛАЙН" гэж харагдаж, rank тоглолт хайж байна уу
3. Жинхэнэ iPhone дээр: утсаа кабелиар холбоод destination-оос сонгоно. Анх удаа iPhone дээр **Settings → Privacy & Security → Developer Mode**-ийг асаах шаардлагатай.

Тохиргоо, тэргүүлэгчдийн жагсаалт гүйлгэгдэхгүй бол `capacitor.config.json`-д `"scrollEnabled": false`-г `true` болгоод `npm run ios:sync` хийнэ.

---

## 6. Safe area (дэлгэцийн аюулгүй хэсэг)

- Одоогийн `index.html`-ийн viewport-д `viewport-fit=cover` байхгүй. Ийм үед iOS вэб хуудсыг аюулгүй хэсэгт (Dynamic Island, notch, доод зурвасаас гадуур) байрлуулж, гаднах зурвасуудыг `capacitor.config.json`-ийн `backgroundColor` (#070c1b) өнгөөр будна. Тиймээс тоглоомын кодыг өөрчлөхгүйгээр ажиллах ёстой. Simulator дээр заавал шалгаарай.
- Дэлгэцийг бүтэн (захаас зах хүртэл) ашиглахыг хүсвэл тоглоомын кодонд өөрчлөлт хэрэгтэй: viewport-д `viewport-fit=cover` нэмж, дээд ба доод хэсэгт `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)` хэмжээний зай өгнө. Энэ нь `src/`-ийн ажил тул энэ PR-д хийгээгүй.
- Android-д энэ асуудал байхгүй: `MainActivity` статус мөр, navigation мөр, notch, гарын зайг өөрөө тооцдог.

---

## 7. Буцах товчны ялгаа

- **Android:** буцах товч эсвэл дохио `window.onAndroidBack`-ийг дууддаг: нээлттэй цонхыг хаана, тоглолтыг түр зогсооно, дүнгийн дэлгэцээс нүүр рүү гаргана. Зөвхөн нүүр дэлгэц дээр аппаас гарна.
- **iPhone:** буцах товч байхгүй, `onAndroidBack` дуудагдахгүй. Тоглогч дэлгэц дээрх товчнуудыг ашиглана: тоглолтын үеэр ⏸ (түр зогсоох → Нүүр), цонх бүрт "Боллоо" эсвэл "Болих", дүнгийн дэлгэцэд "Нүүр". Захаас шудрах "буцах" дохио Capacitor-ын WebView-д анхнаасаа унтраалттай тул тоглоомд саад болохгүй.

---

## 8. Бусад ялгаа

- **Чичиргээ:** iOS-ийн WebView вэбийн чичиргээний API-г (`navigator.vibrate`) дэмждэггүй, тиймээс Тохиргооны "Чичиргээ" iPhone дээр юу ч хийхгүй. Хүсвэл `@capacitor/haptics` нэмж тоглоомын кодоос дуудаж болно (`src/`-ийн ажил). Энэ нь App Store-ийн "апп шиг байх" шаардлагад (4.2) ч тус болно.
- **Нууцлалын manifest:** тоглоом Capacitor-ын нэмэлт plugin ашигладаггүй. App Store Connect upload хийсний дараа `PrivacyInfo.xcprivacy` дутуу гэж имэйл ирвэл Capacitor-ын [Privacy Manifest](https://capacitorjs.com/docs/ios/privacy-manifest) зааврын дагуу нэмнэ.

---

## 9. App Store руу илгээх

1. Xcode: дээд хэсгийн destination-оос **Any iOS Device (arm64)** сонгоно → **Product → Archive**.
2. Archive дууссаны дараа нээгдэх **Organizer** цонхонд **Distribute App → App Store Connect → Upload**.
3. **App Store Connect → TestFlight**: build боловсруулагдсаны дараа (10–30 минут орчим) өөрийн iPhone дээрх TestFlight аппаар суулгаж туршина.
4. **App Store** tab: хуудасны текст (`docs/store/listing.md`), App Privacy-ийн хариулт, review-д зориулсан тэмдэглэл (`docs/LAUNCH.md`, App Store хэсэг) бөглөж build-ээ сонгоод **Add for Review → Submit**.

Дараагийн хувилбар бүрд: `git pull` → `npm run ios:sync` → Xcode-д **Build** дугаарыг нэмэх → Archive → Upload.

---

## 10. Алдаа гарвал

| Алдаа | Шийдэл |
| --- | --- |
| `npm install` эсвэл `cap` командад Node-ийн алдаа | `node -v` 22-оос доош бол Node-оо шинэчил |
| `npx cap add ios`-д Xcode-ийн алдаа | Xcode-ийг нэг удаа нээж нөхцөлийг зөвшөөрөөд, `xcode-select --install` ажиллуул |
| "Could not find the web assets directory" | `npm run prepare-web` ажиллуулж `www/index.html` үүсгэ |
| Апп "ОФЛАЙН" гэж харагдана | `SUPABASE_URL`, `SUPABASE_ANON_KEY` өгч `npm run ios:sync` хийсэн эсэхээ шалга (2-р хэсэг) |
| Signing-ийн алдаа | Signing & Capabilities-д Team сонгосон эсэх, Apple Developer Program-ийн гишүүнчлэл идэвхтэй эсэх |
