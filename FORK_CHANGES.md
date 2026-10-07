# STOHID vs. ArduDeck: what this fork changes

[English](#english) · [Українська](#українська)

---

## English

**STOHID** («Тунель» in the Ukrainian interface; ground robotic systems) is a fork of
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
- **Name.** The product name is **STOHID** in English and «Тунель» (by STOHID) in Ukrainian. It is shown in the window
  title, header, installer, splash screen and the EdgeTX radio widget. `src/shared/brand.ts` holds the
  names and links.
- **Wordmark and icon (0.1.2-0.18).** The header of the operator screen, of the full UI and of the
  activation screen shows the wordmark «ТУНЕЛЬ», drawn in even straight strokes after a tunnel portal
  (`src/renderer/components/ui/BrandMark.tsx`), instead of a small picture. The application icon is the
  portal with the letter «Т»; `scripts/make-icons.cjs` draws `icon.png` and `icon.ico`. The shortcut, the
  entry in the list of installed programs and the Linux menu entry are called «ТУНЕЛЬ»; file and folder
  names stay STOHID, so an update keeps the settings and the licence. The About page is unchanged.
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
  - Movable windows: every camera but the main one, and the map, is a window the operator drags, resizes
    freely and can pop out into its own OS window for a second monitor; closing that window brings it
    back. In the grid, the dividers between cameras are draggable. Places are stored as fractions of the
    screen, so they survive a resized window.
  - The administrator picks the status-strip values and their order (13 to choose from) and can switch
    screen elements off.
  - Mode switching: the administrator picks which Rover modes the operator may switch to (Manual, Acro,
    Steering, Loiter, Auto, RTL, SmartRTL, Guided, Follow, Simple, Circle, Dock). Up to three are buttons;
    more fold into one "Mode" list.
  - Code: `src/main/operator/`, `src/renderer/components/operator/`, `src/shared/operator-types.ts`.
- **Operator RC control over `RC_CHANNELS_OVERRIDE`.** All of it is set up by the administrator and runs in
  the main process, so the operator screen can be spread over several windows.
  - **Joystick driving.** A USB joystick or gamepad (Gamepad API) drives steering and throttle: axes,
    direction, dead zone, expo, channel numbers, PWM range and a throttle limit are configurable, with a
    live read-out. The operator takes control with a button, each session, and only with the stick
    centred. If the joystick stops being read (no window of the app in front, cable out) the vehicle gets
    neutral, then the channels are released; control resumes only after the stick is seen centred.
  - **Cruise control.** Holds the throttle. With the joystick it takes over the throttle held at that
    moment; pushing further adds, pulling the stick back cancels. `+` / `−` step it. STOP, disarming and a
    lost link cancel it. It holds the throttle position, not ground speed.
  - **Reverse driving.** A switch: forward on the stick drives the vehicle tail-first, steering mirrored
    (optional, depends on `PILOT_STEER_TYPE`), and the rear camera takes the main view. Switches only at
    a standstill.
  - **Custom functions.** Buttons (latching or momentary), three-position switches (staying, or returning
    to the centre) and sliders (staying, or sprung to minimum, centre or maximum), each on its own RC
    channel with its own PWM values, worked from the screen and, when assigned, from joystick buttons or
    axes ("press the control to assign"). A channel is left alone until the operator first uses its
    control, unless set to "send from connection"; a channel no longer driven is released (0 for
    channels 1-8, 65534 above), not left frozen.
  - Functions reach the vehicle either as an RC channel or as a servo output set directly
    (`MAV_CMD_DO_SET_SERVO`, sent once per change and held by the flight controller).
  - Code: `src/shared/operator-rc.ts` (rules), `src/main/operator/operator-rc-engine.ts` (20 Hz sender),
    `OperatorControlBar.tsx`, `OperatorRcSettings.tsx`.
- **Operator panel builder.** Settings → "Operator workspace" is split into tabs (control panel, values,
  driving and modes, screen, video, general).
  - **Control panel:** every control on the operator's bottom bar in one list - built-in ones (joystick,
    reverse, cruise, record, view tools), vehicle outputs (relays) and the administrator's own buttons,
    switches and sliders. Each can be moved, hidden, set up (name, icon, colour, channel or output, PWM
    values, behaviour, joystick binding) and, if not built in, removed; outputs and functions are added
    here. A live preview shows the bar as the operator will see it.
  - **Values:** besides the built-in ones, ANY value of the vehicle can be put on the status strip: a field
    of any MAVLink message it sends (picked from a live list with current values), a NAMED_VALUE_FLOAT/INT
    from a Lua script or companion computer, or a flight controller parameter, each with a name, unit,
    decimals, scale/offset and amber/red limits. Code: `src/shared/operator-panel.ts`,
    `src/renderer/stores/operator-values.ts`.
  - **Look:** the operator's controls are one compact bar instead of two rows: same-sized chips, an icon and
    a short name each, filled with the control's colour when on, thin dividers between groups; mode, ARM and
    STOP stay at the right end.
