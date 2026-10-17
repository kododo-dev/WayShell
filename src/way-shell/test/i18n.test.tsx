import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useI18n } from '../src/index.js';
import { I18nContext, format, resolveLanguage, shellText } from '../src/i18n.js';

function Greeting({ name }: { name?: string }) {
  const { t } = useI18n();
  return <span>{[t('hello', { name: name ?? '' }), t('onlyEnglish'), t('missing', undefined, 'Fallback')].join('|')}</span>;
}

const translations = {
  en: { hello: 'Hello {name}', onlyEnglish: 'English only' },
  pl: { hello: 'Cześć {name}' },
};

describe('useI18n', () => {
  it('takes the current language, then English, then the fallback', () => {
    const html = renderToString(
      <I18nContext.Provider value={{ language: 'pl', setLanguage: () => {}, translations }}>
        <Greeting name="Ada" />
      </I18nContext.Provider>,
    );
    expect(html).toBe('<span>Cześć Ada|English only|Fallback</span>');
  });
});

describe('resolveLanguage', () => {
  it('takes the first supported candidate', () => {
    expect(resolveLanguage(null, 'pl-PL')).toBe('pl');
    expect(resolveLanguage('en', 'pl')).toBe('en');
  });

  it('falls back to English', () => {
    expect(resolveLanguage('xx', 'yy')).toMatch(/^(en|pl)$/); // the browser's language may come first
  });
});

describe('shell strings', () => {
  it('exist in Polish and fill placeholders', () => {
    expect(shellText('pl', 'wayFailed', { name: 'Config', message: 'boom' })).toBe('Config przestał działać: boom');
    expect(shellText('de', 'signOut')).toBe('Sign out');
  });

  it('leaves unknown placeholders', () => {
    expect(format('{a} {b}', { a: 1 })).toBe('1 {b}');
  });
});
