// Browser scenarios against a running demo (Production environment):
//   node check.mjs http://localhost:5085 [chrome|msedge|firefox|webkit]
// Needs the playwright package (npm i --no-save playwright); firefox and webkit need `npx playwright install`.
import { chromium, firefox, webkit } from 'playwright';

const base = process.argv[2].replace(/\/$/, '');
const which = process.argv[3] ?? 'chrome';
const browser = which === 'firefox' ? await firefox.launch() : which === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: which });

const results = [];
const record = (name, ok, detail = '') => results.push({ name, ok, detail });
const visible = (locator) => locator.first().waitFor({ timeout: 10000 }).then(() => true, () => false);

async function session(user, roles, contextOptions = {}) {
  // English and light theme to start with, whatever the machine's settings.
  const context = await browser.newContext({ locale: 'en-US', colorScheme: 'light', ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  // The demo's "Expire session" answers 401 on purpose.
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().endsWith('/favicon.ico') && !r.url().endsWith('/api/Expire')) errors.push(`${r.status()} ${r.url()}`);
  });
  if (user) await page.goto(`${base}/login?user=${user}${roles ? `&roles=${roles}` : ''}`);
  return { context, page, errors };
}

const apiOk = (page, way) => visible(page.getByTestId('api').filter({ hasText: `API: ${way} at` }));
const menuOf = (page) => page.locator('nav .MuiListItemText-primary').allTextContents();