- **Vehicle list instead of the multi-vehicle orchestrator.** Upstream's "Multiple vehicles" tab needs a
  private orchestrator; this fork replaces it with its own vehicle list ("Vehicles" tab of the connection
  panel, and a vehicle switch in the operator screen's header).
  - Each vehicle is a preset: its link (UDP client/server, TCP, serial), its cameras, its vehicle outputs and
    its operator panel (RC functions, joystick mapping, values, modes, ARM permission).
  - Choosing a vehicle puts all of that in place and connects; the one chosen last comes back and connects by
    itself at the next start. Settings changed while a vehicle is in use are stored with that vehicle.
  - Vehicles are added (from the current setup), changed, copied and deleted by the administrator only; the
    operator just chooses one. Switching away from an armed vehicle is refused.
  - The first start of this version turns the current setup into the first vehicle.
  - Code: `src/shared/vehicle-presets.ts`, `src/main/operator/vehicles-store.ts`,
    `src/renderer/stores/vehicles-store.ts`, `src/renderer/components/vehicles/VehicleList.tsx`.
- **Compact operator bar.** Smaller chips (32 px) and an "icons only" option for a bar with many switches
  (the name shows in the tooltip); every built-in control (joystick, reverse, cruise, recording, layout…) can
  be deleted from the panel and added back. Camera controls in the camera window are small icon buttons with
  tooltips.
- **Vehicle messages on the operator screen.** A line above the control bar shows the latest message from
  the flight controller and opens into the list (severity, repeat count, time); new warnings and errors are
  counted on the line. Code: `src/renderer/components/operator/OperatorMessages.tsx`.
- **Roll and pitch drawn.** Next to the compass the vehicle is drawn from behind (roll) and from the side
  (pitch); the drawings lean with the vehicle and take the warning and limit colours of the numbers.
- **Cameras are set up without a link to the vehicle (0.1.2-0.19).** "Operator workspace → Video" has the
  camera editor (feeds, camera control, gimbal) that used to open only from the video panel of a connected
  vehicle. With no vehicle connected the feeds are filed under the vehicle set up last, or under a stand-in
  that the first vehicle to connect takes over; they are saved with the vehicle in the list either way.
  Code: `CameraSourceEditor` in `src/renderer/components/camera/CameraSourceMenu.tsx`,
  `offlineVehicleKey` in `src/renderer/stores/camera-store.ts`.
- **Recording waits for the operator by default (0.1.2-0.19).** The default record mode is "by the
  operator's button" instead of "always"; settings saved by earlier versions with "always" (then simply the
  default) are switched once. "Always" and "while armed" remain the administrator's choice.
- **The information block can be sized, moved and locked.** The block in the corner (tilt, heading,
  altitude, speed, time) starts smaller on narrow screens; unlocked, it is dragged and resized (50-150%),
  and locked again it stays where it was put. It is held to the bottom-right corner, so resizing the
  window does not shift it. Code: `src/renderer/components/operator/OperatorInfoDock.tsx`.
- **STOP lets go.** Pressed while the vehicle is stopped, the STOP button (now "Go on") returns the mode the
  vehicle was driven in. The Space key still only stops.
- **Reverse driving: direction and channels.** Reverse can swap forward/back (or not) and send steering and
  throttle on channels of their own; the sticks are used exactly as when driving forward.
