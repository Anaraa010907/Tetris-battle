# Neon Duel: Google Play болон App Store-д гаргах заавар

Энэ заавар Neon Duel-д зориулагдсан. Алхмуудыг дарааллаар нь хийвэл Google Play-д эхлээд хаалттай туршилт (closed test), дараа нь бүх хүнд (production) гаргаж, App Store-д бэлтгэнэ. Төлбөр, шаардлагыг 2026 оны 11-р сарын байдлаар шалгасан. Эх сурвалжийг хамгийн доор жагсаасан. Дэлгүүрүүд дүрмээ өөрчилдөг тул эхлэхийн өмнө холбоосоор нэг харж аваарай.

## Агуулга

0. [Эхлэхийн өмнө шийдэх зүйлс](#0-эхлэхийн-өмнө-шийдэх-зүйлс)
1. [Нууцлалын бодлого ба бүртгэл устгах хуудсыг нийтлэх (GitHub Pages)](#1-нууцлалын-бодлого-ба-бүртгэл-устгах-хуудсыг-нийтлэх-github-pages)
2. [Google Play](#2-google-play)
3. [App Store](#3-app-store)
4. [Эх сурвалж](#4-эх-сурвалж)

---

## 0. Эхлэхийн өмнө шийдэх зүйлс

| Шийдвэр | Юунд нөлөөлөх вэ |
| --- | --- |
| **Офлайн эсвэл онлайн хувилбар гаргах** | Supabase-ийн `SUPABASE_URL`, `SUPABASE_ANON_KEY` secret байвал build онлайн болно (`docs/SUPABASE.md`). Google Play-ийн Data safety, App Store-ийн App Privacy, контентын үнэлгээний хариулт хоёр хувилбарт өөр. Build нь ямар байгааг workflow-ийн хураангуйгаас (ONLINE/OFFLINE) хардаг. Офлайнаар эхлээд дараа нь онлайн болгож болно, гэхдээ онлайн хувилбарыг гаргахаас **өмнө** Data safety-г шинэчилнэ |
| **Холбоо барих имэйл** | Нууцлалын бодлого, бүртгэл устгах хуудас, дэлгүүрийн хуудсанд олон нийтэд харагдана. Тоглоомд зориулсан тусдаа имэйл нээхийг зөвлөж байна |
| **Хөгжүүлэгчийн нэр** | Google Play-ийн developer name, App Store-д таны хуулийн нэр seller болж харагдана |
| **Repo-ийн нэр** | GitHub Pages-ийн хаяг repo-ийн нэрийг агуулна (1.2-ыг үз) |
| **Аппын нэр** | Одоохондоо "Neon Duel". Google Play-д аппыг үүсгэсний дараа нэр өөрчилж болно, харин package name `com.anaraa.neonduel` хэзээ ч өөрчлөгдөхгүй |

---

## 1. Нууцлалын бодлого ба бүртгэл устгах хуудсыг нийтлэх (GitHub Pages)

Хоёр дэлгүүр хоёулаа олон нийтэд нээлттэй нууцлалын бодлогын хаяг шаарддаг. Google Play онлайн бүртгэлтэй аппаас бүртгэл устгах вэб хуудас бас шаарддаг. Бэлэн хуудсууд:

- `docs/privacy/index.html`: нууцлалын бодлого (монгол, доор нь англи)
- `docs/privacy/delete.html`: бүртгэл устгах заавар (апп дотроос, аппгүйгээр имэйлээр)

### 1.1. Placeholder-уудыг солих

Хоёр файлд шар өнгөөр тодруулсан гурван төрлийн placeholder бий. **Бүгдийг** солино (нэг файлд хэд хэдэн удаа гардаг):

| Placeholder | Юугаар солих |
| --- | --- |
| `[ХОЛБОО БАРИХ ИМЭЙЛ]` | Тоглоомын холбоо барих имэйл |
| `[ХӨГЖҮҮЛЭГЧИЙН НЭР]` | Google Play-д харагдах developer name |
| `[СЕРВЕРИЙН БҮС]` (зөвхөн `index.html`) | Supabase project-ийн бүс, жишээ нь "Сөүл, Өмнөд Солонгос / Seoul, South Korea". Офлайн хувилбар гаргаж байгаа бол Supabase-ийн бүсийг сонгосон үедээ бичнэ |

Шалгах: `grep -n "\[ХОЛБОО\|\[ХӨГЖҮҮЛЭГЧ\|\[СЕРВЕР" docs/privacy/*.html` хоосон гарах ёстой.

Тоглоомын товчны нэр (жишээ нь "Дотоод мэдээлэл устгах") өөрчлөгдвөл `delete.html`-ийн А хэсгийг тааруулж засна.

### 1.2. Repo-ийн нэрийг өөрчлөх (санал)

Pages-ийн хаяг `https://anaraa010907.github.io/<repo-ийн нэр>/privacy/` хэлбэртэй. Одоогийн нэр **Tetris-battle** тул бодлогын хаяг "Tetris" гэдэг үгийг агуулж, Google Play-ийн хуудсанд харагдана. Энэ нь өөр компанийн барааны тэмдэг тул **Pages асаахаас өмнө** repo-гоо жишээ нь `neon-duel` гэж нэрлэхийг зөвлөж байна:

1. Repo → **Settings → General → Repository name** → `neon-duel` → **Rename**.
2. GitHub хуучин хаягаас шинэ рүү git-ийн push, pull-ийг өөрөө шилжүүлдэг. Компьютер дээрх хуулбарт хүсвэл: `git remote set-url origin https://github.com/Anaraa010907/neon-duel.git`

Pages-ийн хаяг нэр солиход шилжихгүй тул нэрийг эхэлж солих нь чухал.

### 1.3. GitHub Pages асаах

Pages нь `main` салбарын `docs/` хавтаснаас нийтэлнэ, тиймээс энэ PR `main`-д нийлсэн байх ёстой.

1. Repo → **Settings → Pages**.
2. **Build and deployment → Source**: **Deploy from a branch**.
3. **Branch**: `main`, хавтас: **`/docs`** → **Save**.
4. Хэдэн минут хүлээгээд Settings → Pages дээр гарах хаягаар орж шалгана:
   - Нууцлалын бодлого: `https://anaraa010907.github.io/neon-duel/privacy/`
   - Бүртгэл устгах: `https://anaraa010907.github.io/neon-duel/privacy/delete.html`

(Repo-ийн нэрээ солиогүй бол `neon-duel`-ийн оронд `Tetris-battle` байна.)

- GitHub Pages нийтийн (public) repo-д үнэгүй. Repo-г private болговол GitHub Pro эсвэл түүнээс дээш багц хэрэгтэй болно.
- `docs/.nojekyll` файл нь Pages-ийг файлуудыг байгаа чигээр нь нийтлүүлдэг. `docs/` доторх бусад файл (энэ заавар гэх мэт) ч мөн нээлттэй харагдана. Repo нийтийн тул шинэ нууц юм задрахгүй.
- Энэ хоёр хаягийг доор Google Play, App Store-ийн маягтад ашиглана.

---

## 2. Google Play

### 2.1. Play Console бүртгэл

1. https://play.google.com/console дээр Google бүртгэлээрээ орж **хувь хүний (personal)** developer бүртгэл үүсгэнэ.
2. **Нэг удаагийн 25 ам.доллар**-ын бүртгэлийн хураамж төлнө (Visa, Mastercard гэх мэт; prepaid карт хүлээж авдаггүй).
3. Таны хуулийн нэр дээрх иргэний үнэмлэх, карт шаардаж магадгүй. Мэдээлэл буруу гэж үзвэл хураамжийг буцаадаггүй тул нэрээ үнэн зөв бичнэ.
4. Хувь хүний бүртгэл Android утсанд хандах эрхээ **Play Console утасны аппаар** баталгаажуулах ёстой.

**Чухал:** 2023 оны 11-р сарын 13-аас хойш үүссэн хувь хүний бүртгэл production-д (бүх хүнд) гаргахаас өмнө **дор хаяж 12 туршигчтай хаалттай туршилт** явуулж, тэд **14 хоног тасралтгүй** opt-in хийсэн байх шаардлагатай (2.10).

### 2.2. Upload key (гарын үсгийн түлхүүр) үүсгэх

Google Play-д илгээх `.aab` файлыг таны **upload key**-ээр гарын үсэг зурна. Түлхүүрийг өөрийн компьютер дээр нэг удаа үүсгэнэ. `keytool` нь Java (JDK) эсвэл Android Studio-той хамт ирдэг.

```bash
keytool -genkeypair -v -keystore neonduel-upload.jks -alias neonduel-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

(Windows PowerShell-д `\`-ийг аваад нэг мөрөнд бичнэ. `keytool` олдохгүй бол Android Studio-гийн `jbr\bin\keytool.exe`-г бүтэн замаар нь ажиллуулна.)

- Нууц үг асууна: хамгийн багадаа 6 тэмдэгт, хүчтэй нууц үг сонго. Түлхүүрийн нууц үг асуувал **ижил нууц үгийг** өгнө (шинэ JDK-ийн PKCS12 файл ганц нууц үг ашигладаг).
- Нэр, байгууллага, хот, улсын кодыг (`MN`) бөглөнө.
- `-validity 10000` нь 27 орчим жил хүчинтэй.

**Хадгалах:** `neonduel-upload.jks` файл болон нууц үгийг хоёр өөр аюулгүй газар хадгална (нууц үгийн менежер, USB гэх мэт). **Git-д хэзээ ч бүү оруул** (`.gitignore`-д `*.jks` хаагдсан). Алдчихвал Play App Signing-ийн ачаар апп устахгүй: Play Console-оос upload key шинэчлэх хүсэлт гаргаж болно, гэхдээ хугацаа ордог.

### 2.3. Түлхүүрийг base64 болгох

GitHub secret-д зөвхөн текст хадгалагддаг тул `.jks` файлыг base64 текст болгоно.

**macOS:**

```bash
base64 -i neonduel-upload.jks | pbcopy
```

(clipboard-д хуулагдана.)

**Linux:**

```bash
base64 -w 0 neonduel-upload.jks > neonduel-upload.jks.b64
```

**Windows (PowerShell):**

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\neonduel-upload.jks")) | Set-Clipboard
```

(clipboard-д хуулагдана.) Windows-ийн `certutil -encode` нь эхэнд, төгсгөлд "BEGIN/END CERTIFICATE" мөр нэмдэг тул бүү ашигла. Мөр шилжилт, хоосон зайг workflow өөрөө арилгадаг.

### 2.4. Дөрвөн GitHub secret нэмэх

Repo → **Settings → Secrets and variables → Actions → New repository secret**. Дөрвөн secret:

| Нэр | Утга |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | 2.3-ын base64 текст бүхэлдээ |
| `ANDROID_KEYSTORE_PASSWORD` | keystore-ийн нууц үг |
| `ANDROID_KEY_ALIAS` | `neonduel-upload` |
| `ANDROID_KEY_PASSWORD` | түлхүүрийн нууц үг (ихэвчлэн keystore-ийнхтой ижил) |

`gh` CLI ашигладаг бол: `gh secret set ANDROID_KEYSTORE_BASE64 < neonduel-upload.jks.b64` (бусдыг нь `gh secret set ANDROID_KEY_ALIAS` гэх мэтээр бичихэд утгыг асууна). Дараа нь `.b64` файлыг устгана.

Онлайн хувилбар гаргах бол `SUPABASE_URL`, `SUPABASE_ANON_KEY` secret-ийг мөн нэмнэ (`docs/SUPABASE.md`).

### 2.5. Release AAB бүтээх

1. Repo → **Actions → Build release AAB for Google Play → Run workflow**.
2. `version_code` хоосон орхивол автоматаар `ажиллуулсан дугаар + 100` болно (101, 102, ...). Google Play-д илгээх бүр өмнөхөөсөө **их** versionCode-той байх ёстой.
3. Дуусахад run-ийн хуудасны **Summary** дээр **ONLINE** эсвэл **OFFLINE**, мөн versionCode харагдана. Доор нь **Artifacts**-аас `neon-duel-release-aab-…` zip-ийг татаж задлахад `app-release.aab` гарна.

- Workflow эхлээд secret-үүдийг шалгана. Нууц үг эсвэл alias буруу бол тодорхой алдаа гаргаж зогсоно. Log-д upload key-ийн SHA-1 ба SHA-256 хурууны хээ харагдана (нууц биш). Play Console-ийн хуудсанд байгаатай таарч байгаа эсэхийг шалгаж болно.
- Амжилтгүй болсон run-ийг **Re-run** хийвэл ижил дугаар авна. Шинэ upload-д **Run workflow**-ээр шинэ run эхлүүлнэ.
- `versionName` (хэрэглэгчид харагдах "1.3") нь `android/app/build.gradle`-д бий. Шинэ хувилбар бүрд нэмэгдүүлнэ.
- Workflow файлын нэрийг солибол ажиллуулсан дугаар 1-ээс эхэлнэ. Тэр үед `version_code`-оо гараар (өмнөхөөсөө их) өгнө.
- Утсандаа туршихад хуучин **Build Android APK** workflow (debug APK) хэвээрээ ажиллана.

### 2.6. Play Console дээр апп үүсгэх

**Home → Create app**:

| Талбар | Утга |
| --- | --- |
| App name | Neon Duel |
| Default language | Монгол (mn-MN) эсвэл English (United States) |
| App or game | **Game** |
| Free or paid | **Free** (үнэгүй гаргасан аппыг дараа нь төлбөртэй болгох боломжгүй. Дотоод худалдан авалтыг хожим нэмж болно) |
| Declarations | Developer Program Policies ба US export laws-ийг зөвшөөрнө |

### 2.7. Play App Signing

Анхны `.aab`-ийг upload хийхэд апп **Play App Signing**-д автоматаар бүртгэгдэж, хэрэглэгчдэд очих аппын гарын үсгийн түлхүүрийг Google үүсгэж хадгална. Таны `neonduel-upload.jks` нь зөвхөн **upload key**: "энэ файлыг жинхэнэ хөгжүүлэгч илгээсэн" гэдгийг батална.

- Play Console-ийн **Play app signing** хуудасны **Upload key certificate**-ийн SHA-1/SHA-256 нь workflow-ийн log-той таарах ёстой.
- Upload key-ээ алдвал тэр хуудаснаас **Request upload key reset** хийнэ.

### 2.8. App content (Policy → App content)

Бүгдийг бөглөхгүй бол туршилт ч эхлэхгүй.

**Privacy policy:** 1.3-ын нууцлалын бодлогын хаяг.

**App access:** **All functionality is available without any special access**. Онлайн хувилбарт зочин бүртгэл автоматаар үүсдэг, нэвтрэх шаардлагагүй. (Хүсвэл тэмдэглэлд: "Ranked: if no opponent is found within 10 seconds, a labelled bot match is offered" гэж бичнэ.)

**Ads:** **No, my app does not contain ads.** Зар нэмэх үед энэ хариултыг өөрчилж, нууцлалын бодлогыг шинэчилнэ.

**Content rating:** IARC асуулга. Ангилал **Game**. Хүчирхийлэл, айдас, бүдүүлэг үг, мөрийтэй тоглоом, хар тамхи **байхгүй** (хийсвэр блок). Хоёр хувилбарын ялгаа:
- *Онлайн:* хэрэглэгчид бие биентэйгээ харилцах уу гэсэн асуултад **Yes**: тоглогчид бие биенийхээ хочийг харж, хамт тоглодог (чат байхгүй). Байршил хуваалцахгүй, дижитал худалдан авалт байхгүй.
- *Офлайн:* хэрэглэгчийн харилцаа **No**.

**Target audience and content:** **13–15, 16–17, 18+** насыг сонгохыг зөвлөж байна. 13-аас доош нас сонговол Google Play-ийн Families бодлогын нэмэлт шаардлага (зар, мэдээлэл цуглуулалт гэх мэт) хамаарна. Хуудасны зураг, тайлбар нь бага насны хүүхдэд зориулсан мэт (хүүхэлдэйн дүр гэх мэт) харагдвал Google татгалзаж болно. Нууцлалын бодлогод "13-аас доош насныханд зориулаагүй" гэж бичсэн.

**News app, COVID-19, Government, Financial features, Health:** бүгд **No / Not applicable**.

**Advertising ID:** **No**. Апп зар, аналитик SDK-гүй, manifest-д `AD_ID` зөвшөөрөл байхгүй.

**Data safety:** доорх 2.9.

### 2.9. Data safety (тухайн build-ийн бодит байдлаар)

Google-ийн тодорхойлолтоор "цуглуулах" гэдэг нь мэдээлэл утаснаас гадагш дамжихыг хэлнэ. Зөвхөн утсанд хадгалагдах мэдээллийг зарлах шаардлагагүй. Supabase бол таны өмнөөс ажилладаг **service provider** тул түүнд дамжуулахыг "хуваалцах" (sharing) гэж тооцохгүй.

#### Офлайн build (summary-д OFFLINE)

| Асуулт | Хариулт |
| --- | --- |
| Does your app collect or share any of the required user data types? | **No** |
| Account creation | Апп бүртгэл үүсгэдэггүй гэж хариулна. Офлайн "Бүртгүүлэх" нь зөвхөн утсанд үүсдэг; Google "бүрэн офлайн үүсэж ажилладаг бүртгэл бол аппын бүртгэл биш" гэж тодорхойлсон |
| Data deletion | Хэрэглэгч Тохиргоо → "Дотоод мэдээлэл устгах"-аар утсан дахь мэдээллээ устгадаг. Бүртгэл устгах вэб хаягийн талбар гарвал 1.3-ын `delete.html`-ийг өгч болно |

#### Онлайн build (summary-д ONLINE)

**Ерөнхий асуулт:**

| Асуулт | Хариулт |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS, WSS) |
| Account creation | **Yes**: имэйл ба нууц үгээр (тоглоом анх нээхэд зочин бүртгэл автоматаар үүсдэг) |
| Delete account URL | `…/privacy/delete.html` (1.3) |
| Do you provide a way for users to request that their data is deleted? | **Yes** |

**Цуглуулах мэдээлэл:**

| Ангилал → төрөл | Тоглоомд юу вэ | Collected | Shared | Ephemeral | Required/Optional | Зорилго |
| --- | --- | --- | --- | --- | --- | --- |
| Personal info → **Name** | хоч (Google "nickname"-ийг Name-д оруулдаг) | Yes | No | No | Required | App functionality, Account management |
| Personal info → **Email address** | "Бүртгэлээ хамгаалах" дээр өөрөө оруулсан имэйл | Yes | No | No | **Optional** | Account management |
| Personal info → **User IDs** | санамсаргүй бүртгэлийн дугаар (account ID) | Yes | No | No | Required | App functionality, Account management |
| App activity → **Other actions** | тоглолтын дүн, rank оноо, зоос, тоглолтын статистик ("gameplay" энд хамаарна) | Yes | No | No | Required | App functionality, Fraud prevention, security, and compliance |

**Зарлахгүй зүйлс ба шалтгаан:**
- *Location:* апп байршил авдаггүй. Сервер IP хаягийг хүлээн авдаг ч байршил тодорхойлоход ашигладаггүй (Google: IP-ээр байршил тодорхойлбол Approximate location зарлана).
- *Device or other IDs, App info and performance, Messages, Photos, Contacts гэх мэт:* цуглуулдаггүй.
- *Shared:* **No**. Supabase бол service provider. Хоч, rank тэргүүлэгчдийн жагсаалтад харагдах нь тоглогч rank тоглолтод орж байгаа үйлдлээрээ хүлээх зүйл тул Google-ийн "хэрэглэгчийн үйлдлээр дамжуулах" онцгой тохиолдолд хамаарна. Нууцлалын бодлогод тодорхой бичсэн. Эргэлзвэл "Shared: Yes, App functionality" гэж илүү болгоомжтой хариулж болно.

Энэ хүснэгт одоогийн кодыг (`src/js/20-cloud.js`, `supabase/migrations/`) үндэслэсэн. Зар, худалдан авалт, аналитик нэмэх бүрд Data safety болон нууцлалын бодлогыг **заавал** шинэчилнэ.

### 2.10. Хаалттай туршилт (closed test)

Хүсвэл эхлээд **Internal testing**-ээр өөрийн болон ойрын хүмүүсийн утсанд build-ээ шалгаж болно. Production эрх авахад **closed testing** хэрэгтэй.

1. **Test and release → Testing → Closed testing → Create track** (эсвэл бэлэн "Closed testing - Alpha").
2. **Testers**: туршигчдын Gmail хаягийн жагсаалт эсвэл Google Group нэмнэ. **Дор хаяж 12** хүн хэрэгтэй. Зарим нь дунд нь гарч болзошгүй тул 15–20 хүн урих нь найдвартай.
3. **Create release** → 2.5-ын `app-release.aab`-ийг upload хийнэ → release notes (монголоор) → **Save → Review release → Start rollout**. Google хянасны дараа туршилт нээгдэнэ.
4. Туршигчдад **opt-in холбоос**-ыг илгээнэ. Тэд холбоосоор орж "Become a tester" дараад Google Play-ээс суулгана.
5. 12+ туршигч **14 хоног тасралтгүй** opt-in хийсэн байх ёстой. Дундуур нь гарсан хүн тооцогдохгүй, дахин нэгдвэл 14 хоног шинээр эхэлнэ.
6. Туршилтын үеэр шинэ build (versionCode нь их) гаргаж засвар оруулж болно.

### 2.11. Production эрх авах ба гаргах

1. Шаардлага биелсний дараа **Dashboard → Apply for production**.
2. Хаалттай туршилт, апп, production-д бэлэн байдлын талаарх асуултад хариулна (туршигчдаас ямар санал авч юу зассанаа бичнэ).
3. Хяналт ихэвчлэн **7 хоног ба түүнээс бага** үргэлжилнэ.
4. Зөвшөөрсний дараа **Production → Create release** → туршсан build-ээ сонгоно (эсвэл шинээр upload) → улсуудаа сонгоод **Start rollout**. Эхлээд хувиар (staged rollout, жишээ нь 20%) гаргаж болно.

### 2.12. Store listing (Grow → Store presence → Main store listing)

Текст, зургийн бэлэн хувилбар `docs/store/listing.md`-д бий:

- App name, Short description (≤ 80), Full description (≤ 4000): монгол ба англи (Translations-аас англи хэлийг нэмнэ)
- App icon 512 × 512, Feature graphic 1024 × 500, утасны 2–8 дэлгэцийн зураг (4+ санал болгоно)
- **Store settings:** Category **Game → Puzzle**, tag-ууд, холбоо барих имэйл (заавал), вэбсайт (нууцлалын хуудас байж болно)

### 2.13. Бүртгэл устгах хаяг

Google Play апп дотор бүртгэл устгах зам болон аппгүйгээр устгуулах вэб хаяг хоёуланг нь шаарддаг.

- **Апп дотор:** Тохиргоо → "Дотоод мэдээлэл устгах" (онлайн үед серверийн бүртгэлийг `delete_my_account`-аар устгадаг). Бэлэн.
- **Вэб хаяг:** `…/privacy/delete.html`. Энэ хуудас аппын нэр ("Neon Duel"), хөгжүүлэгчийн нэр, апп доторх алхам, аппгүйгээр имэйлээр устгуулах арга, юу устах, юу үлдэхийг агуулсан. Хаягийг Data safety-ийн "Delete account URL" талбарт өгнө.
- Google-ийн шаардлагаар хүсэлтийг "боломжийн хурдан" биелүүлнэ. Хуудсанд "ихэвчлэн 7 хоног, хамгийн удаахдаа 30 хоног" гэж амласан тул имэйлээ тогтмол шалгаарай.

---

## 3. App Store

### 3.1. Apple Developer Program

- https://developer.apple.com/programs/enroll/ дээр **хувь хүн**-ээр бүртгүүлнэ. **Жилд 99 ам.доллар** (бүс нутгаас хамааран орон нутгийн мөнгөн тэмдэгтээр).
- Хоёр шатлалт баталгаажуулалттай (two-factor) Apple Account, **хуулийн нэр** (хоч биш) хэрэгтэй. Таны нэр App Store-д seller болж харагдана. Хаяг, утас бичнэ (шуудангийн хайрцаг болохгүй).

### 3.2. Build хийхэд юу хэрэгтэй

- **Mac + Xcode 26 эсвэл шинэ.** 2026-04-28-аас App Store Connect зөвхөн Xcode 26+ ба iOS 26 SDK-гаар бүтээсэн аппыг хүлээж авна.
- Mac байхгүй бол macOS-тэй CI (GitHub Actions-ийн macOS runner гэх мэт) эсвэл түрээсийн cloud Mac. Энэ repo-д iOS-ийн CI одоогоор байхгүй.

### 3.3. Төлөвлөгөө: Capacitor

Тоглоом нэг `index.html` тул [Capacitor 8](https://capacitorjs.com)-аар iOS-ийн WebView-д ачаалдаг Xcode project үүсгэнэ. Бүх файл аппын дотор байх тул интернэтгүй ажиллана. Бэлтгэсэн файлууд: `package.json`, `capacitor.config.json`, `tools/prepare-web.mjs`. Яг ямар команд ажиллуулах, Xcode-ийн тохиргоо, safe area, буцах товчны ялгаа, онлайн тохиргоог хэрхэн оруулахыг **`docs/IOS.md`**-ээс үзнэ.

### 3.4. App Store Connect

https://appstoreconnect.apple.com → **Apps → + → New App**:

| Талбар | Утга |
| --- | --- |
| Platform | iOS |
| Name | Neon Duel (≤ 30 тэмдэгт) |
| Primary language | English (U.S.). Монгол хэл App Store-ийн хуудасны хэлний жагсаалтад одоогоор байхгүй |
| Bundle ID | `com.anaraa.neonduel` (Xcode-д signing хийхэд бүртгэгдэнэ) |
| SKU | `neonduel-ios` (дотоод тэмдэглэгээ) |

**App Information:** Subtitle (≤ 30), Category: **Games → Puzzle**, хоёрдогч **Action**. Privacy Policy URL: 1.3-ын хаяг. Age Rating асуулга: хүчирхийлэл гэх мэт бүгд None. Онлайн хувилбарт хэрэглэгчид бие биентэйгээ харилцах (чат биш, хоч ба хамт тоглох) талаарх асуултыг үнэнээр хариулна.

**Version хуудас:** Promotional text (≤ 170), Description (≤ 4000), Keywords (≤ 100 byte), Support URL (холбоо барих мэдээлэлтэй хуудас байх ёстой: нууцлалын бодлогын хуудсанд имэйл бий), дэлгэцийн зураг (`docs/store/listing.md`).

**Pricing and Availability:** Free, улсуудаа сонгоно.

**App Privacy:**

| Build | Хариулт |
| --- | --- |
| Офлайн | **Data Not Collected** |
| Онлайн | **Contact Info → Email Address** (зөвхөн хэрэглэгч өөрөө нэмбэл): App Functionality, Linked to user, Tracking: No.<br>**Identifiers → User ID** (бүртгэлийн дугаар, хоч): App Functionality, Linked to user, Tracking: No.<br>**User Content → Gameplay Content** (тоглолтын дүн, rank): App Functionality, Linked to user, Tracking: No.<br>"Do you or your third-party partners use data for tracking?" → **No** |

**App Review Information** (review-д зориулсан тэмдэглэл, англиар):

```text
Neon Duel is a complete 1v1 falling-blocks battle game; all game files are bundled in the app and it works fully offline.
No login is needed: online builds create a guest account automatically. Ranked: if no opponent is found within
10 seconds, a clearly labelled bot match is offered, so the reviewer does not need a second device.
Account deletion: Settings > "Delete local profile" (online it deletes the server account).
Privacy policy and deletion page: <URL>
```

### 3.5. Review-ийн эрсдэл ба тоглоом түүнийг хэрхэн давах

**Guideline 4.2 (Minimum Functionality):** Apple "аппад зөвхөн дахин савласан вэбсайтаас илүү боломж, контент, UI байх ёстой. Удаан хугацааны зугаа цэнгэл эсвэл хангалттай ашиг тус өгөхгүй бол татгалзаж болно" гэж заасан. WebView-д суурилсан апп энэ шалтгаанаар ихэвчлэн буцаагддаг. Neon Duel-ийн давуу тал:
- Вэбсайт ачаалдаггүй: бүх тоглоом аппын дотор, интернэтгүй бүрэн ажиллана.
- Бүрэн тоглоом: AI-ийн 3 түвшин, rank ба 8 цол, онлайн 1v1, FT3, өдрийн шагнал, загвар, хоёр хэл.
- Утсанд зориулсан мэдрэгч удирдлага, дуу, хөгжим, тоглоомын шиг UI.
- Review-ийн тэмдэглэлд дээрхийг тодорхой бичнэ.

Сайжруулбал зохих зүйлс (тоглоомын кодонд, энэ PR-д хийгээгүй):
- Тоглоом доторх "prototype", "offline edition" гэх бичгийг арилгах (дуусаагүй апп мэт харагдуулна). Жишээ нь нууцлалын товчны текст, дэлгүүрийн "бодит төлбөр байхгүй" гэсэн мөр.
- iPhone-д чичиргээ ажиллуулах (`@capacitor/haptics`): нативын боломж нэмэгдэнэ.
- Бүтэн дэлгэц (safe area) дэмжих (`docs/IOS.md`, 6-р хэсэг).

**Guideline 5.1.1(v) (бүртгэл устгах):** бүртгэл үүсгэдэг апп бүртгэлийг апп дотроос устгах боломжтой байх ёстой. Автоматаар үүссэн зочин бүртгэлд ч хамаатай. Neon Duel-д Тохиргоо → устгах товч бий (онлайн үед серверийн бүртгэлийг бүрмөсөн устгадаг). Мөн "бүртгэлийн гол боломжгүй бол нэвтрэлтгүйгээр ашиглуул" гэсэн шаардлагыг хангадаг: нэвтрэлт шаардахгүй.

**Guideline 2.3.7 (metadata):** нэр, keyword-д бусад тоглоомын нэр, барааны тэмдэг бүү оруул. `docs/store/listing.md`-ийн keyword-ууд үүнийг дагасан.

### 3.6. Илгээх

Xcode → Archive → Upload → TestFlight-ээр туршина → App Store tab-д build-ээ сонгоод **Add for Review → Submit**. Дэлгэрэнгүй: `docs/IOS.md`, 9-р хэсэг.

---

## 4. Эх сурвалж

2026 оны 11-р сарын 15-нд шалгасан.

**Google Play**
- Target API шаардлага (шинэ апп, шинэчлэл 2026-08-31-ээс API 36): https://support.google.com/googleplay/android-developer/answer/11926878
- Бүртгэлийн хураамж 25 ам.доллар, карт, ID, Play Console аппаар баталгаажуулах: https://support.google.com/googleplay/android-developer/answer/6112435
- Хувь хүний шинэ бүртгэлийн туршилтын шаардлага (12 туршигч, 14 хоног, Apply for production, ≤ 7 хоног): https://support.google.com/googleplay/android-developer/answer/14151465
- Бүртгэл устгах шаардлага (апп доторх зам, вэб хаяг, Data safety): https://support.google.com/googleplay/android-developer/answer/13327111
- Data safety-ийн тодорхойлолт (Name, User IDs, Other actions, collection, sharing, IP): https://support.google.com/googleplay/android-developer/answer/10787469
- Нууцлалын бодлогын шаардлага (User Data policy): https://support.google.com/googleplay/android-developer/answer/10144311
- Play App Signing, upload key, upload key reset: https://support.google.com/googleplay/android-developer/answer/9842756
- Шинэ апп AAB-аар (2021-08-аас): https://android-developers.googleblog.com/2021/06/the-future-of-android-app-bundles-is.html
- Үнэгүй аппыг төлбөртэй болгох боломжгүй: https://support.google.com/googleplay/android-developer/answer/6334373
- Target audience, Families бодлого: https://support.google.com/googleplay/android-developer/answer/9867159
- Хуудасны текстийн хязгаар (нэр 30, богино 80, бүрэн 4000): https://support.google.com/googleplay/android-developer/answer/13393723
- Icon, feature graphic, screenshot шаардлага: https://support.google.com/googleplay/android-developer/answer/9866151
- Store listing-ийн хэлний кодууд (mn-MN): https://support.google.com/googleplay/android-developer/answer/9844778

**Android build**
- AGP 8.13: Gradle 8.13+, JDK 17, build-tools 35.0.0, API 36.1 хүртэл: https://developer.android.com/build/releases/agp-8-13-0-release-notes
- Android 16-ийн өөрчлөлт (predictive back, edge-to-edge, том дэлгэц, game category): https://developer.android.com/about/versions/16/behavior-changes-16
- Predictive back ба `enableOnBackInvokedCallback`: https://developer.android.com/guide/navigation/predictive-back-gesture
- GitHub Actions-ийн Node 20 зогсолт (2026-09-23): https://github.blog/changelog/2026-03-17-deprecation-of-node-20-on-github-actions-runners/

**Apple**
- Apple Developer Program: 99 USD/жил, хувь хүний бүртгэл: https://developer.apple.com/programs/enroll/
- Үнэгүй ба төлбөртэй гишүүнчлэлийн ялгаа: https://developer.apple.com/support/compare-memberships
- Xcode 26 / iOS 26 SDK шаардлага (2026-04-28-аас): https://developer.apple.com/news/upcoming-requirements/?id=04282026a
- App Review Guidelines (4.2, 4.7, 5.1.1(v), 2.3.7): https://developer.apple.com/app-store/review/guidelines/
- Бүртгэл устгах (зочин бүртгэл орно): https://developer.apple.com/support/offering-account-deletion-in-your-app
- Нэр 30, subtitle 30, keyword 100, promotional text 170, 10 зураг: https://developer.apple.com/app-store/product-page/
- Description 4000, keyword 100 byte, Support URL: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information
- App Privacy-ийн мэдээллийн төрөл: https://developer.apple.com/app-store/app-privacy-details/
- App Store-ийн хэлүүд (монгол байхгүй, 2026-03-ын байдлаар): https://9to5mac.com/2026/03/31/app-store-connect-adds-11-new-languages-for-localized-app-metadata/

**Capacitor**
- Capacitor 8: Node 22+, Xcode 26+, iOS 15, SPM анхдагч: https://capacitorjs.com/docs/updating/8-0
- Capacitor 8.5 (iOS UIScene): https://capacitorjs.com/docs/updating/8-5
- Тохиргооны сонголтууд (`contentInset`, `scrollEnabled`, `android.path` гэх мэт): https://capacitorjs.com/docs/config
- Privacy manifest: https://capacitorjs.com/docs/ios/privacy-manifest

**GitHub Pages**
- Branch-ийн `/docs` хавтаснаас нийтлэх, нийтийн repo-д үнэгүй: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
