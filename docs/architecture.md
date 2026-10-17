# Way.Shell: architektura i plan faz

Stan: fazy 0-6 zrobione (2026-10-17), repo na GitHubie, paczki jeszcze nieopublikowane. Repo `kododo-dev/WayShell`, paczki `Kododo.Way.Shell` (NuGet) i `@kododo-dev/way-shell` (npm). Decyzje: sekcja 5. Kontekst i historia decyzji: punkt 9 w `../../IDEAS.md`.

## 1. Cel

Wspólna powłoka UI dla bibliotek Way (ConfigWay, CultureWay, RunWay, LogWay, później TraceWay, AuthWay):

- **Jeden Way w aplikacji:** Way wygląda i działa jak dziś (`app.UseConfigWay("/config")`), ale układ, motyw, i18n, klient API i obsługa sesji pochodzą z Shella, a nie z kopii w każdym SPA.
- **Kilka Way w aplikacji:** opcjonalny wspólny panel (np. `/admin`) z nawigacją między Way, jednym motywem i jednym użytkownikiem.
- **Jedna wersja React/MUI w aplikacji:** Shell jest zależnością NuGet każdego Way i jedynym dostawcą bibliotek wspólnych; NuGet rozwiązuje go do jednej wersji.

Poza zakresem v1: Way z innych aplikacji (iframe, SSO), agregacja MCP, własne moduły hosta (np. strony Polyglota), zmiana routingu z hash na history.

## 2. Stan obecny (przegląd kodu 2026-10-16)

- Backend: `Use*Way` to 50-100 linii, bo Reiho już robi `MapRequests` i `MapEmbeddedSpa`. `MapEmbeddedSpa` serwuje `SPA/dist` z zasobów osadzonych w assembly, podmienia `__BASE_PATH__` w `index.html` (`<base href>`), pliki statyczne mają `immutable`. Nie ma fallbacku na `index.html` dla nieznanych ścieżek, więc wszystkie SPA używają `HashRouter`.
- SPA: Vite 8 + React 19 + MUI 9 (RunWay: MUI 7 / Vite 7), `react-router-dom` 7, emotion. Kopiowane i rozjechane między Way: `ThemeContext`, `LayoutContext`, `MainLayout`, `SideMenu`, `PageHeader`, `api.ts` (`SessionExpiredError`, `ForbiddenError`, `ApiError` z ProblemDetails, nasłuch wygaśnięcia sesji), `i18n/I18nContext` (wybór: użytkownik > host > przeglądarka).
- Ustawienia hosta są w każdym Way osobno: CultureWay `EditorOptions` (`Title`, `HomeUrl`, `Language`, `Links`, `User`, uprawnienia), LogWay `LogWayUiOptions` (`Title`, `User`, `AllowAnonymous`), przekazywane do SPA przez `GetEditorSettings` / `GetUiSettings`.
- Ochrona: LogWay (UI i MCP) odpowiada 403 poza Development, jeśli endpointy nie wymagają autoryzacji ani nie są jawnie anonimowe. ConfigWay i CultureWay tego nie robią.

## 3. Architektura docelowa

### 3.1 Paczki

| Paczka | Zawartość |
|---|---|
| `Kododo.Way.Shell` (NuGet, net8/9/10) | Rejestr Way, `UseWayShell`, API powłoki, ochrona, osadzone: SPA powłoki, paczka bibliotek wspólnych (vendor), runtime `@kododo-dev/way-shell`, import map |
| `@kododo-dev/way-shell` (npm) | Typy kontraktu modułu, hooki i komponenty (`useShell`, `useI18n`, `PageHeader`, ...), klient API, preset Vite `wayModule()`, `WayDevHost` do pracy lokalnej |

Wersje NuGet i npm są zawsze takie same i budowane z jednego repo. Wersja główna = wersja kontraktu.

### 3.2 Biblioteki wspólne i import map

- Shell buduje jako moduły ES: `react`, `react-dom/client`, `react/jsx-runtime`, `@emotion/react`, `@emotion/styled`, `@mui/material`, `react-router-dom`, `@kododo-dev/way-shell` (runtime). Pliki z hashem w nazwie, cache `immutable`.
- `index.html` powłoki zawiera `<script type="importmap">` z mapowaniem nazw na te pliki, wstawiany przez backend razem z `<base href>`.
- **Nie współdzielimy `@mui/icons-material`**: współdzielenie wyłącza tree-shaking, a pełny zestaw ikon jest ogromny. Ikony są bezstanowe, więc każdy Way dołącza tylko swoje. Podobnie inne bezstanowe biblioteki (np. `country-flag-icons` w CultureWay).
- Singletonami muszą być React (hooki), emotion (motyw, cache stylów), router i runtime Shella (konteksty).