- **Deleted panel elements come back.** A button, switch, slider or vehicle output deleted from the operator
  panel is kept whole and offered in the "Add" row under its own name; one click puts it back with all its
  settings (the cross forgets it for good). Built-in controls were already restorable.
- **A vehicle is always in use.** On a first start the program itself makes the first vehicle out of the
  settings in force, in operator mode too (before, a copy first started in operator mode was left with "no
  vehicle chosen" while its buttons came from defaults that belonged to nothing). The vehicle in use cannot
  be deleted. At start the vehicle in use is the source of truth for cameras and outputs. A test holds every
  operator setting to exactly one home: with the vehicle or with the computer.
- **Supplier contacts.** The About page shows a site (https://www.stohid.com/ by default), Telegram, phone,
  e-mail and a free line instead of one contact.
- **Activation: one copy, one PC.** An installed copy shows the computer's code (a fingerprint of the
  operating system's machine id and the board model) and asks once for a key. A key is an Ed25519-signed
  record of that code, the owner and the vehicles' serial numbers; it has no expiry date and does not fit
  another computer. Without it the program shows only the activation screen and refuses to open a vehicle
  link. A development run asks for nothing. Code: `src/main/license/`,
  `src/renderer/components/license/LicenseGate.tsx`.
  - **Key generator** (`apps/keygen`, Windows and Linux): the vendor's own small program. It holds the
    private signing key, makes a key for a computer code, keeps the list of issued keys (owner, computer,
    vehicles, note) and reads the vehicle list from a Google Sheet shared by link (serial number, status,
    customer name and hand-over date only). The private key is never part of this repository; the program
    carries only the public key (`src/main/license/public-key.ts`).
  - This protects honest use, not the code: the source is open, so a build made without the check is
    possible for anyone who compiles it.
- **Stick set-up with two circles.** The Transmitter tab draws the two sticks as circles and asks the user
  to push each stick right and up once: the program learns which axis is which stick, which way it counts,
  and the real travel. Steering then goes to the right stick and throttle to the left one (changeable).
  A transmitter that has not been set up is announced; plugging one in or out is said on the operator
  screen.
- **Transmitter tab** ("Operator workspace → Transmitter"): the device in use, a live check of every axis and
  button with what each is assigned to, a two-step calibration of the sticks' real travel (kept per device,
  for the station rather than per vehicle), and all joystick assignments in one place with a warning when a
  control is given to two uses. Code: `calibratePad`, `rcAssignments` in `src/shared/operator-rc.ts`,
  `src/renderer/components/operator/OperatorPadSettings.tsx`.
- **Video comes back at once when the network does.** A feed that is not showing video restarts immediately
  when the system reports the network back or the vehicle link recovers, instead of waiting out its retry
  delay; the "no video" tile says that it keeps retrying by itself.
- **Cameras are edited in the camera settings only**; the vehicle list no longer has a camera editor.
- **Day / night theme** button in the operator screen's header.
- **Transmitter detection.** A USB headset or other non-controller listed by the system before the
  transmitter (EdgeTX/OpenTX in joystick mode, e.g. Radiomaster TX12) was taken as the joystick and the
  transmitter was never read. Devices without sticks are now skipped and a transmitter is preferred. Code:
  `pickPad` in `src/shared/operator-rc.ts`.
- **ARM / DISARM stay in English** in the Ukrainian interface instead of transliterations.
- **Three-position switches start in the middle** by default ("start in the middle position"), so servos or a
  mechanism on the channel are not sent to an end position when the program starts.
- **Recording that does not depend on the video being there.** The administrator chooses: always, while
  armed, or by the operator's button. The app keeps the chosen cameras recording: a camera with no picture
  is waited for, the recording starts by itself when video appears and resumes after every dropout. Files
  go to `Videos\STOHID` (or a folder the administrator picks; an unusable folder falls back to the default
  and says so), are cut every N minutes (15 by default), and recording stops before the disk fills up.
  Code: `src/main/media/recorder.ts`.
- **More camera control protocols, PTZ and presets.** Besides Hikvision ISAPI:
  - **ONVIF** (any ONVIF camera: Uniview, Bitrek, Ajax and others): day/night through the imaging service,
    continuous pan/tilt/zoom, presets (recall, store, remove). The camera's clock is read first, because
    the password digest covers a timestamp; service addresses the camera reports are re-based onto the
    reachable host, so it works through a port-forward. Code: `src/main/media/onvif.ts`.
  - **Dahua HTTP API** (`configManager.cgi`, `ptz.cgi`): day/night, light, PTZ, presets.
    Code: `src/main/media/dahua-cgi.ts`.
  - **Hikvision**: PTZ and presets added to the existing image controls.
  - **Custom HTTP commands**: the administrator defines buttons, each sending one HTTP request - for a
    control service of the integrator's own.
  - PTZ arrows and zoom move while held and always send a stop; presets are a drop-down on the feed.
  - Stream url presets for Hikvision, Dahua, Uniview and Ajax cameras, and HD/SD switching for the
    Uniview (`/media/video1|2`, `/unicast/c1/s0|s1`) and Ajax (`<mac>-0_m|_s`) url styles.
  - The camera address field takes a bare host, `host:port` or a url pasted from the browser; the separate
    port field, when filled, wins.
  - Only the Hikvision driver has been run against real cameras; ONVIF and Dahua are covered by tests
    against protocol-shaped fakes.
- **A feed can be shown in several windows.** The media engine counts the windows showing each feed and
  stops it when the last one lets go; camera settings are kept in step between windows.
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
| **Arming from the app told a ground vehicle "full reverse".** With no RC transmitter, ARM sends one `RC_CHANNELS_OVERRIDE` frame as a stand-in, with channel 3 at 1000: "throttle low" for an aircraft, but full reverse for a rover or a boat, held until the override times out (`RC_OVERRIDE_TIME`, 3 s by default). In SITL the built-in stand-in transmitter did the same continuously: an armed rover in Manual drove backwards at full speed. Ground vehicles and boats now get neutral (1500) on the steering and throttle channels only. Code: `src/main/arm-rc-stand-in.ts`. | yes |
| "The vehicle did not switch to mode X" was shown for a mode the operator had already replaced with another one. | fork only |
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

**«Тунель»** (STOHID, наземні роботизовані комплекси) — форк
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
- **Напис та іконка (0.1.2-0.18).** У шапці екрана оператора, повного інтерфейсу й екрана активації замість
  маленької картинки — напис «ТУНЕЛЬ», намальований рівними прямими штрихами, з порталом тунелю перед ним.
  Іконка програми — портал із літерою «Т». Ярлик, запис у списку встановлених програм і пункт меню в Linux
  називаються «ТУНЕЛЬ»; назви файлів і тек лишаються STOHID, тож оновлення зберігає налаштування й ліцензію.
  Сторінку «Про програму» не змінено.
- **Назва.** «Тунель» (виробник — STOHID; англійською програма зветься STOHID) у заголовку вікна, шапці, інсталяторі, заставці та віджеті пульта.
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
  - Рухомі вікна: кожну камеру, крім основної, і карту можна перетягувати, довільно змінювати в розмірі
    й виносити в окреме вікно на інший монітор. У сітці камер роздільники перетягуються.
  - Адміністратор вибирає значення смуги стану та їхній порядок і може вимикати елементи екрана.
  - Перемикання режимів: адміністратор вибирає, у які режими Rover оператор може перемикати борт (Manual,
    Acro, Steering, Loiter, Auto, RTL, SmartRTL, Guided, Follow, Simple, Circle, Dock). До трьох режимів —
    кнопками, більше — списком «Режим».
- **RC-керування оператора через `RC_CHANNELS_OVERRIDE`.** Усе налаштовує адміністратор.
  - **Керування з джойстика.** USB-джойстик або геймпад керує кермом і газом: осі, напрямок, мертва зона,
    експонента, номери каналів, межі PWM і обмеження газу налаштовуються, з живим показом. Оператор бере
    керування кнопкою, щосесії, і лише з ручкою в центрі. Якщо джойстик перестає зчитуватися (жодне вікно
    програми не активне, від'єднано кабель), борт отримує нейтраль, потім канали відпускаються; керування
    повертається лише після того, як ручка побувала в центрі.
  - **Круїз-контроль.** Тримає газ. З джойстиком підхоплює поточний газ; ручка від себе додає, на себе —
    вимикає. Кнопки `+` / `−` змінюють крок за кроком. СТОП, DISARM і втрата зв'язку вимикають круїз.
    Тримає положення газу, а не швидкість за GPS.
  - **Реверсивне керування.** Перемикач: ручка від себе веде борт задом наперед, кермо дзеркалиться (за
    бажанням, залежить від `PILOT_STEER_TYPE`), задня камера стає основною. Перемикається лише на місці.
  - **Власні функції.** Кнопки (з фіксацією або без), перемикачі на три позиції (що лишаються в позиції або
    повертаються в центр) і повзунки (що лишаються на місці або підпружинені до мінімуму, центру чи
    максимуму). Кожна — на своєму RC-каналі зі своїми значеннями PWM, працює з екрана і, якщо призначити,
    з кнопок чи осей джойстика («натисніть елемент, щоб призначити»). Канал не чіпається, доки оператор
    уперше не скористається елементом (або ввімкнено «передавати від моменту підключення»); канал, яким
    більше не керують, відпускається, а не «застигає».
  - Функція передається на борт або як RC-канал, або як вихід серво напряму (`MAV_CMD_DO_SET_SERVO`:
    надсилається раз на зміну, польотний контролер тримає вихід).
- **Конструктор панелі оператора.** Налаштування → «Простір пілота» поділено на вкладки (панель керування,
  значення, рух і режими, екран, відео, загальне).
  - **Панель керування:** усі елементи нижньої панелі оператора одним списком — вбудовані (джойстик, реверс,
    круїз, запис, інструменти вигляду), виходи борту (реле) й власні кнопки, перемикачі та повзунки
    адміністратора. Кожен можна переставити, сховати, налаштувати (назва, значок, колір, канал чи вихід,
    значення PWM, поведінка, кнопка джойстика) і, якщо він не вбудований, видалити; виходи й функції
    додаються тут же. Попередній вигляд показує панель так, як її побачить оператор.
  - **Значення:** крім вбудованих, у смугу стану можна вивести БУДЬ-ЯКЕ значення борту: поле будь-якого
    MAVLink-повідомлення (вибір із живого списку з поточними значеннями), іменоване значення NAMED_VALUE
    зі скрипта Lua чи бортового комп'ютера або параметр польотного контролера — з назвою, одиницею,
    кількістю знаків, множником/зсувом і жовтою/червоною межами.
  - **Вигляд:** елементи керування оператора — одна компактна панель замість двох рядів: однакові «чіпи» зі
    значком і короткою назвою, заливка кольором, коли увімкнено, тонкі роздільники між групами; режим, ARM і
    СТОП — праворуч.
- **Список бортів замість оркестратора кількох апаратів.** Вкладка оригіналу «Кілька апаратів» потребує
  закритого оркестратора; у форку замість неї власний список бортів (вкладка «Борти» в панелі підключення
  та перемикач борту в шапці екрана оператора).
  - Кожен борт — пресет: зв'язок (UDP клієнт/сервер, TCP, послідовний порт), камери, виходи борту й панель
    оператора (RC-функції, джойстик, значення, режими, дозвіл ARM).
  - Вибір борту ставить усе це на місце й підключається; останній вибраний борт сам повертається й
    підключається під час наступного запуску. Налаштування, змінені поки борт активний, зберігаються з ним.
  - Борти додає (з поточних налаштувань), змінює, копіює й видаляє лише адміністратор; оператор тільки
    вибирає борт. Перемкнутися з борту в стані ARM не можна.
  - Під час першого запуску цієї версії поточні налаштування стають першим бортом.
- **Компактна панель оператора.** Менші кнопки (32 px) і варіант «лише значки» для панелі з багатьма
  перемикачами (назва — у підказці); будь-який вбудований елемент (джойстик, реверс, круїз, запис, розкладка…)
  можна видалити з панелі й додати назад. Керування камерою у вікні камери — маленькі кнопки-значки з
  підказками.
- **Повідомлення борту на екрані оператора.** Рядок над панеллю керування показує останнє повідомлення
  польотного контролера й розгортається у список (важливість, кількість повторів, час); нові попередження й
  помилки рахуються на рядку.
- **Крен і тангаж малюнком.** Поруч із компасом борт намальовано ззаду (крен) і збоку (тангаж); малюнки
  нахиляються разом із бортом і набувають кольорів попередження й межі, як і числа.
- **Камери налаштовуються без зв'язку з бортом (0.1.2-0.19).** У «Простір пілота → Відео» є редактор
  камер (потоки, керування камерою, підвіс), який раніше відкривався лише з панелі відео підключеного
  борту. Без борту потоки записуються за бортом, налаштованим останнім, або за тимчасовим, який забирає
  перший підключений борт; у будь-якому разі вони зберігаються з бортом у списку.
- **Запис типово чекає на оператора (0.1.2-0.19).** Типовий режим запису — «за кнопкою оператора» замість
  «завжди»; налаштування попередніх версій із «завжди» (тоді це було просто типове значення) перемикаються
  один раз. «Завжди» й «доки ARM» лишаються на вибір адміністратора.
- **Інформаційний блок можна зменшити, пересунути й закріпити.** Блок у кутку (крен, тангаж, курс,
  висота, швидкість, час) на вузьких екранах одразу менший; розблокований, він перетягується й змінює
  розмір (50–150%), а закріплений лишається там, де його поставили. Він прив'язаний до правого нижнього
  кута, тож зміна розміру вікна його не зсуває.
- **«СТОП» відпускає.** Якщо борт зупинено, та сама кнопка (тепер «Продовжити») повертає режим, у якому
  їхали. Клавіша Пробіл, як і раніше, лише зупиняє.
- **Реверс: напрямок і канали.** У реверсі можна міняти (або не міняти) «вперед/назад» і слати кермо й газ
  власними каналами; стіками користуються так само, як під час руху вперед.
- **Видалені елементи панелі повертаються.** Видалена з панелі оператора кнопка, перемикач, повзунок чи
  вихід борту зберігається цілком і пропонується в рядку «Додати» під своєю назвою; один клік повертає її з
  усіма налаштуваннями (хрестик забуває назавжди). Вбудовані елементи поверталися й раніше.
- **Борт завжди вибрано.** Під час першого запуску програма сама створює перший борт із чинних
  налаштувань — і в режимі оператора теж (раніше копія, вперше запущена в режимі оператора, лишалася з
  написом «Борт не вибрано», а її кнопки бралися з типових налаштувань, які нічому не належали). Борт, що в
  роботі, видалити не можна. Під час запуску джерелом правди для камер і виходів є борт у роботі. Тест
  стежить, щоб кожне налаштування оператора мало рівно одне місце: з бортом або з комп'ютером.
- **Контакти постачальника.** На сторінці «Про програму» замість одного контакту — сайт (типово
  https://www.stohid.com/), Telegram, телефон, пошта й довільний рядок.
- **Активація: одна копія — один комп'ютер.** Встановлена копія показує код комп'ютера (відбиток
  ідентифікатора системи й моделі плати) і один раз просить ключ. Ключ — це підписаний (Ed25519) запис із
  цим кодом, власником і серійними номерами бортів; він не має терміну дії й не підходить до іншого
  комп'ютера. Без ключа програма показує лише екран активації й не відкриває зв'язок із бортом. Запуск для
  розробки нічого не просить.
  - **Генератор ключів** (`apps/keygen`, Windows і Linux): окрема невелика програма постачальника. Зберігає
    закритий ключ підпису, робить ключ за кодом комп'ютера, веде список виданих ключів (власник, комп'ютер,
    борти, примітка) і читає список бортів із таблиці Google, відкритої за посиланням (лише серійний номер,
    статус, ім'я замовника й дата передачі). Закритого ключа в репозиторії немає; у програмі — лише відкритий.
  - Це захист від простого копіювання, а не від зламу: код відкритий, тож зібрати програму без перевірки
    може кожен, хто вміє її компілювати.
- **Налаштування стіків із двома колами.** Вкладка «Пульт» малює два стіки як кола й просить по разу
  відхилити кожен стік вправо й угору: програма дізнається, яка вісь якому стіку відповідає, в який бік
  вона рахує і який у стіків справжній хід. Після цього кермо стає на правий стік, газ — на лівий (можна
  змінити). Про неналаштований пульт програма повідомляє сама; підключення й відключення пульта видно на
  екрані оператора.
- **Вкладка «Пульт»** («Простір пілота → Пульт»): який пристрій зчитується, жива перевірка кожної осі й
  кнопки з підписом, до чого вона призначена, калібрування справжнього ходу стіків у два кроки (зберігається
  для пристрою й для станції, а не для борту) та всі призначення джойстика в одному місці з попередженням,
  коли один елемент призначено двічі.
- **Відео повертається одразу, коли повертається мережа.** Потік без зображення перезапускається негайно,
  щойно система повідомляє про мережу або відновлюється зв'язок із бортом, а не чекає своєї паузи між
  спробами; плитка «немає відео» показує, що повтор іде автоматично.
- **Камери редагуються лише в налаштуваннях камер**; у списку бортів редактора камер більше немає.
- **Денна / нічна тема** — кнопка в шапці екрана оператора.
- **Визначення пульта.** USB-гарнітуру чи інший пристрій без стіків, який система показувала раніше за пульт
  (EdgeTX/OpenTX у режимі джойстика, напр. Radiomaster TX12), програма брала за джойстик, і пульт не
  зчитувався. Тепер пристрої без стіків пропускаються, а пульт має перевагу.
- **ARM / DISARM — англійською** в українському інтерфейсі замість транслітерацій.
- **Перемикач на 3 позиції стартує з середньої позиції** (галочка «На старті — середня позиція», типово
  ввімкнена), тож сервоприводи чи механізм на каналі не їдуть у крайнє положення під час запуску програми.
- **Запис, що не залежить від наявності відео.** Адміністратор вибирає: завжди, доки борт у стані ARM, або за
  кнопкою оператора. Програма сама тримає запис вибраних камер: камеру без зображення чекає, запис
  починається сам, щойно з'явиться відео, і відновлюється після кожного обриву. Файли йдуть у
  `Відео\STOHID` (або в теку, яку вибере адміністратор; якщо тека недоступна, береться типова і про це
  сказано), діляться кожні N хвилин (типово 15), а запис зупиняється до того, як диск заповниться.
- **Нові протоколи керування камерами, PTZ і пресети.** Крім Hikvision ISAPI:
  - **ONVIF** (будь-яка камера з ONVIF: Uniview, Bitrek, Ajax та інші): день/ніч, поворот і зум, пресети.
    Працює й через проброс порту та з камерою, на якій не виставлено годинник.
  - **Dahua (HTTP API):** день/ніч, підсвітка, PTZ, пресети.
  - **Hikvision:** додано PTZ і пресети.
  - **Власні HTTP-команди:** адміністратор задає кнопки, кожна надсилає один HTTP-запит — для власного
    сервісу керування.
  - Шаблони RTSP-адрес для Hikvision, Dahua, Uniview та Ajax; перемикач HD/SD розуміє адреси Uniview й Ajax.
  - Поле адреси камери приймає просто адресу, `адреса:порт` або посилання, скопійоване з браузера; якщо
    заповнено окреме поле порту, воно має перевагу.
  - На справжніх камерах перевірено лише Hikvision; ONVIF і Dahua перевірено тестами на імітаторах.
- **Камеру можна показувати в кількох вікнах одночасно.**
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
- **ARM із програми давав наземному борту команду «повний назад».** Коли немає пульта RC, перед ARM
  надсилається один кадр `RC_CHANNELS_OVERRIDE` із каналом 3 на 1000: для літального апарата це «газ
  унизу», а для ровера чи човна — повний задній хід, доки override не згасне (`RC_OVERRIDE_TIME`, типово
  3 с). У симуляторі вбудований «пульт» робив те саме безперервно: ровер у стані ARM у ручному режимі їхав
  назад на повному газу. Тепер наземні борти й човни отримують нейтраль (1500), і лише на каналах керма
  й газу. Стосується й оригіналу.
- **Хибне «Борт не перейшов у режим…»** для режиму, який оператор уже замінив іншим.
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
