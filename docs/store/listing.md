# Neon Duel: дэлгүүрийн хуудасны текст ба зураг

Google Play болон App Store-ийн хуудсанд хуулж тавих текст. Тэмдэгтийн тоог `python3` ашиглан тоолсон (хоосон зай, цэг таслал орсон).

**Анхаарах:** дэлгүүрийн хуудас, зураг, түлхүүр үгэнд "Tetris", "тетрис", "TETR.IO" гэх үг огт бүү ашигла. Тоглоомыг "блок тулаан", "унаж буй блокийн тоглоом" (falling blocks, block battle) гэж тодорхойлно. Ижил шалтгаанаар "T-spin", "tetromino" гэх нэр томъёог дэлгүүрийн текстэд оруулаагүй ("spin" гэж бичсэн).

Нэр: одоохондоо **Neon Duel** (9 тэмдэгт). Өөр нэр сонгох судалгааг өөр агент хийж байгаа тул эцсийн нэр гарвал энд солино.

Онлайн хэсэг (Supabase) холбогдсон хувилбарыг гаргах эсэхээс хамаарч бүрэн тайлбарын "ОНЛАЙН 1V1" хэсгийг үлдээх эсвэл доорх офлайн хувилбараар солино. Дэлгүүрийн текст тухайн build-д байгаа боломжийг л дурдах ёстой.

---

## 1. Монгол хэл (Google Play: mn-MN)

App Store Connect дээр монгол хэлээр хуудас хийх боломжгүй (дэмждэг хэлний жагсаалтад байхгүй). App Store-д англи хуудсыг үндсэн болгоно. Google Play монгол хэлийг (mn-MN) дэмждэг.

### Нэр (≤ 30)

```text
Neon Duel
```

9 тэмдэгт.

### Богино тайлбар (Google Play, ≤ 80)

```text
Блок унагаж мөр цэвэрлэ, өрсөлдөгч рүүгээ саад илгээ. 1v1 тулаан, бөхийн цол.
```

77 тэмдэгт.

### Бүрэн тайлбар (≤ 4000)

```text
Neon Duel бол хоёр тоглогчийн блок тулаан. Унаж буй блокоо эргүүлж, зөв газарт нь тавьж мөр цэвэрлэ. Нэг дор олон мөр цэвэрлэх тусам өрсөлдөгчийн талбарт доороос илүү олон саадтай мөр орж очно. Талбар нь дүүрч, шинэ блок гарах зайгүй болсон тал хожигдоно.

ТУЛААНЫ ДҮРЭМ
• 2, 3, 4 мөр зэрэг цэвэрлэвэл 1, 2, 4 саадтай мөр илгээнэ
• Блокоо эргүүлж шургуулах (spin), тасралтгүй COMBO, дараалсан хүчтэй цэвэрлэлт (B2B), талбараа бүрэн цэвэрлэх (ALL CLEAR) нь илүү хүчтэй дайралт болно
• Ирж буй саадаа мөр цэвэрлэж цуцал: хэмжүүр дээр улбар шар нь ирж яваа, улаан нь бэлэн болсон саадыг харуулна
• Дараагийн 5 блок харагдана, нэг блокоо хадгалж болно
• Хоёр тоглогчид блок ижил дарааллаар ирдэг тул ялалт зөвхөн ур чадвараас шалтгаална

ЦОЛОО АХИУЛ
• Rank тоглолтоор Шинэ бөхөөс эхлээд Начин, Харцага, Заан, Гарьд, Арслан, Аварга, Даян аварга хүртэл ахина
• Цол бүр D-ээс X хүртэлх үсгэн зэрэгтэй
• Эхний 5 тоглолт байршуулах тоглолт, түүний дараа цол олгоно
• Өөрөөсөө өндөр оноотой өрсөлдөгчийг хожвол илүү их оноо авна
• Цол ахих, буурах бүрд дүнгийн дэлгэц дээр мэдэгдэнэ

ОНЛАЙН 1V1
• Ижил цолтой тоглогчийг хайж олоод шууд тоглоно
• Тоглогч олдохгүй бол "бот" гэж тодорхой тэмдэглэсэн өрсөлдөгчтэй тоглож болно
• Тэргүүлэгчдийн жагсаалтаас өөрийн байраа хар
• Имэйлээр бүртгэлээ хамгаалж, өөр утсаар нэвтэр

ИНТЕРНЭТГҮЙ Ч ТОГЛОНО
• NOVA AI-тай Хялбар, Дунд, Хүнд түвшинд бэлтгэл хий
• Бэлтгэлд удаашруулах, бамбай, цэвэрлэх чадварыг асааж болно
• Нэг тоглолт эсвэл 3 хожсон нь ялах (FT3) формат сонго

УТСАНД ЗОРИУЛСАН УДИРДЛАГА
• Дэлгэцийн хаана ч товшвол блок эргэнэ
• Хуруугаа зүүн, баруун тийш гулсуулахад блок дагаж хөдөлнө
• Доош шударвал шууд унана, дээш шударвал хадгална
• Хүсвэл доорх товчнуудаар тоглож болно

БАС
• Өдөр бүр орж шагналаа ав
• Тоглож олсон зоосоороо неон, туйлын туяа, нар жаргах өнгөний загвар нээ. Загвар тоглолтод давуу тал өгөхгүй
• Монгол, англи хэлтэй
```