### 3.3 Kontrakt modułu Way

Wszystkie Way są w React, więc w v1 moduł eksportuje komponent, a nie framework-agnostyczne `mount(element)`. Dzięki temu konteksty, portale i dialogi są w jednym drzewie.

```ts
// way.js, budowany presetem wayModule()
import { defineWay } from '@kododo-dev/way-shell';
export default defineWay({
  contract: 2,
  App,            // React.ComponentType<WayProps>, renderowany wewnątrz routera powłoki
  translations,   // opcjonalnie: słowniki Way per język
  theme,          // opcjonalnie: nadpisania motywu (np. gęsty, monospace w LogWay)
});
```

`WayProps` / `useShell()`: `apiBase`, `api` (klient z obsługą sesji i ProblemDetails), `language`, `themeMode`, `navigate(wayId, path)`, `user`, `settings` (ustawienia hosta + ustawienia własne Way z backendu).

### 3.4 Backend

```csharp
builder.Services.AddConfigWay().AddUI();   // rejestruje deskryptor Way w Shellu
app.UseConfigWay("/config");               // tryb pojedynczy: powłoka z jednym modułem pod /config
app.UseWayShell("/admin")                  // opcjonalnie: wspólny panel wszystkich Way
   .RequireAuthorization("Admin");
```

- **Rejestr:** `Use*Way` dodaje do `WayRegistry` deskryptor (id, nazwa, ikona, ścieżka, URL modułu, wersja kontraktu, „wrażliwy”, np. LogWay). Powłoka czyta rejestr leniwie przy żądaniu, więc kolejność `Use*` nie ma znaczenia.
- **API powłoki** (Reiho): `GetShellSettings` zwraca tytuł, homeUrl, język, linki, użytkownika i listę Way, do których bieżący użytkownik ma dostęp. Dostęp oceniamy polityką złożoną z metadanych `IAuthorizeData` endpointów danego Way (`AuthorizationPolicy.CombineAsync` + `IPolicyEvaluator`).
- **Ustawienia hosta w jednym miejscu:** `ShellOptions { Title, HomeUrl, Language, Links, User }`. Pola z `EditorOptions` i `LogWayUiOptions` dostają `[Obsolete]` i są przekazywane do Shella, więc nie ma zmiany łamiącej w C#. Uprawnienia specyficzne dla Way (`CanImport`, `CanManageCultures`) zostają w Way.
- **Ochrona:** mechanizm z LogWay (403 poza Development bez jawnej autoryzacji) przeniesiony do Shella i **włączony dla wszystkich Way**. Wyjście: `RequireAuthorization(...)`, `AllowAnonymous()` na grupie albo `ShellOptions.AllowAnonymous` (dema). Ostrzeżenie w logu przy starcie dla niechronionego Way, a treść 403 (ProblemDetails) mówi, jak to naprawić. To zmiana zachowania dla ConfigWay, CultureWay i RunWay, więc wchodzi z majorem rodziny (2.0.0).
- **Serwowanie:** Reiho 2.1.0 dostaje ogólny hak w `MapEmbeddedSpa`: własne podstawienia w `index.html` liczone per żądanie, obok `__BASE_PATH__`, np. `o.Placeholder("__IMPORT_MAP__", ctx => ...)`. Cała wiedza o import map, rejestrze i modułach Way jest w Shellu. Cache, PathBase i `<base href>` zostają w Reiho, bez kopiowania. Moduł Way (`way.js` + css) dalej osadzony w assembly Way.

### 3.5 Kompatybilność wersji

