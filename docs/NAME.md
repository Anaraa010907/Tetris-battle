# Тоглоомын нэр: Khan Blocks

**Шийдвэр (эзэмшигч сонгосон, 2026-11-15):** тоглоомын нэр **Khan Blocks**. Латин үсгээр, монгол ба англи хэлэнд адилхан
(энэ бол брэнд).

- Google Play / App Store нэр: **Khan Blocks: 1v1 Block Battle** (англи, 29 тэмдэгт), **Khan Blocks: Блокийн тулаан** (монгол, 27 тэмдэгт)
- Апп дүрсний доорх нэр: **Khan Blocks**; Android багц: `com.anaraa.khanblocks` (Google Play-д хараахан ороогүй тул одоо солив)
- Лого: дээр нь хааны титэмтэй алтан «KHAN», доор нь хээтэй зурвасын дунд хөх-цагаан «BLOCKS» (`src/body.html`, `src/css/46-home.css`)
- Уриа: «Мөрөө цэвэрлэ. Өрсөлдөгчөө ял. Их хаан бол.» / "Clear lines. Crush rivals. Become the Great Khan."
- Цолны шат хааны цэргийн цолоор: Цэрэг → Аравт (10 цэргийн дарга) → Зуут (100) → Мянгат (1 000) → Түмэн (10 000) → Жанжин →
  Хаан → Их хаан. Англиар Warrior, Arban, Zuun, Mingghan, Tumen, General, Khan, Great Khan.

**Нэрийг нэг газраас солино:** `src/i18n/45-brand.json`-ийн `brandName`. Build нь `@@brand@@`-ийг (хуудасны гарчиг, ачаалах
дэлгэц), тоглоом орчуулгын доторх `{@brandName}`-ийг түүгээр солиж, лого үгийг `63-home.js` зурна (нэг эсвэл хоёр үгтэй ямар ч нэр
багтана). Цолны нэр, утга, өнгө, тэмдэг `src/js/11-ranks.js`-ийн `TITLES` хүснэгт ба `src/i18n/46-titles.json`-д; серверийн
`rank_title()` нь `supabase/migrations/20261117000000_khan_titles.sql`-д.

Тоглогч хэзээ ч харахгүй дотоод нэрс хуучнаараа үлдсэн: `localStorage`-ийн түлхүүр (`neon-duel`, `neon-duel-outbox`,
`neon-duel-session`; солибол хадгалсан ахиц алдагдана), APK workflow тохиргоо оруулдаг `#neon-config` блок, `NEON_VERSION_CODE`
орчны хувьсагч, хуучин migration-ийн файлын нэр.

## Анхааруулга: Чингис хааны нэр, дүр

Монгол Улс Чингис хааны нэр, дүрсийг худалдааны зорилгоор ашиглахыг хязгаарладаг. Тиймээс тоглоомд «Чингис/Chinggis»
гэсэн нэр, бодит хүний хөрөг огт ашиглаагүй. «Хаан», «Их хаан» нь ерөнхий цол; лого дээр зөвхөн ерөнхий титэм, хээ байна.

## Нэр солих болсон шалтгаан (Neon Duel)