1887 тэмдэгт.

**Офлайн build гаргах бол** "ОНЛАЙН 1V1" хэсгийг бүхэлд нь дараахаар солино:

```text
RANK ТОГЛОЛТ
• Өөрийн түвшинд тохирсон, "бот" гэж тэмдэглэсэн өрсөлдөгчидтэй rank тоглолт хийж цолоо ахиул
```

---

## 2. English (Google Play: en-US, App Store: English U.S. as the primary language)

### Name (≤ 30)

```text
Neon Duel
```

9 characters.

### Short description (Google Play, ≤ 80)

```text
Drop blocks, clear lines, send garbage. 1v1 block battles with wrestling ranks.
```

79 characters.

### Subtitle (App Store, ≤ 30)

```text
1v1 block battles, ranked
```

25 characters.

### Promotional text (App Store, ≤ 170)

```text
Clear lines, send garbage and climb eight titles inspired by Mongolian wrestling, from Rookie to Grand Titan. Ranked 1v1 online, or practise offline.
```

149 characters.

### Full description (≤ 4000)

```text
Neon Duel is a two-player block battle. Rotate the falling blocks, drop them into place and clear lines. The more lines you clear at once, the more garbage rows rise into your rival's board from below. When a board fills up and the next block has no room, that player loses.

HOW BATTLES WORK
• Clear 2, 3 or 4 lines at once to send 1, 2 or 4 garbage rows
• Spins, unbroken combos, back-to-back big clears (B2B) and clearing the whole board (ALL CLEAR) hit even harder
• Cancel incoming garbage by clearing lines: the meter shows what is on its way (orange) and what is ready to land (red)
• See the next 5 blocks and hold one for later
• Both players get blocks in the same order, so only skill decides

CLIMB THE TITLES
• Ranked matches take you from Rookie through Falcon, Hawk, Elephant, Garuda, Lion and Titan up to Grand Titan, eight titles inspired by Mongolian wrestling
• Every title has letter grades from D to X
• Your first 5 matches are placement matches
• Beat higher-rated opponents to earn more points
• The result screen tells you when you rank up or down

ONLINE 1V1
• Get matched with players of your own title and play live
• If nobody is around, play a clearly labelled bot instead
• Find your place on the leaderboard
• Secure your account with an email and sign in on another phone

PLAY WITHOUT INTERNET
• Practise against NOVA AI on Easy, Normal or Hard
• Turn on powers for practice: Slow, Shield and Clear
• Play single games or first to 3 wins (FT3)

MADE FOR TOUCH
• Tap anywhere to rotate
• Slide left or right and the block follows your finger
• Flick down to drop, swipe up to hold
• Prefer buttons? They are there too

AND MORE
• Daily rewards for coming back
• Unlock the Neon, Aurora and Sunset block styles with coins you earn by playing. Styles never change gameplay
• Mongolian and English
```