- Way zależy od `Kododo.Way.Shell` z zakresem `[2.0, 3.0)`, więc NuGet nie pozwoli zmieszać wersji głównych. Kontrakt modułu ma numer wersji głównej rodziny: 2 (poprawione 2026-10-16, w fazie 1 omyłkowo było 1).
- Moduł niesie numer kontraktu z czasu budowania. Jeśli powłoka go nie obsługuje, pokazuje kartę błędu „przebuduj Way” zamiast się wywrócić.
- Każdy Way jest w osobnej granicy błędów (error boundary).
- Podbicie wersji głównej React/MUI = wersja główna Shella = zgrane wydanie wszystkich Way.
- **Wspólny major rodziny:** Shell i wszystkie biblioteki Way mają ten sam numer główny, a minor i patch są indywidualne. Pierwsze wydanie na Shellu to 2.0.0 dla `Kododo.Way.Shell` i każdego Way. Zmiana łamiąca w pojedynczym Way czeka na major rodziny albo idzie przez `[Obsolete]`. Reiho i aplikacje (Polyglot, Logle) mają własne numery.
- Routing w v1: hash (`/admin#/logs/...`, `/config#/...`). Router należy do Shella, więc późniejsze przejście na history to zmiana tylko w Shellu.

### 3.6 Praca lokalna nad Way

- `npm run dev` w Way: `WayDevHost` z `@kododo-dev/way-shell` renderuje powłokę wokół modułu, a biblioteki są dołączane normalnie (bez import map), proxy `/api` na backend.
- `npm run build`: preset `wayModule()`, czyli Vite w trybie lib, `external` = biblioteki wspólne, wynik `dist/way.js` + `way.css`.
- Testy Vitest Way działają bez zmian; nowe testy kontraktu w repo Shella.

## 4. Fazy

### Faza 0: prototyp techniczny (do wyrzucenia)
Cel: potwierdzić, że podejście działa, zanim cokolwiek ruszymy w Way.
- Minimalna powłoka + dwa sztuczne moduły Way w osobnych assembly, import map z vendor bundle React 19 / MUI 9 / emotion / router.
- Sprawdzić: jedna instancja React (hooki), wspólny motyw emotion w modułach, dialogi i portale MUI, lazy `import()` modułu, CSS modułu, PathBase (`ASPNETCORE_PATHBASE`, `UsePathBase`).
- Zmierzyć: rozmiar vendor bundle (gzip) wobec dzisiejszego SPA jednego Way; czas ładowania.
- Sprawdzić ocenę dostępu do Way z polityk `RequireAuthorization` grupy.
- **Kryterium wyjścia:** wszystko działa w Chrome/Firefox/Safari (import maps) i rozmiar jest akceptowalny; inaczej wracamy do wariantu iframe.
- **Stan 2026-10-16:** prototyp zrobiony i usunięty przed pierwszym commitem repo (2026-10-17); jego ustalenia weszły do fazy 1. 65/65 scenariuszy w Chrome, Edge, Firefoxie i WebKicie (przybliżenie Safari), także z PathBase. Biblioteki wspólne razem 297 KB gzip, moduł 2-3 KB (dziś SPA ConfigWay 162 KB). **Kryterium wyjścia spełnione, iframe niepotrzebny.** Najważniejsze ustalenie: preset `wayModule()` musi przepisywać głębokie importy `@mui/material/*`.

### Faza 1: szkielet repo i paczek
- Repo `WayShell`: `src/Way.Shell` (NuGet), `src/Way.Shell.Tests`, `src/way-shell` (npm), `src/Way.Shell.Demo`.
- Konwencje rodziny: Directory.Build.props, net8/9/10, Reiho 2, CI (build, testy, ESLint, Vitest), README po angielsku, ten dokument po polsku.
- Typy kontraktu v1, `defineWay`, preset `wayModule()`.
- **Publikacja npm** (organizacja `kododo-dev` na npmjs założona 2026-10-16, plan Free, właściciel `jacalapa`):
  - Docelowo **Trusted Publishing** z GitHub Actions (OIDC) z provenance, bez długowiecznego tokenu w sekretach.
  - Kolejność: pierwsza publikacja `@kododo-dev/way-shell` ręcznie z maszyny użytkownika (albo granularnym tokenem o krótkiej ważności), bo zaufanego wydawcę ustawia się na istniejącej paczce. Potem w ustawieniach paczki Trusted Publisher = repo `kododo-dev/WayShell` + plik workflow publikacji. Na koniec ustawienie „require 2FA and disallow tokens”.
  - Workflow publikacji: `permissions: id-token: write`, `npm publish --provenance --access public`, wersja npm = wersja NuGet z tego samego tagu.
  - E-mail konta npm trafia do metadanych każdej paczki (publicznie). Przed pierwszą publikacją zdecydować, czy zostaje adres służbowy, czy adres projektu.
  - Po stronie konta (robi użytkownik): 2FA na koncie, wymuszenie 2FA w organizacji, podpięcie GitHuba do odzyskiwania, opcjonalnie drugi właściciel organizacji.
