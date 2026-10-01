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
- **Кілька камер одного апарата одночасно.** Режим «Усі камери» в панелі «Бачення» показує всі джерела
  апарата поруч (1-4 стовпці). Клік по плитці робить камеру основною: для знімка, запису й наведення підвісу.
- **Керування IP-камерою Hikvision (ISAPI):**
  - день/ніч/авто;
  - підсвітка: ІЧ, біле світло, розумна, вимк. Показуються лише ті режими, які підтримує камера.

  Логін і адреса типово беруться з RTSP-посилання.
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

### 5. Збирання
- **Windows:** інсталятор і портативний exe.
- **Linux:** AppImage і `.deb` збираються на GitHub Actions
  (`.github/workflows/build-linux-stohid.yml`); файл програми `stohid`.
- **Модуль «Кілька апаратів»** (оркестратор) не входить у збірки: він у закритому репозиторії автора.

### 6. Відомі обмеження
- **ArduDeck Trainer** не встановлюється: у Hangar він вимагає версію 1.1.0 і новий протокол, яких ще
  немає ні в оригіналі, ні у форку.
