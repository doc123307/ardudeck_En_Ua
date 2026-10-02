# STOHID vs. ArduDeck: what this fork changes

[English](#english) · [Українська](#українська)

---

## English

**STOHID** («Стохід», ground robotic systems) is a fork of
[ArduDeck](https://github.com/rubenCodeforges/ardudeck) by rubenCodeforges.
This page lists everything the fork changes, so the differences from the original are easy to see.

- **Based on:** ArduDeck `master` at `5aa1d42` (1 Oct 2026, upstream version 0.1.2), all upstream commits merged.
- **Versions:** `<upstream version>-<fork version>`, for example `0.1.2-0.4` = ArduDeck 0.1.2 + fork release 4.
- **Licence:** unchanged (GPL-3.0). The About page credits ArduDeck and links to the original repository.

### 1. Ukrainian user interface
The whole UI can be switched between **English** (unchanged, still the default) and **Ukrainian**
(Settings → language).

- **Renderer.** All user-visible text goes through `t()` (i18next, `src/renderer/i18n`). Strings live in
  `src/renderer/i18n/locales/<lang>/<area>.json` with keys `<area>.<Component>.<string>`.
- **Main process.** Dialogs, progress and error messages use `mt()` from `src/main/i18n.ts`, fed with the
  language stored in settings.
- **Shared tables.** Check lists, parameter groups and calibration types in `src/shared/` read their text
  through `st(key, english)` from `src/shared/i18n-shim.ts`. The renderer installs the translator; the main
  process and tests keep English.
- **Helpers.** `ago()` / `fromNow()` / `justNow()` give localized relative times (Intl.RelativeTimeFormat).
  `enPlural()` handles English plural suffixes.
- **Tests.** `locales.test.ts` checks that every language has the same keys and placeholders, and bans
  i18next option names (`lng`, `ns`, ...) as placeholders.
- **What stays English on purpose:**
  - text that other code matches by substring (MSP/CLI errors such as "not supported", "timed out",
    "CLI mode");
  - the sim handover HTTP API;
  - flight-mode names (Manual, Hold, Auto, ...);
  - board and radio model names;
  - LLM tool descriptions;
  - Lua templates;
  - the on-radio EdgeTX widget text.

### 2. Branding
- **Name.** The product name is **STOHID** in English and «Стохід» in Ukrainian. It is shown in the window
  title, header, installer, splash screen and the EdgeTX radio widget. `src/shared/brand.ts` holds the
  names and links.
- **Artwork.** New icons (`png`/`ico`/`icns`), a splash screen with logo and tagline, the welcome-screen
  logo and the radio HUD logos.
- **Startup voice.** It now says "Welcome to STOHID".
- **About page.** It names ArduDeck as the base, with links to the original repository and to this fork.
  ArduDeck is not named anywhere else in the UI.
- **Updates.** The update check and release notes come from this fork (`doc123307/ardudeck_En_Ua`).
- **Unchanged internal identifiers**, so existing settings and installs keep working:
  - the settings folder;
  - the `ardudeck://` scheme;
  - `@ardudeck/*` packages and module slugs;
  - file formats and network identifiers;
  - the radio widget folder.

### 3. Added features
- **Operator mode.** The app opens on a simplified operator screen; the full UI (everything upstream has)
  is for the administrator and sits behind a password.
  - Operator screen: a status strip (armed state, mode, satellites and fix, battery, uptime, speed, roll and
    pitch with a tip-over warning, recording), the cameras (one large with thumbnails, or a grid), camera
    image controls, video recording, vehicle output buttons, a fold-out map, heading/altitude/speed/clock,
    STOP (Hold mode, also the Space key), optional mode buttons, and ARM/DISARM by holding the button.
  - The operator has no connection panel: the screen connects by itself to the link the administrator chose
    and keeps retrying.
  - Administrator sign-in: the operator's About page, the product logo held down for two seconds. On a
    fresh install the first sign-in creates the password.
  - The password is stored as a salted scrypt hash in `operator-admin.json`; wrong attempts are rate
    limited. Settings (`operator.json`) change only while the administrator is in: the main process
    refuses them otherwise, and it holds the unlocked state, so reloading the window does not open the UI.
  - The full UI closes again after 15 minutes without input (configurable), or by the header button.
  - In operator mode the window menu (Reload, Developer Tools) is removed.
  - Settings → "Operator workspace": start-up mode, auto-lock, operator link, buttons, tilt limits, support
    contact, password.
  - Code: `src/main/operator/`, `src/renderer/components/operator/`, `src/shared/operator-types.ts`.
- **Multi-camera view for one vehicle.** "All cameras" in the Vision panel tiles every feed of the vehicle side
  by side (1-4 columns). Clicking a tile makes it the main feed, which is the one used for snapshot, recording
  and click-to-point. The existing vehicle grid is unchanged.
- **IP camera image controls (Hikvision ISAPI).** Set per RTSP source; credentials and host default to the
  RTSP url.
  - Day/night/auto: `IrcutFilter`.
  - Supplement light (IR, white light, smart, off): `supplementLight`. Only the modes the camera reports are
    shown.
  - Digest auth is implemented without extra dependencies, and settings are changed read-modify-write so
    installer thresholds survive.
  - Code: `src/main/media/hikvision-isapi.ts`, `CameraControlBar.tsx`.
- **Mirror and 180° rotation per feed, and digital zoom.**
  - Mirror suits a rear-view camera.
  - Zoom works with the wheel toward the cursor, with drag-to-pan and −/+/1:1 buttons.
  - Click-to-point maps back through zoom and flips, so the gimbal points at what is under the cursor.
  - Code: `view-transform.ts`.
- **Vehicle output buttons (lights, marker lights, IR...).** They drive the flight controller's relays with
  `MAV_CMD_DO_SET_RELAY`, so relays on a DroneCAN node work through the flight controller.
  - A button lights only from `RELAY_STATUS` reported by the vehicle (requested with
    `SET_MESSAGE_INTERVAL`). It blinks while unconfirmed and marks an unconfirmed click or an
    unconfigured relay.
  - The button set is configurable.
  - Shown under the Vision panel and as a dock panel "Vehicle outputs".
  - `RELAY_STATUS` is padded before parsing, since MAVLink 2 trims its trailing zero bytes.
- **HD/SD switch for RTSP feeds.** Switches main and sub stream by rewriting the url:
  - Hikvision `/Streaming/Channels/101` ↔ `102` and `/h264/ch1/main|sub/`;
  - Dahua `subtype=0|1`.

  Code: `stream-quality.ts`.

### 4. Bug fixes (several also apply to upstream)
| Fix | Upstream too? |
|---|---|
| Hangar **app** install failures (e.g. the Trainer's `minAppVersion` gate) were stored but never rendered, so Install looked dead. The Apps section now shows the error with a dismiss button. | yes |
| `app.dock` is optional in current Electron typings, so `tsc` failed on `app.dock.setIcon` (`src/main/index.ts`). | yes |
| Desktop tests on Windows: `trainer-locator` joins paths in the style of the base path; the SITL relaunch test is skipped on Windows. | yes |
| `afterPack.cjs` hard-coded `@ardudeckdesktop` and `ArduDeck.app`; it now takes both names from the packager. | only when renamed |
| Text that doubled as an identifier was translated: the "Pilot cockpit" instrument preset, compass fit verdict, custom-frame "Physical" group, default log chart. Preset names are ids again; the UI shows a separate `label`. | fork only |
| **Leaving the Stick Test tab force-disarmed the vehicle.** The unmount cleanup of `StickTestPanel` sent `rcOverrideRelease` and a forced DISARM even when the test had never been started, so opening Parameters → Servo outputs and leaving it disarmed a vehicle that was driving or flying. It now only undoes what the test itself did, and also restores `ARMING_CHECK` when the test fails half-way. | yes |
| **`GPS_RAW_INT` / `SYS_STATUS` read past a zero-trimmed MAVLink 2 frame** in the main telemetry path: with no satellites the header showed `SAT undefined`, and an empty battery gave an undefined percentage. The trailing bytes are now read from a padded copy (as the fleet path already did). | yes |
| Battery "unknown" (`-1`) was printed as `-1%` in the video OSD and the HUD. | yes |
| Visiting the SITL view while already connected left the "switch to SITL" flag set: the next disconnect tried to reconnect and showed "SITL process failed to start". | yes |
| Console entries from different main-process sources reused the same ids, giving duplicate React keys in the debug console. Entries are numbered on arrival. | yes |
| A failed update check (no `latest.yml`, e.g. a draft release) dumped the HTTP error and a stack trace into the About page and the console. It is now one plain sentence. | fork only |
| **With two cameras on screen, starting or re-pointing one feed killed the other.** Two feeds opening together each launched the media hub (`ensureHub` had no single-flight). The second hub could not bind and exited, clearing the engine's handle to the first; from then on every feed start launched another doomed hub and rewrote `mediamtx.yml`, which the running hub hot-reloads, dropping every path added over the API. Now: one hub start at a time, the config file is written only when it changes, an exiting process clears the state only if it is the hub in use, a hub left by a killed run is reused, and a "live" session whose hub path has vanished is rebuilt (the player asks on its first reconnect). | yes |
| **Closed feeds kept being pulled.** Hub paths were removed with `POST …/delete/…`; MediaMTX wants `DELETE` and answered 404, so every feed ever opened kept streaming from the vehicle until the app closed. Stop and start of the same feed are now ordered, so the removal cannot overtake the re-add. Code: `src/main/media/hub-api.ts`. | yes |
| **Video recordings were empty files on Windows.** Recording was stopped by killing ffmpeg, which on Windows is immediate, so the MP4 never got its index (48-byte files). Recordings are now fragmented MP4 (playable even when cut short), stopped by asking ffmpeg to quit, named by date, time and camera, and a recording that cannot start is reported instead of shown as running. Code: `src/main/media/recording.ts`. | yes |
| Layout at small window sizes (1024–1366 px wide): telemetry header values wrapped under their labels, the Parameters header squeezed its buttons, the mission map tools ran off the map, the welcome logo was cut off, the OSD editor's profile tabs and a select were clipped, the mission toast covered the map search and dock tabs, a tooltip could outlive its host. | yes |

### 5. Build and packaging
- **Windows.** `nsis` installer plus a portable exe. Build with `pnpm exec electron-builder` (not `npx`) so
  the hoisted pnpm dependencies are bundled. mediamtx is fetched before packaging.
- **Linux.** AppImage and `.deb` built on GitHub Actions by `.github/workflows/build-linux-stohid.yml`, from
  source for a given tag. The executable is `stohid`.
- **Multi-vehicle orchestrator.** It is not bundled: `engine.json` points at a release of a private
  repository. The "Multiple vehicles" mode is therefore unavailable in fork builds.

### 6. Known limitations
- **ArduDeck Trainer** (Hangar app) cannot be installed. Its Hangar release declares
  `minAppVersion 1.1.0` and the archive layout (`build/ArduDeckTrainer.exe`, Godot) does not answer the
  current `--trainer-query` protocol, so it needs a newer host than ArduDeck 0.1.2 (the same applies to
  the original).

---

## Українська

**«Стохід»** (STOHID, наземні роботизовані комплекси) — форк
[ArduDeck](https://github.com/rubenCodeforges/ardudeck) автора rubenCodeforges.
Тут перелічено все, що змінено у форку, щоб відмінності від оригіналу було легко побачити.

- **Основа:** ArduDeck `master` на коміті `5aa1d42` (1 жовтня 2026, версія оригіналу 0.1.2), усі зміни
  оригіналу злито.
- **Версії:** `<версія оригіналу>-<версія форку>`, наприклад `0.1.2-0.4` = ArduDeck 0.1.2 + випуск форку 4.
- **Ліцензія:** без змін (GPL-3.0). Сторінка «Про програму» називає ArduDeck основою й дає посилання на
  оригінал.

### 1. Український інтерфейс
Увесь інтерфейс перемикається між **англійською** (без змін, як і раніше за замовчуванням) та
**українською** (Налаштування → мова).

- **Вікно програми.** Увесь видимий текст іде через `t()` (i18next, `src/renderer/i18n`). Рядки лежать у
  `src/renderer/i18n/locales/<мова>/<розділ>.json`.
- **Фоновий процес.** Діалоги, прогрес і повідомлення про помилки — через `mt()` (`src/main/i18n.ts`).
- **Спільні таблиці.** Таблиці в `src/shared/` (перевірки, групи параметрів, типи калібрування)
  перекладаються через `st()` (`src/shared/i18n-shim.ts`).
- **Відносний час.** Локалізовано («3 год тому», «щойно»).
- **Тест.** Перевіряє, що всі мови мають однакові ключі й підстановки.
- **Навмисно англійською:**
  - тексти, які код порівнює (помилки MSP/CLI);
  - API передачі симулятора;
  - назви польотних режимів;
  - назви плат і пультів;
  - шаблони Lua;
  - текст віджета на самому пульті EdgeTX.

### 2. Брендування
- **Назва.** STOHID / «Стохід» у заголовку вікна, шапці, інсталяторі, заставці та віджеті пульта.
  `src/shared/brand.ts` містить назви й посилання.
- **Графіка.** Нові іконки, заставка з логотипом і підписом, логотип на стартовій сторінці та в HUD пульта.
- **Голос під час запуску.** «Welcome to STOHID».
- **Сторінка «Про програму».** Єдине місце, де названо ArduDeck, з посиланнями на оригінал і на цей
  проєкт.
- **Оновлення.** Перевірка оновлень і примітки до випусків беруться з цього репозиторію.
- **Внутрішні ідентифікатори не змінено:**
  - тека налаштувань;
  - `ardudeck://`;
  - пакети `@ardudeck/*`;
  - модулі;
  - формати файлів;
  - тека віджета пульта.

### 3. Нові можливості
- **Режим оператора.** Програма відкривається на спрощеному екрані оператора; повний інтерфейс — для
  адміністратора, за паролем.
  - Екран оператора: смуга стану (ARM, режим, супутники, АКБ, час роботи, швидкість, крен і тангаж із
    попередженням про перекидання, запис), камери (одна велика з мініатюрами або сітка), керування
    камерами, запис відео, кнопки виходів борту, розкривна карта, курс/висота/швидкість/час, СТОП
    (режим Hold, також Пробіл), кнопки режимів на вибір, ARM/DISARM утриманням.
  - Панелі підключення в оператора немає: екран сам підключається до зв'язку, який вибрав адміністратор.
  - Вхід адміністратора: сторінка «Про програму», логотип, утриманий дві секунди. На новій установці
    перший вхід створює пароль.
  - Пароль зберігається як хеш (scrypt із сіллю) у файлі `operator-admin.json`; невдалі спроби
    обмежуються. Налаштування змінюються лише в режимі адміністратора — це перевіряє головний процес.
  - Повний інтерфейс закривається після 15 хв бездіяльності (налаштовується) або кнопкою в шапці.
  - Налаштування → «Простір пілота»: режим запуску, автовихід, підключення оператора, кнопки, межі
    нахилу, контакт підтримки, пароль.
- **Кілька камер одного апарата одночасно.** Режим «Усі камери» в панелі «Бачення» показує всі джерела
  апарата поруч (1-4 стовпці). Клік по плитці робить камеру основною: для знімка, запису й наведення підвісу.
- **Керування IP-камерою Hikvision (ISAPI):**
  - день/ніч/авто;
  - підсвітка: ІЧ, біле світло, розумна, вимк. Показуються лише ті режими, які підтримує камера.

  Логін і адреса типово беруться з RTSP-посилання.
- **Дзеркало й поворот на 180°** для кожної камери, **цифровий зум** (коліщатко, перетягування, кнопки −/+/1:1).
- **Кнопки виходів борту** (світло, габарити, ІЧ…) через реле польотного контролера (`DO_SET_RELAY`, у тому
  числі реле на DroneCAN-вузлі). Кнопка світиться лише за станом, який повідомив борт (`RELAY_STATUS`).
- **Перемикач HD/SD** для RTSP: основний ↔ додатковий потік (Hikvision `101` ↔ `102`, Dahua `subtype`).

### 4. Виправлення помилок
- **Встановлення програм із Hangar.** Помилка встановлення не показувалася, тож кнопка «Встановити»
  здавалася неробочою. Тепер повідомлення видно. Стосується й оригіналу.
- **Перевірка типів.** `app.dock` у нових типах Electron може бути відсутнім. Стосується й оригіналу.
- **Тести під Windows.** Шляхи в `trainer-locator`; тест перезапуску SITL пропускається на Windows.
  Стосується й оригіналу.
- **`afterPack.cjs`.** Більше не має жорстко прописаних назв `@ardudeckdesktop` і `ArduDeck.app`.
- **Перекладені ідентифікатори.** Набір приладів «Pilot cockpit» (через нього був порожній головний екран),
  оцінка калібрування компаса, блок гвинтів власної рами, графік журналу за замовчуванням. Лише у форку.
- **Примусовий DISARM під час виходу з вкладки «Тест стіків».** Вкладка «Параметри → Виходи
  сервоприводів» під час закриття надсилала примусовий DISARM і скидала RC override, навіть якщо тест
  не запускали: апарат, що їхав або летів, роззброювався. Тепер скасовується лише те, що зробив сам тест;
  `ARMING_CHECK` повертається й тоді, коли тест обірвався на півдорозі. Стосується й оригіналу.
- **`SAT undefined` і невизначений відсоток батареї.** MAVLink 2 обрізає нульові байти в кінці пакета;
  `GPS_RAW_INT` і `SYS_STATUS` читалися за межами обрізаного пакета. Стосується й оригіналу.
- **`-1%` батареї** в накладці на відео й HUD, коли борт не повідомляє залишок. Стосується й оригіналу.
- **Хибне «Процес SITL не запустився»** після відключення, якщо перед тим відкривали екран SITL.
  Стосується й оригіналу.
- **Однакові номери записів у консолі** з різних джерел головного процесу. Стосується й оригіналу.
- **Помилка перевірки оновлень** для чернеткового випуску: замість HTTP-дампу — одне зрозуміле речення.
- **Дві камери на екрані: запуск або перемикання однієї зупиняло іншу.** Під час одночасного старту двох
  потоків відеохаб запускався двічі; другий падав, після чого кожен запуск потоку переписував файл
  конфігурації хаба, а той, перечитавши його, втрачав усі додані потоки. Тепер хаб стартує один раз,
  конфігурація не переписується без потреби, а «живий» потік, який хаб втратив, відновлюється сам.
  Стосується й оригіналу.
- **Закриті потоки продовжували тягнутися з борту** (хаб не приймав команду видалення потоку) — зайвий
  трафік. Виправлено. Стосується й оригіналу.
- **Порожні файли запису відео під Windows.** Запис зупинявся «вбивством» ffmpeg, і MP4 лишався без
  індексу (48 байтів). Тепер це фрагментований MP4 (відтворюється навіть після обриву), зупинка коректна,
  назва файлу — дата, час і камера; якщо запис не почався, про це сказано. Стосується й оригіналу.
- **Верстка в невеликому вікні (1024–1366 px):** шапка телеметрії, шапка «Параметрів», інструменти на
  карті місії, логотип на стартовому екрані, ліва панель редактора OSD, сповіщення на екрані місії,
  «завислі» підказки. Стосується й оригіналу.

### 5. Збирання
- **Windows:** інсталятор і портативний exe.
- **Linux:** AppImage і `.deb` збираються на GitHub Actions
  (`.github/workflows/build-linux-stohid.yml`); файл програми `stohid`.
- **Модуль «Кілька апаратів»** (оркестратор) не входить у збірки: він у закритому репозиторії автора.

### 6. Відомі обмеження
- **ArduDeck Trainer** не встановлюється: у Hangar він вимагає версію 1.1.0 і новий протокол, яких ще
  немає ні в оригіналі, ні у форку.