- **Stan 2026-10-16:** szkielet gotowy lokalnie (bez gita i publikacji).
  - `src/Way.Shell`: `WayShellContract.Version`, deskryptor `WayModule` z walidacją id. 14 testów na net8/9/10, w tym zgodność numeru kontraktu z paczką npm.
  - `src/way-shell`: kontrakt (`CONTRACT`, `defineWay`, `WayProps`, `useShell`, `ShellContext`), lista bibliotek wspólnych i preset `wayModule()` z ustaleniami z prototypu: przepisywanie `@mui/material/*` i `react-router`, wstrzykiwanie kontraktu przy budowaniu, błąd przy próbie dołączenia drugiej kopii biblioteki wspólnej (np. przez `@mui/system`) albo przy JSX deweloperskim. 9 testów Vitest, w tym budowanie modułów testowych. ESLint, `tsc`, `npm pack` czyste.
  - `.github/workflows`: `ci.yml` (.NET + npm), `publish.yml` (jeden tag publikuje NuGet i npm; npm przez Trusted Publishing z provenance, wersje przedpremierowe pod tagiem `next`).
  - Odłożone do fazy 2, bo bez backendu Shella byłyby puste: `Way.Shell.Demo` i zależność od Reiho 2.
  - Vitest 4 zamiast 3: Vitest 3 (np. w LogWay) ma zgłoszone podatności w zależnościach deweloperskich (tinypool, @vitest/mocker).

### Faza 2: backend Shella
- Reiho 2.1.0: hak podstawień w `MapEmbeddedSpa` + testy (osobny PR i wydanie Reiho, minor).
- `WayRegistry`, deskryptor Way, `UseWayShell`, API `GetShellSettings`.
- `ShellOptions`, ocena dostępu per Way, ochrona 403 dla wszystkich Way (ostrzeżenie przy starcie, czytelny ProblemDetails).
- Serwowanie powłoki z import map i `<base href>`.
- Testy: rejestr, filtrowanie po uprawnieniach, PathBase, 403 poza Development, cache.