1827 characters.

**For an offline build**, replace the whole "ONLINE 1V1" section with:

```text
RANKED MATCHES
• Climb the titles in ranked matches against clearly labelled bots tuned to your level
```

### App Store: one Mongolian paragraph at the top of the English description (optional)

App Store has no Mongolian page, so many players in Mongolia will read the English one. A short Mongolian paragraph at the very top helps them:

```text
Монгол, англи хэлтэй хоёр тоглогчийн блок тулаан. Мөр цэвэрлэж өрсөлдөгч рүүгээ саад илгээ, Шинэ бөхөөс Даян аварга хүртэл цолоо ахиул.
```

### Keywords (App Store, ≤ 100 bytes, commas, no spaces)

```text
block,puzzle,battle,versus,1v1,pvp,falling,lines,ranked,multiplayer,offline,arcade,wrestling
```

92 bytes. Words from the app name ("neon", "duel") are not repeated: Apple already searches the name. Never add other games' names or trademarks.

---

## 3. Ангилал ба tag

| | Google Play | App Store |
| --- | --- | --- |
| Төрөл | Game (тоглоом) | Games |
| Ангилал | **Puzzle** (санал болгох), эсвэл Arcade | Үндсэн: **Puzzle**, хоёрдогч: **Action** |
| Tag | Play Console-ийн бэлэн жагсаалтаас 5 хүртэл tag сонгоно. Тоглоомын төрөл (блок/пазл), олон тоглогчтой, офлайн тоглох гэх мэт яг тохирохыг сонго | (tag байхгүй, дээрх keywords) |

Puzzle ангилалд унаж буй блокийн тоглоомууд ихэвчлэн байрладаг. 1v1 тулааныг онцлох бол Arcade/Action сонгож болно.

---

## 4. Дэлгэцийн зураг (screenshot)

**Шаардлага:**
- Google Play: утасны хувьд 2-оос 8 зураг. JPEG эсвэл 24-bit PNG (alpha-гүй), богино тал нь 320 px-ээс, урт тал нь 3840 px-ээс хэтрэхгүй, урт тал богино талаасаа 2 дахин ихгүй. Санал болгох нь: босоо 9:16, дор хаяж 1080 × 1920, 4 ба түүнээс олон зураг.
- App Store: 10 хүртэл зураг; эхний 1–3 нь хайлтын үр дүнд харагдана. Яг хэмжээг App Store Connect-ийн "Screenshot specifications" хуудсаас шалгана (6.9" эсвэл 6.5" iPhone-ийн хэмжээ шаардагддаг). Зөвхөн iPhone-д гаргавал iPad-ийн зураг хэрэггүй (docs/IOS.md).
- Хоёуланд нь: үнэ, "үнэгүй", "#1", "шилдэг" гэх үг, Google Play/App Store-ийн тэмдэг, бусад тоглоомын нэр бүү оруул.

**Яаж авах:** утсан дээр тухайн build-ийг суулгаж тоглолтын үеэр дэлгэцийн зураг авна (Android: асаах + дууны доод товч). Монгол хуудсанд тоглоомын хэлийг МН, англи хуудсанд EN болгож авна (нүүр дэлгэцийн хэлний товч). Зургийн дээр 2–5 үгтэй тайлбар (caption) нэмж болно.