1. **Google Play дээр бараг ижил нэртэй тоглоом бий.** «NEON Duel Legacy» (хөгжүүлэгч mjr.at, багц `com.mkoitz.neonduels`):
   хоёр тоглогчийн гэрэлтэх мотоциклын тулаант аркад, 10 мянгаас дээш татагдсан, 2026 оны 9-р сарын 25-нд шинэчлэгдсэн
   ([Google Play](https://play.google.com/store/apps/details?id=com.mkoitz.neonduels),
   [хөгжүүлэгчийн хуудас](https://play.google.com/store/apps/developer?id=mjr.at)).
2. **Ойролцоо нэр олон:** [Neon Duelers](https://whynotfailagain.itch.io/neon-duelers),
   [Neon Dash Duels](https://portfolio.fh-salzburg.ac.at/projects/2026-neon-dash-duels).
3. **«Neon» хэт түгээмэл:** [Neon Chrome](https://apps.apple.com/app/id981035758),
   [Neon Spellstorm](https://apps.apple.com/us/app/-/id6746943645), барааны тэмдэг
   [NEON LEAGUE](https://trademarkregistration.app/Trademark/Details/99237302),
   [NEON KNIGHTS](https://trademarkregistration.app/Trademark/Details/97374975),
   [NEON ABYSS](https://markinton.com/trademark/neon-abyss-99332213).

«Neon Duel»-ийн эрсдэл: **дунд-өндөр** (шууд ижил нэртэй тоглоом Google Play дээр байна).

## Khan Blocks: шалгалт

- Вэб хайлтаар «Khan Blocks» нэртэй тоглоом, апп олдсонгүй ([хайлтын үр дүн: зөвхөн KBlocks гэх мэт өөр нэртэй блок
  тоглоомууд](https://docs.kde.org/stable5/en/kblocks/kblocks/introduction.html), боловсролын «blocks» тоглоомууд). Зохицуулагч
  мөн Google Play-ээс «Khan Blocks» тоглоом олоогүй.
- «Khan» үгтэй том брэнд: **Khan Academy** ([App Store](https://apps.apple.com/app/id469863705),
  [Google Play хуудас](https://appgoblin.info/apps/org.khanacademy.android)). Энэ бол боловсролын апп, өөр ангилал (Education)
  бөгөөд «Khan Blocks» нь «Khan Academy»-тэй андуурагдахгүй нэр. Гэхдээ дэлгүүрийн тайлбар, дүрсэнд «Academy», боловсролын
  хэв маяг бүү ашигла.
- «Khan» үгтэй тоглоомууд бий ([Game of Khans](https://apps.apple.com/us/app/-/id1459071612), стратеги), гэхдээ «Khan» нь
  түүхэн ерөнхий цол тул дангаараа хэн нэгний өмч биш. «Khan Blocks» хослолоороо өвөрмөц.
- «Block Duel» гэдэг үгийг нэр болгож болохгүй (ийм нэртэй апп бий:
  [Block Duel](https://appgoblin.info/apps/com.bobog.gg.block_duel),
  [Blocks Duel](https://apps.apple.com/dk/app/blocks-duel/id6473790821),
  [Blokus Duel](https://apps.apple.com/us/app/-/id6680160663)), тиймээс «1v1 Block Battle» нь зөвхөн тайлбар.

Эрсдэл: **бага**. Гэхдээ энэ бол вэб хайлтын урьдчилсан шалгалт, хуулийн дүгнэлт биш. Гаргахаас өмнө Google Play, App Store-ийн
хайлтад «Khan Blocks» гэж шууд хайж, [WIPO Global Brand Database](https://branddb.wipo.int/)-ээс 9, 41-р ангид шалгаж,
Монголын Оюуны өмчийн газарт бүртгүүлэх эсэхээ шийдээрэй. khanblocks.mn гэх мэт домэйн, Instagram/TikTok нэр сул эсэхийг ч шалгах.

## Бусад нэр дэвшигчид (харьцуулалт)

| Нэр | Давуу тал | Сул тал, олдсон зөрчил |
| --- | --- | --- |
| **Khan Blocks** ✔ (эзэмшигчийн сонголт) | Монгол өнгө аястай, гадаадынханд ч ойлгомжтой («khan» олонд танигдсан), «blocks» нь тоглоомын төрлийг шууд хэлнэ; хааны цэргийн цолтой нэг түүх | Khan Academy өөр ангилалд бий; «Chinggis» гэж огт бүү холбо |
| Avarga (Аварга) | Бөхийн дээд цол, богино | Эзэмшигч татгалзсан. АНУ-д 37-р ангид (барилга) ижил тэмдэг бий ([markinton.com](https://markinton.com/trademark/avarga-99484902)) |
| Naadam Blocks | Олон улсад танигдсан баяр | Баярын нийтлэг нэр, наадмын сэдэвтэй тоглоом олон ([Mori Uraldaan](https://apps.apple.com/us/app/-/id6743741535), [Aduuchin](https://appgoblin.info/apps/io.mongol.aduuchin)) |
| Ulzii (Өлзий) | Өлзий хээ = аз, хээтэй загвартай таарна | Гадаадынханд утга ойлгомжгүй, тулаан гэдэг санаа алга |
| Khee (Хээ) | Блокийн загвартай ижил, богино | «kh»-г буруу дуудна, хайлтад олдохгүй |
| Ovoo (Овоо) | Чулуу овоолох = блок давхарлах | Ижил нэртэй [ширээний тоглоом](https://www.analog.games/games/04a9bcd0-1c9b-45a5-bebf-e8851a2192b3/ovoo); тахилгын газар тул хүндэтгэлгүй санагдаж болно |
| Steppe Stack | Англиар уянгалаг | [Steppe Games](https://mwm.ai/apps/steppe-games/6739248475) апп бий, «Stack» нэр маш олон |
| Garid Duel | Цолны нэр | Гадаадад танигдаагүй, Krafton-ы [Garuda Saga](https://krafton.in/games/garuda-saga) |

## Нэр солиход хийсэн өөрчлөлт

- `src/`: `brandName`, гарчиг, ачаалах дэлгэц, толгойн лого, нүүрний лого (титэмтэй), уриа, найздаа илгээх текст, цолны нэр,
  утга, тэмдэг; дэлгүүрийн дүрс, feature graphic-ийг `tools/store_art.py` тоглоомын өөрийн зурагнаас гаргана
- `android/`: label «Khan Blocks», `namespace`/`applicationId` `com.anaraa.khanblocks`, `MainActivity` шинэ хавтсанд,
  `rootProject.name` «KhanBlocks», `Theme.KhanBlocks`, launcher icon; `capacitor.config.json`, `package.json`; workflow-ийн
  artifact нэр `khan-blocks-*`
- Сервер: `20261117000000_khan_titles.sql` (`rank_title()` шинэ нэрээр; `title_index()` тоогоор тул өөрчлөгдөөгүй)
- Баримт бичиг: `README.md`, `docs/LAUNCH.md` (repo-г `khan-blocks` гэж нэрлэх санал), `docs/IOS.md`, `docs/SUPABASE.md`,
  `docs/store/listing.md`, `docs/privacy/index.html`, `docs/privacy/delete.html`
- Эзэмшигч/зохицуулагч засах: `CLAUDE.md`-ийн эхний мөр (агент засах эрхгүй), GitHub repo-ийн нэр

## Эх сурвалж

- NEON Duel Legacy: https://play.google.com/store/apps/details?id=com.mkoitz.neonduels
- mjr.at: https://play.google.com/store/apps/developer?id=mjr.at
- Neon Duelers: https://whynotfailagain.itch.io/neon-duelers
- Neon Dash Duels: https://portfolio.fh-salzburg.ac.at/projects/2026-neon-dash-duels
- Neon Chrome: https://apps.apple.com/app/id981035758
- Neon Spellstorm: https://apps.apple.com/us/app/-/id6746943645
- NEON LEAGUE: https://trademarkregistration.app/Trademark/Details/99237302
- NEON KNIGHTS: https://trademarkregistration.app/Trademark/Details/97374975
- NEON ABYSS: https://markinton.com/trademark/neon-abyss-99332213
- KBlocks (KDE): https://docs.kde.org/stable5/en/kblocks/kblocks/introduction.html
- Khan Academy (App Store): https://apps.apple.com/app/id469863705
- Khan Academy (Android): https://appgoblin.info/apps/org.khanacademy.android
- Game of Khans: https://apps.apple.com/us/app/-/id1459071612
- Block Duel: https://appgoblin.info/apps/com.bobog.gg.block_duel
- Blocks Duel: https://apps.apple.com/dk/app/blocks-duel/id6473790821
- Blokus Duel: https://apps.apple.com/us/app/-/id6680160663
- AVARGA (37-р анги): https://markinton.com/trademark/avarga-99484902
- Ovoo: https://www.analog.games/games/04a9bcd0-1c9b-45a5-bebf-e8851a2192b3/ovoo
- Steppe Games: https://mwm.ai/apps/steppe-games/6739248475
- Garuda Saga: https://krafton.in/games/garuda-saga
- Mori Uraldaan: https://apps.apple.com/us/app/-/id6743741535
- Aduuchin: https://appgoblin.info/apps/io.mongol.aduuchin

Шалгасан огноо: 2026-11-15.
