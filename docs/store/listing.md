# Khan Blocks: дэлгүүрийн хуудасны текст ба зураг

Google Play болон App Store-ийн хуудсанд хуулж тавих текст. Тэмдэгтийн тоог `python3` ашиглан тоолсон (хоосон зай, цэг таслал орсон).

**Анхаарах:** дэлгүүрийн хуудас, зураг, түлхүүр үгэнд "Tetris", "тетрис", "TETR.IO" гэх үг огт бүү ашигла. Тоглоомыг "блок тулаан", "унаж буй блокийн тоглоом" (falling blocks, block battle) гэж тодорхойлно. Ижил шалтгаанаар "T-spin", "tetromino" гэх нэр томъёог дэлгүүрийн текстэд оруулаагүй ("spin" гэж бичсэн).

Нэр: **Khan Blocks** (латинаар, хоёр хэлэнд адилхан). Дэлгүүрт монгол хуудсанд «Khan Blocks: Блокийн тулаан», англи хуудсанд «Khan Blocks: 1v1 Block Battle». Апп дүрсний доорх нэр: «Khan Blocks». Нэр сонгосон шалтгаан, ижил нэртэй апп, барааны тэмдгийн шалгалт: `docs/NAME.md`.

Онлайн хэсэг (Supabase) холбогдсон хувилбарыг гаргах эсэхээс хамаарч бүрэн тайлбарын "ОНЛАЙН 1V1" хэсгийг үлдээх эсвэл доорх офлайн хувилбараар солино. Дэлгүүрийн текст тухайн build-д байгаа боломжийг л дурдах ёстой.

---

## 1. Монгол хэл (Google Play: mn-MN)

App Store Connect дээр монгол хэлээр хуудас хийх боломжгүй (дэмждэг хэлний жагсаалтад байхгүй). App Store-д англи хуудсыг үндсэн болгоно. Google Play монгол хэлийг (mn-MN) дэмждэг.

### Нэр (≤ 30)

```text
Khan Blocks: Блокийн тулаан
```

27 тэмдэгт.

### Богино тайлбар (Google Play, ≤ 80)

```text
Блок унагаж мөр цэвэрлэ, өрсөлдөгчөө саадаар дар. 1v1 тулаан, хааны цэргийн цол.
```

80 тэмдэгт.

### Бүрэн тайлбар (≤ 4000)

```text
Khan Blocks бол хоёр тоглогчийн блок тулаан. Унаж буй блокоо эргүүлж, зөв газарт нь тавьж мөр цэвэрлэ. Нэг дор олон мөр цэвэрлэх тусам өрсөлдөгчийн талбарт доороос илүү олон саадтай мөр орж очно. Талбар нь дүүрч, шинэ блок гарах зайгүй болсон тал хожигдоно.

ТУЛААНЫ ДҮРЭМ
• 2, 3, 4 мөр зэрэг цэвэрлэвэл 1, 2, 4 саадтай мөр илгээнэ
• Блокоо эргүүлж шургуулах (spin), тасралтгүй COMBO, дараалсан хүчтэй цэвэрлэлт (B2B), талбараа бүрэн цэвэрлэх (ALL CLEAR) нь илүү хүчтэй дайралт болно
• Ирж буй саадаа мөр цэвэрлэж цуцал: хэмжүүр дээр улбар шар нь ирж яваа, улаан нь бэлэн болсон саадыг харуулна
• Дараагийн 5 блок харагдана, нэг блокоо хадгалж болно
• Хоёр тоглогчид блок ижил дарааллаар ирдэг тул ялалт зөвхөн ур чадвараас шалтгаална

ЦОЛОО АХИУЛ
• Rank тоглолтоор хааны цэргийн цолоор ахина: Цэрэг, Аравт (10 цэргийн дарга), Зуут (100), Мянгат (1 000), Түмэн (10 000), Жанжин, Хаан, Их хаан
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
• Монгол хээ угалзаас сэдэвлэсэн блок: блок бүр өөрийн хээтэй тул өнгө ялгахад бэрхшээлтэй хүн ч ялгана
• Тоглож олсон зоосоороо «Туйлын туяа», «Говийн үдэш» загвар нээ. Загвар тоглолтод давуу тал өгөхгүй
• Монгол, англи хэлтэй
```

2022 тэмдэгт.

**Офлайн build гаргах бол** "ОНЛАЙН 1V1" хэсгийг бүхэлд нь дараахаар солино:

```text
RANK ТОГЛОЛТ
• Өөрийн түвшинд тохирсон, "бот" гэж тэмдэглэсэн өрсөлдөгчидтэй rank тоглолт хийж цолоо ахиул
```

---

## 2. English (Google Play: en-US, App Store: English U.S. as the primary language)

### Name (≤ 30)

```text
Khan Blocks: 1v1 Block Battle
```

29 characters.

### Short description (Google Play, ≤ 80)

```text
Drop blocks, clear lines, send garbage. 1v1 block battles and khan army ranks.
```

78 characters.

### Subtitle (App Store, ≤ 30)

```text
Warrior to Great Khan, ranked
```

29 characters (the name already says "1v1 Block Battle").

### Promotional text (App Store, ≤ 170)

```text
Clear lines, send garbage and climb the eight ranks of a khan's army, from Warrior to Great Khan. Ranked 1v1 online, or practise offline.
```

137 characters.

### Full description (≤ 4000)