| # | Дэлгэц | Монгол тайлбар | English caption |
| --- | --- | --- | --- |
| 1 | Онлайн эсвэл ботой тоглолтын дунд: хоёр талбар, саадын хэмжүүр, дайралт харагдаж байгаа агшин | Мөр цэвэрлэ. Өрсөлдөгчөө дар. | Clear lines. Crush your rival. |
| 2 | COMBO, B2B эсвэл ALL CLEAR бичиг гарч буй агшин | Combo хийж хүчтэй дайр | Chain combos into big attacks |
| 3 | Rank тоглолт: өрсөлдөгч олдсон VS дэлгэц (хоёр талын цол) | Ижил цолтой тоглогчтой 1v1 | 1v1 against your own title |
| 4 | Профайл → Цолын шат (Шинэ бөхөөс Даян аварга) | Шинэ бөхөөс Даян аварга хүртэл | Climb from Rookie to Grand Titan |
| 5 | Хожсоны дараах дүнгийн дэлгэц, цол ахисан мэдэгдэлтэй | Хожих бүрд цол ахи | Rank up with every win |
| 6 | Нүүр дэлгэц: AI-ийн түвшин (Хялбар, Дунд, Хүнд) | Интернэтгүй ч NOVA AI-тай бэлтгэл | Practise offline vs NOVA AI |
| 7 | Блокийн загвар (дэлгүүр): гурван өнгөний загвар | Неон загвараа сонго | Pick your neon style |
| 8 | Заавар (удирдлагын тайлбар) эсвэл хуруугаар удирдаж буй агшин | Нэг гараар, хялбар удирдлага | Simple one-hand touch controls |

Онлайн хэсэггүй (офлайн) build гаргавал 3-р зургийг ботой тоглолтоор, тэргүүлэгчдийн жагсаалтыг харуулахгүйгээр авна.

---

## 5. Feature graphic (Google Play, 1024 × 500)

- Хэмжээ: яг **1024 × 500 px**, JPEG эсвэл 24-bit PNG, **alpha (тунгалаг) байхгүй**.
- Санаа: тоглоомын хар хөх дэвсгэр (#070C1B), нимгэн неон тор. Зүүн талд "NEON DUEL" лого (хөх #2AA8FF → нил ягаан #8F3CFF градиент), баруун талд хоёр талбар бие бие рүүгээ харсан, дунд нь "VS". Унаж буй хөх, ягаан блокууд.
- Чухал зүйлсээ (лого, VS) голд нь байрлуул, захыг хоосон үлдээ: зарим газар зургийг тайрч эсвэл дээр нь товч тавьж харуулдаг.
- Текстийг аль болох цөөн (зөвхөн лого). "Free", "#1", "New", "Sale" гэх үг, Google Play-ийн тэмдэг, утасны хүрээ бүү оруул.
- Монгол, англи хуудсанд нэг зургийг ашиглаж болно (зөвхөн логотой бол).

## 6. Icon

- **Google Play:** 512 × 512 px, 32-bit PNG (alpha-тай), 1024 KB-аас бага. Зэрэглэл, үнэ, ангиллыг илтгэх тэмдэг, бичиг бүү нэм. Дөрвөлжин бүтэн зураг өгнө, булангийн дугуйруулалтыг Google Play өөрөө хийдэг.
- **App Store:** 1024 × 1024 px PNG, тунгалаг хэсэггүй, булангаа дугуйруулахгүй (iOS өөрөө дугуйруулна). Xcode-ийн Assets → AppIcon-д тавина.
- Одоогийн icon (android/app/src/main/res/mipmap-*): хар хөх дэвсгэр дээр хөх, нил ягаан гэрэлтэй дөрвөлжин блокууд. Хамгийн том нь 192 × 192 тул 512 болон 1024 хэмжээг анхны эх зургаас (эсвэл дахин зурж) гаргах хэрэгтэй. 192-ийг томруулбал бүдгэрнэ.
- Зураг, өнгөний чиглэлийг харагдах байдал дээр ажиллаж буй агенттай уялдуулна.
