import { describe, expect, it } from 'vitest';
import { wayTarget } from '../src/app/navigation.js';
import type { WayInfo } from '../src/app/settings.js';

const way = (id: string): WayInfo => ({
  id,
  name: id,
  icon: null,
  url: `/app/${id}/`,
  apiBase: `/app/${id}/api`,
  moduleUrl: `/app/${id}/_way/way.js`,
  cssUrl: null,
  settings: {},
});
const ways = [way('config'), way('scheduler')];

describe('wayTarget', () => {
  it('in the panel, routes to any listed Way', () => {
    expect(wayTarget({ mode: 'panel', ways }, 'config', 'scheduler', 'jobs/1')).toEqual({ route: '/scheduler/jobs/1' });
    expect(wayTarget({ mode: 'panel', ways }, 'config', 'config', '/section/smtp')).toEqual({ route: '/config/section/smtp' });
  });

  it("on a Way's page, routes within it", () => {
    expect(wayTarget({ mode: 'single', ways }, 'config', 'config', 'section/smtp')).toEqual({ route: '/section/smtp' });
    expect(wayTarget({ mode: 'single', ways }, 'config', 'config', '')).toEqual({ route: '/' });
  });

  it("on a Way's page, goes to the other Way's page", () => {
    expect(wayTarget({ mode: 'single', ways }, 'config', 'scheduler', '/jobs/1')).toEqual({ url: '/app/scheduler/#/jobs/1' });
  });

  it('goes nowhere for a Way the user may not open', () => {
    expect(wayTarget({ mode: 'panel', ways }, 'config', 'traces', 'trace/abc')).toBeNull();
    expect(wayTarget({ mode: 'single', ways }, 'config', 'traces', 'trace/abc')).toBeNull();
  });
});