// Admin in the panel.
{
  const { context, page, errors } = await session('bob', 'Admin');
  await page.goto(`${base}/admin/`);
  record('panel opens the first Way', (await apiOk(page, 'hello')) && page.url().endsWith('#/hello/'), page.url());
  record('panel menu for Admin', (await menuOf(page)).join(',') === 'Hello,Reports', (await menuOf(page)).join(','));
  record('page header of the module', await visible(page.getByRole('heading', { name: 'Demo: hello' })));
  record('user at the bottom of the menu', await visible(page.getByTestId('shell-user').filter({ hasText: 'bob' })));
  record('host links in the menu', await visible(page.getByRole('link', { name: 'GitHub' })));
  record('notice above the Way', await visible(page.getByTestId('shell-notice').filter({ hasText: 'A public demo' })));
  await page.getByTestId('shell-user').getByRole('link', { name: 'bob' }).click();
  record('hidden Way opens from the user link', (await apiOk(page, 'account')) && page.url().endsWith('#/account/'), page.url());
  record('hidden Way is not in the menu', (await menuOf(page)).join(',') === 'Hello,Reports', (await menuOf(page)).join(','));
  await page.goto(`${base}/admin/#/hello/`);
  await apiOk(page, 'hello');

  const wayMenu = page.getByTestId('demo-menu');
  record("Way's own items in the side menu", await visible(wayMenu.getByText('Overview')));
  await wayMenu.getByText('Details').click();
  record('route inside the module from its menu', (await visible(page.getByTestId('details'))) && page.url().endsWith('#/hello/details'), page.url());
  await wayMenu.getByText('Details').click();
  record('menu item again from a nested route (paths from the Way root)', page.url().endsWith('#/hello/details'), page.url());
  await wayMenu.getByText('Overview').click();
  record('back to the Way root from its menu', page.url().endsWith('#/hello/'), page.url());

  await page.getByRole('link', { name: 'Other Way' }).click();
  record('link to another Way in the panel (href)', (await apiOk(page, 'reports')) && page.url().includes('#/reports/'), page.url());
  record('menu of the Way moves with it', (await page.getByTestId('demo-menu').count()) === 1);

  await page.getByRole('button', { name: 'Dialog' }).click();
  record('dialog of the module', await visible(page.getByRole('dialog').getByText('A dialog rendered by the module')));
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  record('theme reaches the module', await visible(page.getByText('theme: dark')));
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  record('dark theme applied', bodyBg === 'rgb(26, 26, 26)', bodyBg);

  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('menuitem', { name: 'Polski' }).click();
  record('language reaches the module', await visible(page.getByText('Cześć, bob')));
  record('language reaches the shell', await visible(page.getByRole('button', { name: 'Jasny motyw' })));
  await page.reload();
  record('language and theme are remembered', (await visible(page.getByText('Cześć, bob'))) && (await visible(page.getByText('theme: dark'))));

  await page.getByRole('button', { name: 'Wygaś sesję' }).click();
  record('expired session opens the dialog', await visible(page.getByRole('dialog').getByText('Sesja wygasła')));
  await page.getByRole('button', { name: 'Kontynuuj' }).click();
  record('the module sees SessionExpiredError', await visible(page.getByTestId('expiry').filter({ hasText: 'session expired' })));

  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await page.waitForURL(`${base}/`);
  record('sign-out posts and signs out', await visible(page.getByText('Signed in as nobody')));
  record('no errors (admin)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// Signed-in user without Admin.
{
  const { context, page } = await session('ada');
  await page.goto(`${base}/admin/`);
  await apiOk(page, 'hello');
  record('panel menu without Admin', (await menuOf(page)).join(',') === 'Hello', (await menuOf(page)).join(','));
  record('no link to a Way the user cannot open', (await page.getByRole('link', { name: 'Other Way' }).count()) === 0);
  await page.goto(`${base}/admin/#/reports/`);
  record('panel refuses a Way the user cannot open', await visible(page.getByText('cannot open it')));
  const reports = await context.request.get(`${base}/reports/`, { maxRedirects: 0 });
  record('Reports page is forbidden', reports.status() === 302 && /AccessDenied/.test(reports.headers().location ?? ''), `${reports.status()}`);
  await context.close();
}

// Anonymous on a single Way.
{
  const { context, page, errors } = await session();
  await page.goto(`${base}/hello/`);
  record('single Way page', await apiOk(page, 'hello'));
  record('single Way without a list of Ways', (await page.locator('nav').count()) === 0);
  record('anonymous user', await visible(page.getByText('Hello, stranger')));
  await page.goto(`${base}/hello/#/details`);
  record('deep link into the module', await visible(page.getByTestId('details')));
  const panel = await context.request.get(`${base}/admin/`, { maxRedirects: 0 });
  record('panel asks anonymous users to sign in', panel.status() === 302 && /login/.test(panel.headers().location ?? ''), `${panel.status()}`);
  record('no errors (anonymous)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// Admin on a single Way: links lead to the other Way's own page.
{
  const { context, page, errors } = await session('bob', 'Admin');
  await page.goto(`${base}/hello/`);
  await apiOk(page, 'hello');
  const href = await page.getByRole('link', { name: 'Other Way' }).getAttribute('href');
  record("href() of another Way on a single page is that Way's page", /\/reports\/#\/$/.test(href ?? ''), href ?? '');
  await page.getByRole('link', { name: 'Other Way' }).click();
  record('link from a single Way opens the other Way', (await apiOk(page, 'reports')) && new URL(page.url()).pathname.endsWith('/reports/'), page.url());
  record('no errors (single Way links)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// Narrow screen: the menu slides in from the page header's button.
{
  const { context, page } = await session('bob', 'Admin', { viewport: { width: 390, height: 800 } });
  await page.goto(`${base}/admin/`);
  await apiOk(page, 'hello');
  record('menu hidden on a phone', !(await page.getByRole('link', { name: 'GitHub' }).isVisible()));
  await page.getByRole('button', { name: 'Open menu' }).click();
  record('menu button opens the menu', await visible(page.getByRole('link', { name: 'GitHub' })));
  await page.locator('nav').getByText('Reports').click();
  const closed = await page.getByRole('link', { name: 'GitHub' }).waitFor({ state: 'hidden', timeout: 5000 }).then(() => true, () => false);
  record('choosing a Way closes the menu', (await apiOk(page, 'reports')) && closed);
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
console.log(`\n${which} ${base}: ${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