- **Stan 2026-10-16:** zrobione lokalnie (bez gita i publikacji), poza przekazaniem opcji z Way (`[Obsolete]`), które jest w fazie 5.
  - Reiho 2.1.0 wydane: `MapEmbeddedSpa(assembly, o => o.Placeholder(...))` (PR kododo-dev/Reiho#17).
  - `AddWayShell`, `MapWay(module, path)` dla bibliotek Way, `UseWayShell(path)`, `ShellOptions` (`Title`, `HomeUrl`, `Language`, `Links`, `User`, `AllowAnonymous`, `AssetsPath`, `Nonce` dla CSP).
  - UI powłoki w `src/Way.Shell/UI`: biblioteki wspólne, runtime ze źródeł `way-shell` (Vite `dedupe`, żeby nie było dwóch Reactów) i minimalna aplikacja powłoki (pełny layout w fazie 3).
  - Demo `src/Way.Shell.Demo` z modułem zbudowanym presetem `wayModule()` (dwa Way z jednego modułu, panel, logowanie „na niby”) i scenariuszami Playwright w `e2e/check.mjs`: 18/18 w Chrome, Edge, Firefoxie i WebKicie, także z `ASPNETCORE_PATHBASE`.
  - 44 testy .NET na net8/9/10: strona i import map, ustawienia, PathBase (także z `PathBase` w konfiguracji), nonce, pliki modułu i bibliotek, 403 poza Development dla strony, plików modułu i API, `FallbackPolicy`, ostrzeżenie przy starcie, lista Way w panelu wg uprawnień.
- **Zmiany wobec planu (2026-10-16):**
  - Ustawienia trafiają do strony jako JSON (`<script type="application/json">`), zamiast osobnego API `GetShellSettings`: o jedno żądanie mniej, a i tak są liczone przy każdym wejściu.
  - Wspólne pliki pod `/_way-shell` (anonimowo, raz na aplikację, ścieżka w `ShellOptions.AssetsPath`); moduł Way pod `{ścieżka Way}/_way/`, więc obejmuje go autoryzacja Way.
  - `<base href>` liczy Shell z `Request.PathBase`, a nie Reiho z `__BASE_PATH__`. Reiho dokleja wartość `PathBase` z konfiguracji do `Request.PathBase`, więc przy `ASPNETCORE_PATHBASE` + `UsePathBase` (jak radzi README Reiho i jak robią dema) prefiks jest podwójny (`/demo/demo/hello/`). **Do poprawienia w Reiho osobno.**
  - Ochrona 403: filtr dla handlerów (API) i owinięcie `RequestDelegate` dla stron i plików; jako decyzja liczy się też `FallbackPolicy` (LogWay jej nie widzi).
  - `WayInfo.settings` jest na razie puste; hak na ustawienia Way dojdzie przy pilotażu ConfigWay (faza 4).

### Faza 3: powłoka UI i runtime
- Layout jako uogólnienie obecnych `MainLayout`/`SideMenu`/`PageHeader`: tytuł, homeUrl, linki hosta, użytkownik z wylogowaniem, przełącznik motywu i języka.
- Klient API (`ApiError`, `SessionExpiredError`, `ForbiddenError`) + `SessionExpiredDialog` z CultureWay.
- i18n: język w powłoce, słowniki Shella + słowniki Way.
- Ładowanie modułu, error boundary, karta niezgodnego kontraktu, `WayDevHost`.
- Tryb pojedynczy: bez przełącznika Way.

- **Stan 2026-10-16:** zrobione lokalnie (bez gita i publikacji).
  - Cały UI powłoki (`ShellApp`) jest w paczce npm, a `src/Way.Shell/UI` tylko buduje biblioteki i go renderuje. Dzięki temu `WayDevHost` pokazuje przy `npm run dev` tę samą powłokę co aplikacja.
  - Układ jak w CultureWay: boczne menu z tytułem (link `HomeUrl`), wyborem języka i motywu, listą Way w panelu (ikony po nazwie), miejscem na menu Way (`WayMenu`, portal), linkami hosta i użytkownikiem z wylogowaniem (POST) na dole. Na wąskim ekranie menu wysuwa się z przycisku w `PageHeader`; Way bez `PageHeader` dostaje od powłoki wąski pasek z tym przyciskiem.
  - Dla modułów: `WayProps.api` (`createApi`: `ApiError` z polami, `ForbiddenError`, `SessionExpiredError`, jedno okno „sesja wygasła” w powłoce), `useI18n()` (słowniki Way, język: wybór użytkownika > host > przeglądarka, zapamiętany), `PageHeader`, `WayMenu`, `theme` Way (obiekt albo funkcja trybu) nakładany na motyw powłoki.
  - Język i motyw pamiętane w `localStorage` (`way-shell:language`, `way-shell:theme`), wspólne dla wszystkich Way na tej samej domenie.
  - Backend: `ShellUser.AccountUrl`, `ShellLink.Icon`, adresy `~/...` w opcjach dostają `PathBase`. Reiho 2.1.1 (poprawka podwójnego prefiksu) wydane i użyte.
  - Preset `wayModule()` w `vite dev` deduplikuje biblioteki wspólne (paczka podpięta przez `file:` albo w monorepo dawała drugi React).
  - Testy: 22 w Vitest, 45 .NET na net8/9/10, scenariusze demo 31/31 w Chrome, Edge, Firefoxie i WebKicie (też z `ASPNETCORE_PATHBASE`), w tym język, motyw, wygasła sesja, wylogowanie i widok telefonu; `WayDevHost` sprawdzony ręcznie przez Playwright.
  - Biblioteki wspólne z całą powłoką: 304 KB gzip.

### Faza 4: pilotaż na ConfigWay
- ConfigWay jest najprostszy i ma już MUI 9, więc problemy Shella nie mieszają się z migracją MUI.
- SPA → moduł; usunięte skopiowane konteksty i layout; `UseConfigWay` bez zmian w API C#.
- Istniejące testy, e2e i demo (`kododo.dev/configway/demo`) muszą przejść bez zmian w zachowaniu.
- Po pilotażu: przegląd kontraktu i ewentualne poprawki, zanim migrujemy resztę.

- **Stan 2026-10-16:** pilotaż zrobiony lokalnie na gałęzi `next` ConfigWay (bez commitów).
  - Backend: `UseConfigWay` = `MapWay(WayModule("config", "Configuration", ..., "SPA/dist") { Icon = "settings" })` + API Reiho na `/api`; `AddUiEditor` rejestruje powłokę. API C# bez zmian.
  - SPA → moduł (`src/way.tsx`): usunięte `MainLayout`, `ThemeContext`, `LayoutContext` i globalny `index.css`; motyw ConfigWay jako `theme` Way; menu sekcji w `WayMenu`; `PageHeader` ConfigWay opakowuje nagłówek powłoki; `useI18n` ConfigWay bierze język z powłoki (słowniki `t.klucz` bez zmian); API przez `useShell().api`. `npm run dev` z `WayDevHost`.
  - Moduł 13 KB gzip (dotąd całe SPA 162 KB).
  - Testy ConfigWay bez zmian w zachowaniu poza zamierzonym 403: hosty testowe i demo dostały `.AllowAnonymous()`. Nowe `ShellTests` (strona, moduł, 403). 170 × 3 TFM + 23 PG + 23 SQL zielone. Scenariusze w przeglądarce na demo (`ConfigWay.Demo.Web/e2e/check.mjs`): 14/14 w Chrome, Edge, Firefoxie i WebKicie, w tym zapis ustawień, język, motyw, telefon.
  - Do czasu publikacji paczek ConfigWay korzysta z WayShell obok (`UseLocalWayShell`, domyślnie `true`; npm `file:` z `install-links=true`). **CI i deploy ConfigWay na `next` nie zadziałają, dopóki paczki nie będą w NuGet i npm** (faza 7 przełącza na wersje z rejestrów).
- **Przegląd kontraktu po pilotażu (zmiany w Shellu):**
  - Numer kontraktu 2 = wersja główna rodziny (w fazie 1 było omyłkowo 1).
  - `navigate(wayId, path, { replace })`: w trasie z gwiazdką powłoki (`/:wayId/*`) linki względne routera poza własnym `<Routes>` modułu liczą się od całego adresu (`section/x` z `#/config/section/a` → `.../section/a/section/x`). Menu Way i przekierowania „od korzenia Way” idą przez `navigate`; opisane w kontrakcie i README, demo też przestawione.
  - Motyw Way budowany od nowa z połączonych opcji powłoki i Way, a nie nakładany na gotowy motyw (warianty typografii miały już font powłoki, więc font ConfigWay nie docierał).
  - Powłoka zamyka menu na telefonie po każdej nawigacji, także z menu Way.
  - Zależność `file:` jako symlink dawała drugi zestaw typów MUI w TS; `install-links=true` odwzorowuje instalację z rejestru.
  - Ryzyko globalnego CSS potwierdzone (`index.css` ConfigWay ustawiał font `:root` i paski przewijania dla całej strony) i usunięte. Przy migracji pozostałych Way sprawdzać globalne style.
  - Uwagi poboczne: lint ConfigWay nie działał już wcześniej (brak konfiguracji ESLint, CI go nie uruchamia); naprawione podatności dev w lockfile ConfigWay (`npm audit fix`).

### Faza 5: migracja pozostałych Way
- **CultureWay:** `EditorOptions.Title/HomeUrl/Language/Links/User` → `ShellOptions` (`[Obsolete]` z przekazaniem); `HostMenu` i `SessionExpiredDialog` już w Shellu.
- **RunWay:** podbicie MUI 7 → 9 i Vite 7 → 8 razem z migracją.
- **LogWay:** własny motyw jako nadpisanie, gęsty układ, SSE, `AllowAnonymous` → ochrona w Shellu; MCP bez zmian.
- **Hosty:** Polyglot i Logle przechodzą na `ShellOptions` (tytuł, linki, użytkownik). Testy HTTP hostów muszą przejść.

- **Stan 2026-10-16:** CultureWay i RunWay zmigrowane lokalnie na gałęziach `next` (bez commitów), LogWay wstrzymany (pomysł TelemetryWay/Polymeter).
  - **CultureWay** (`translations`, „Translations”): `EditorOptions.Title/HomeUrl/Language/User` `[Obsolete]` z przekazaniem do `ShellOptions`; przestrzeń nazw w adresie (`#/ns/...`); 201 × 3 TFM + 43 PG; przeglądarki 15/15 × 4; moduł 78 KB gzip (dotąd 223 KB, głównie wszystkie flagi z `country-flag-icons`). Demo dostało `UseRouting()` po `UsePathBase` (405 dla POST pod prefiksem).
  - **RunWay** (`scheduler`, „Scheduler”): MUI 7 → 9.5, Vite 7 → 8; Data Grid 9.0.0-rc.0 i Lab 9.0.0-beta.10 (stabilne 8.x nie wspierają MUI 9); 61 × 3 TFM + 37 PG + 37 SQL; przeglądarki 17/17 × 4; moduł 266 KB gzip (dotąd 412 KB; Data Grid, recharts, Lab, dayjs).
  - **Poprawki Shella po migracji (zrobione 2026-10-16, obejścia w CultureWay i RunWay usunięte):**
    1. `ShellOptions.DynamicLinks`: lista funkcji z linkami liczonymi przy każdym żądaniu (każdy Way i host może dodać swoje). `EditorOptions.Links` CultureWay `[Obsolete]`, przekazywane tam; `HostLinks` w module usunięte.
    2. `@mui/system` w bibliotekach wspólnych (+5 KB gzip, razem 309 KB). Preset przepisuje `@mui/material/X` i `@mui/system/X` na korzeń, a eksport domyślny bierze z eksportu korzenia o tej samej nazwie (działa też `import useMediaQuery from '@mui/material/useMediaQuery'`).
    3. Preset podstawia `use-sync-external-store` modułem ES na wspólnym React; a każdy `require()` biblioteki wspólnej w zależności CommonJS kończy build czytelnym błędem (hook `transform` na plikach `.js`/`.cjs`, plus zabezpieczenie na komunikat Rolldowna w wyniku).
    4. Otwarte: ostrzeżenie presetu o dużym `way.js`, leniwe ładowanie flag w CultureWay i wykresów w RunWay.
  - **Polyglot po CultureWay 2.0:** opcje do `AddWayShell`, `.AllowAnonymous()` w trybie bez logowania, klucz motywu `way-shell:theme`.

### Faza 6: panel wielu Way
- `UseWayShell("/admin")`: menu zarejestrowanych Way, routing `#/{wayId}/...`, `navigate(wayId, path)` między Way.
- Demo z czterema Way w jednej aplikacji (kandydat na kododo.dev).
- Przygotowanie pod TraceWay: link z `trace:` w LogWay do śladu.

- **Stan 2026-10-17:** zrobione lokalnie (bez gita i publikacji).
  - Panel, menu Way, routing `#/{wayId}/...` i `navigate` w panelu były już od faz 2-3. Nowe w kontrakcie (nadal 2, bo jeszcze niewydany): `WayProps.ways` (Way, które bieżący użytkownik może otworzyć) i `href(wayId, path)` (adres do `<a href>`, `null` dla Way niedostępnego). `navigate` do innego Way na stronie pojedynczego Way przechodzi na jego stronę; dotąd nic nie robił, bo strona znała tylko swój Way.
  - Backend: strona pojedynczego Way dostaje też pozostałe Way widoczne dla użytkownika (ta sama ocena dostępu co panel) i `wayId` bieżącego. Menu Way pokazuje się dalej tylko w panelu.
  - Pod TraceWay: LogWay pokaże link `href('traces', 'trace/{id}')` tylko, gdy nie jest `null`. Way, do którego linkują inne, dokumentuje swoje trasy jako publiczne (README `way-shell`).
  - **Demo z trzema Way:** `../../Showcase` (osobny folder, bo zależy od ConfigWay, CultureWay i RunWay; kandydat na kododo.dev). Sklep na niby: ustawienia w ConfigWay, teksty strony w CultureWay, zadania w RunWay czytające ustawienia; panel `/admin` i każdy Way pod własną ścieżką. Scenariusze `Showcase/src/Showcase/e2e/check.mjs`: 32/32 w Chrome, Edge, Firefoxie i WebKicie, także z `PathBase=/demo`. Dockerfile i deploy w fazie 7 (kontekst budowania obejmuje kilka repo, dopóki nie ma paczek).
  - Testy: 47 .NET × 3 TFM, 28 Vitest, demo Shella 37/37 × 4 przeglądarki (w Production).
- **Znalezione przy łączeniu Way (poprawione na `next` RunWay):**
  - RunWay.PostgreSQL brał dostawcę EF Core 8 na każdym TFM, a ConfigWay i CultureWay Npgsql 10: w jednej aplikacji `TypeLoadException` w Npgsql. Do tego kod RunWay zbudowany pod EF Core 8 nie działa na EF Core 10 (`SetPropertyCalls` w `ExecuteUpdate` zniknął), więc żadna aplikacja net10 z własnym EF Core 10 nie uruchomiłaby RunWay. Teraz EF Core i Npgsql w RunWay idą za TFM (8/9/10), a RunWay.SqlServer przypina poprawiony `System.Security.Cryptography.Pkcs` jak ConfigWay.
  - EF Core 10 na SQL Server wysyła listę w `Contains` jako osobne parametry; taki plan dawał zakleszczenia w testach współbieżności RunWay. RunWay.SqlServer na net10 wraca do jednego parametru JSON (`UseParameterizedCollectionMode(Parameter)`), jak EF Core 8 i 9.
  - Testy RunWay: 61 × 3 TFM + 37 PG + 37 SQL; demo RunWay 17/17 × 4 przeglądarki w Production.
  - Otwarte w RunWay (sprzed zmian): ostrzeżenia EF o `Skip`/`Take` bez `OrderBy` i o dwóch relacjach `DbRecurrence.Job` / `DbJob.Recurrence`.
  - Uwaga do uruchamiania dem: `dotnet run` bierze port i środowisko z `launchSettings.json` (Development), więc sprawdzanie „w Production” wymaga `--no-launch-profile`.

### Faza 7: wydanie
- Dokumentacja (README Shella, sekcje „Using with other Ways” w README Way, przewodnik migracji opcji).
- Reiho 2.1.0 przed Shellem. Potem jednym rzutem 2.0.0: Way.Shell → ConfigWay → CultureWay → RunWay → LogWay; następnie hosty (Polyglot, Logle) na nowych paczkach.
- Przewodnik migracji do 2.0: blokada 403, opcje `[Obsolete]` → `ShellOptions`, Reiho 2 dla aplikacji używających Reiho bezpośrednio, zmiana kształtu odpowiedzi API edytorów (204 + ProblemDetails).
- Po wydaniu: szablon `dotnet new kododo-way` (pomysł 10) oparty na Shellu.

## 5. Decyzje (podjęte 2026-10-16)

1. **Nazwa:** repo `kododo-dev/WayShell`, NuGet i namespace `Kododo.Way.Shell`. Przestrzeń `Kododo.Way.*` zostaje dla infrastruktury rodziny (później `Kododo.Way.All`, szablon).
2. **npm:** npmjs.com, scope `@kododo-dev`, paczka `@kododo-dev/way-shell`. Scope `@kododo` jest zajęty przez innego użytkownika (paczka `telegram-js-bot` z 2022), a `@kododo-dev` był wolny 2026-10-16. Organizacja założona 2026-10-16; publikacja przez Trusted Publishing (faza 1).
3. **Routing:** hash w v1; history później, tylko w Shellu.
4. **Ochrona 403 poza Development:** dla wszystkich Way (secure by default), z jawnymi wyjściami i ostrzeżeniem przy starcie.
5. **Wersjonowanie:** wspólny major rodziny (Shell + wszystkie biblioteki Way), minor i patch indywidualnie; Reiho i aplikacje osobno. Pierwsze wydanie na Shellu = 2.0.0 dla wszystkich. **ConfigWay nie jest wydawany teraz:** zmiany z 2026-10-15 (Reiho 2, RequestException, przypięty Pkcs) wychodzą razem z Shellem jako 2.0.0. CultureWay, LogWay i RunWay wychodzą teraz jako kolejne preview/alpha 1.0.0-*, a stabilnego 1.0 nie dostaną.
6. **Serwowanie:** ogólny hak podstawień w `MapEmbeddedSpa` (Reiho 2.1.0), logika import map i modułów w Shellu.

7. **ConfigWay 1.0.3 nie będzie** (2026-10-16): poprawka CVE w `System.Security.Cryptography.Pkcs` wychodzi dopiero z 2.0.0. Zmiany ConfigWay i RunWay czekają na gałęziach `next`; RunWay też wychodzi jako 2.0.0 z Shellem (na NuGecie jest już RunWay 1.0.0).

## 6. Ryzyka

- **Rozmiar vendor bundle:** całe MUI bez tree-shakingu; mierzone w fazie 0, a dla panelu admina zwykle akceptowalne.
- **Zgrane wydania przy podbiciu React/MUI:** świadoma cena jednej wersji bibliotek.
- **Ukryte zależności od globalnego CSS i `document.title` w obecnych SPA:** do wyłapania w pilotażu.
- **Kolejka wydań:** praca nad Shellem zaczyna się po wydaniu bieżących zmian (LogWay, Logle, CultureWay, RunWay, Polyglot; ConfigWay czeka na 2.0.0); migracje Way dotykają tych samych repo.
- **ConfigWay i RunWay na gałęziach `next` przez cały czas prac nad Shellem** (od 2026-10-16): migracja na Shell idzie od `next`, a poprawki do `main` trzeba przenosić na `next`.
