// @ts-expect-error a CommonJS file without types
import legacy from './legacy.cjs';
import { defineWay } from '@kododo-dev/way-shell';

export default defineWay({ App: () => <p>{(legacy as { version: string }).version}</p> });