```text
Khan Blocks is a two-player block battle. Rotate the falling blocks, drop them into place and clear lines. The more lines you clear at once, the more garbage rows rise into your rival's board from below. When a board fills up and the next block has no room, that player loses.

HOW BATTLES WORK
• Clear 2, 3 or 4 lines at once to send 1, 2 or 4 garbage rows
• Spins, unbroken combos, back-to-back big clears (B2B) and clearing the whole board (ALL CLEAR) hit even harder
• Cancel incoming garbage by clearing lines: the meter shows what is on its way (orange) and what is ready to land (red)
• See the next 5 blocks and hold one for later
• Both players get blocks in the same order, so only skill decides

CLIMB THE TITLES
• Ranked matches take you through the eight ranks of a Mongol khan's army: Warrior, Arban (leads 10), Zuun (100), Mingghan (1,000), Tumen (10,000), General, Khan and Great Khan
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
• Blocks carved with Mongolian ornament: every piece has its own motif, so they are easy to tell apart even without colour
• Unlock the Aurora tubes and Gobi sunset styles with coins you earn by playing. Styles never change gameplay
• Mongolian and English
```

1971 characters.

**For an offline build**, replace the whole "ONLINE 1V1" section with:

```text
RANKED MATCHES
• Climb the titles in ranked matches against clearly labelled bots tuned to your level
```

### App Store: one Mongolian paragraph at the top of the English description (optional)

App Store has no Mongolian page, so many players in Mongolia will read the English one. A short Mongolian paragraph at the very top helps them:

```text
Монгол, англи хэлтэй хоёр тоглогчийн блок тулаан. Мөр цэвэрлэж өрсөлдөгч рүүгээ саад илгээ, Цэргээс Их хаан хүртэл цолоо ахиул.
```

### Keywords (App Store, ≤ 100 bytes, commas, no spaces)

```text
puzzle,versus,pvp,falling,lines,ranked,multiplayer,offline,arcade,duel,mongol,army,horde,empire
```

95 bytes. Words from the app name ("khan", "blocks", "block", "battle", "1v1") are not repeated: Apple already searches the name. Never add other games' names or trademarks.

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
| 4 | Профайл → Цолын шат (Цэргээс Их хаан хүртэл, цол бүр тэмдэгтэй) | Цэргээс Их хаан хүртэл | Rise from Warrior to Great Khan |
| 5 | Хожсоны дараах дүнгийн дэлгэц, цол ахисан мэдэгдэлтэй | Хожих бүрд цол ахи | Rank up with every win |
| 6 | Нүүр дэлгэц: AI-ийн түвшин (Хялбар, Дунд, Хүнд) | Интернэтгүй ч NOVA AI-тай бэлтгэл | Practise offline vs NOVA AI |
| 7 | Блокийн загвар (дэлгүүр): Хээ угалз, Туйлын туяа, Говийн үдэш | Хээтэй блокоо сонго | Pick your block style |
| 8 | Заавар (удирдлагын тайлбар) эсвэл хуруугаар удирдаж буй агшин | Нэг гараар, хялбар удирдлага | Simple one-hand touch controls |

Онлайн хэсэггүй (офлайн) build гаргавал 3-р зургийг ботой тоглолтоор, тэргүүлэгчдийн жагсаалтыг харуулахгүйгээр авна.

---

## 5. Feature graphic (Google Play, 1024 × 500)

- Бэлэн файл: **`docs/store/feature-graphic.png`** (1024 × 500, 24-bit PNG, alpha-гүй). Тоглоомын өөрийн зурагнаас гаргасан:
  талын шөнийн тэнгэр, гэрэлтэй гэр, титэмтэй алтан KHAN BLOCKS лого, хээтэй цагираг ба «Хээ угалз» загварын блокууд.
- Дахин гаргах бол: тоглоомыг build хийгээд `docs/store/` доторх зургийг ижил хэмжээгээр солино. Лого, цагирагийг голд нь
  байлгаж захыг хоосон үлдээ: зарим газар зургийг тайрч эсвэл дээр нь товч тавьж харуулдаг.
- Текстийг аль болох цөөн (зөвхөн лого). "Free", "#1", "New", "Sale" гэх үг, Google Play-ийн тэмдэг, утасны хүрээ бүү оруул.
- Монгол, англи хуудсанд нэг зургийг ашиглана (зөвхөн логотой).

## 6. Icon

- **Google Play:** 512 × 512 px, 32-bit PNG (alpha-тай), 1024 KB-аас бага. Зэрэглэл, үнэ, ангиллыг илтгэх тэмдэг, бичиг бүү нэм. Дөрвөлжин бүтэн зураг өгнө, булангийн дугуйруулалтыг Google Play өөрөө хийдэг.
- **App Store:** 1024 × 1024 px PNG, тунгалаг хэсэггүй, булангаа дугуйруулахгүй (iOS өөрөө дугуйруулна). Xcode-ийн Assets → AppIcon-д тавина.
- Бэлэн файлууд: **`docs/store/icon-512.png`** (Google Play, alpha-тай) ба **`docs/store/icon-1024.png`** (App Store, alpha-гүй).
  Android-ийн icon (`android/app/src/main/res/mipmap-*`, энгийн ба adaptive давхарга) ижил зургаар шинэчлэгдсэн: хар хөх шөнийн
  дэвсгэр дээр хээтэй алтан цагираг, голд нь «Хээ угалз» загварын алтан блок, дээр нь хааны титэм (бичиггүй).
- Icon, feature graphic, тоглоомын лого нэг хэв маягтай (алтан KHAN BLOCKS, титэм, хээ угалз, хар хөх шөнө).
