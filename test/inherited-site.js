import { mock } from 'bun:test';
import site from './fixtures/inherited-site.json';
import catalog from './fixtures/inherited-source-catalog.json';

// As suítes herdadas validam o contrato original; os testes próprios usam o perfil e catálogo reais do B.
mock.module('#site', () => ({ default: site }));
mock.module(new URL('../content/source-catalog.json', import.meta.url).pathname, () => ({ default: catalog }));
