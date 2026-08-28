import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ProspectorEngine } from './engine';
import type { SearchProvider } from './search-provider';
import type { CompanySearchQuery, RawCompanyResult } from './types';
import { ResearchService } from './research-service';
import { ScoringService } from './scoring-service';
import { MessagingService } from './messaging-service';
import { TEST_ONLY_RAW_COMPANIES_SAMPLE } from './fixtures/test-fixtures';

// Mock search provider that returns whatever is configured
class MockTestSearchProvider implements SearchProvider {
  constructor(private readonly resultsToReturn: RawCompanyResult[]) {}

  async search(_query: CompanySearchQuery): Promise<RawCompanyResult[]> {
    return this.resultsToReturn;
  }
}

describe('Prospector IA - Integridad de Datos y Reglas de Verificación', () => {
  // TEST A: Si el proveedor devuelve 0 -> Prospector devuelve 0
  test('A. Si proveedor real devuelve 0 -> Prospector devuelve exactamente 0 resultados', async () => {
    const emptyProvider = new MockTestSearchProvider([]);
    const engine = new ProspectorEngine({ searchProvider: emptyProvider });

    const results = await engine.prospect({
      sector: 'Electricistas',
      location: 'Bizkaia',
      limit: 20,
    });

    assert.equal(results.length, 0, 'No debe fabricar empresas si el provider devuelve 0');
  });

  // TEST B: Nunca se completa automáticamente una búsqueda con empresas hardcoded
  test('B. Si proveedor devuelve 3 empresas -> Prospector devuelve exactamente 3 (no completa hasta el límite)', async () => {
    const threeItemsProvider = new MockTestSearchProvider(TEST_ONLY_RAW_COMPANIES_SAMPLE);
    const engine = new ProspectorEngine({ searchProvider: threeItemsProvider });

    const results = await engine.prospect({
      sector: 'Electricistas',
      location: 'Bizkaia',
      limit: 20,
    });

    assert.equal(results.length, 3, 'Debe devolver exactamente las 3 encontradas, sin padding artificial');
  });

  // TEST C: Una URL publicada pero no comprobada no aparece como WEBSITE_VERIFICADA
  test('C. Una URL publicada pero no comprobada en vivo tiene status URL_PUBLICADA_EN_FUENTE y confidence INFERIDO (no VERIFICADO)', async () => {
    const researchService = new ResearchService({ verifyWebsitesLive: false });
    const raw: RawCompanyResult = {
      id: 101,
      type: 'node',
      name: 'Electricidad Ejemplo S.L.',
      website: 'https://electricidadejemplo.com',
      sourceUrl: 'https://www.openstreetmap.org/node/101',
    };

    const researched = await researchService.researchCompany(raw);

    assert.equal(
      researched.website.status,
      'URL_PUBLICADA_EN_FUENTE',
      'El status debe ser URL_PUBLICADA_EN_FUENTE y no WEBSITE_VERIFICADA'
    );
    assert.notEqual(
      researched.website.confidence,
      'VERIFICADO',
      'confidence no puede ser VERIFICADO si no ha sido comprobada en vivo'
    );
    assert.equal(researched.website.verifiedLive, false);
  });

  // TEST D: No existe contactPerson cuando no aparece una persona real en la fuente
  test('D. contactPerson es undefined y NO_DISPONIBLE si no hay una persona real identificada en la fuente', async () => {
    const researchService = new ResearchService();
    const rawWithoutPerson: RawCompanyResult = {
      id: 102,
      type: 'node',
      name: 'Electricidad Sin Contacto',
      sourceUrl: 'https://www.openstreetmap.org/node/102',
    };

    const researched = await researchService.researchCompany(rawWithoutPerson);

    assert.equal(researched.contactPerson.value, undefined);
    assert.equal(researched.contactPerson.confidence, 'NO_DISPONIBLE');
  });

  // TEST E: No se generan emails cuando no constan en la fuente
  test('E. No se generan emails ficticios (e.g. info@, contacto@) si no constan en la fuente', async () => {
    const researchService = new ResearchService();
    const rawWithoutEmail: RawCompanyResult = {
      id: 103,
      type: 'node',
      name: 'Instalaciones Ramos',
      website: 'https://instalacionesramos.es',
      sourceUrl: 'https://www.openstreetmap.org/node/103',
    };

    const researched = await researchService.researchCompany(rawWithoutEmail);

    assert.equal(researched.email.value, undefined);
    assert.equal(researched.email.confidence, 'NO_DISPONIBLE');
  });

  // TEST F: No se generan teléfonos cuando no constan en la fuente
  test('F. No se generan teléfonos ficticios si no constan en la fuente', async () => {
    const researchService = new ResearchService();
    const rawWithoutPhone: RawCompanyResult = {
      id: 104,
      type: 'node',
      name: 'Instalaciones Sin Telefono',
      sourceUrl: 'https://www.openstreetmap.org/node/104',
    };

    const researched = await researchService.researchCompany(rawWithoutPhone);

    assert.equal(researched.phone.value, undefined);
    assert.equal(researched.phone.confidence, 'NO_DISPONIBLE');
  });

  // TEST G: No se inventan formularios /contacto
  test('G. No se inventa ${raw.website}/contacto como formulario de contacto', async () => {
    const researchService = new ResearchService();
    const rawWithWebsiteOnly: RawCompanyResult = {
      id: 105,
      type: 'node',
      name: 'Electricidad Norte',
      website: 'https://electricidadnorte.es',
      sourceUrl: 'https://www.openstreetmap.org/node/105',
    };

    const researched = await researchService.researchCompany(rawWithWebsiteOnly);

    assert.equal(researched.contactFormUrl.value, undefined);
    assert.equal(researched.contactFormUrl.confidence, 'NO_DISPONIBLE');
  });

  // TEST H: Los datos inferidos están explícitamente separados de los verificados en el scoring y research
  test('H. Los datos inferidos (tamaño, necesidades de partes/presupuestos/facturas) están clasificados como INFERIDO', async () => {
    const researchService = new ResearchService();
    const scoringService = new ScoringService();

    const raw: RawCompanyResult = {
      id: 106,
      type: 'node',
      name: 'Electricidad Nervión',
      phone: '+34 944 112 233',
      address: 'Gran Vía 45, Bilbao',
      tags: { craft: 'electrician' },
      sourceUrl: 'https://www.openstreetmap.org/node/106',
    };

    const researched = await researchService.researchCompany(raw);
    const scored = scoringService.scoreCompany(researched);

    // Verificar que los campos operativos son INFERIDO
    assert.equal(researched.inferredSize.confidence, 'INFERIDO');
    assert.equal(researched.inferredNeeds.workReports.confidence, 'INFERIDO');
    assert.equal(researched.inferredNeeds.budgets.confidence, 'INFERIDO');
    assert.equal(researched.inferredNeeds.invoicing.confidence, 'INFERIDO');

    // Verificar que en el desglose de scoring cada factor tiene su evidenceType claro
    const inferredFactors = scored.breakdown.filter((f) => f.evidenceType === 'INFERIDO');
    const verifiedFactors = scored.breakdown.filter((f) => f.evidenceType === 'VERIFICADO');

    assert.ok(inferredFactors.length >= 3, 'Debe haber factores explícitamente marcados como INFERIDO');
    assert.ok(verifiedFactors.length >= 2, 'Debe haber factores explícitamente marcados como VERIFICADO');
  });

  // TEST I: El pipeline conserva la sourceUrl real
  test('I. El pipeline conserva la sourceUrl real derivada del tipo e id de OpenStreetMap', async () => {
    const raw: RawCompanyResult = {
      id: 998877,
      type: 'node',
      name: 'Electricidad Real OSM',
      sourceUrl: 'https://www.openstreetmap.org/node/998877',
    };

    const engine = new ProspectorEngine({
      searchProvider: new MockTestSearchProvider([raw]),
    });

    const [lead] = await engine.prospect({
      sector: 'Electricistas',
      location: 'Bizkaia',
    });

    assert.equal(lead.company.sourceUrl, 'https://www.openstreetmap.org/node/998877');
    assert.equal(lead.company.osmType, 'node');
    assert.equal(lead.company.osmId, 998877);
  });

  // TEST J: Los mensajes no contienen claims cuantitativos no demostrados
  test('J. Los mensajes comerciales no contienen afirmaciones no demostradas como "ahorro de 1-2 horas diarias" ni "os ahorraría varias horas"', async () => {
    const scoringService = new ScoringService();
    const messagingService = new MessagingService();
    const researchService = new ResearchService();

    const raw: RawCompanyResult = {
      id: 107,
      type: 'node',
      name: 'ElectroTest',
      sourceUrl: 'https://www.openstreetmap.org/node/107',
    };

    const researched = await researchService.researchCompany(raw);
    const scored = scoringService.scoreCompany(researched);
    const messages = messagingService.generateDrafts(scored);

    const allMessageTexts = [
      messages.linkedIn.text,
      messages.email.subject,
      messages.email.text,
      messages.whatsapp.text,
      messages.sms.text,
    ].join(' ');

    assert.ok(
      !allMessageTexts.includes('ahorro estimado de 1-2 horas'),
      'No debe contener claim cuantitativo de 1-2 horas'
    );
    assert.ok(
      !allMessageTexts.includes('ahorraría varias horas'),
      'No debe contener claim cuantitativo de varias horas'
    );
    assert.ok(
      !allMessageTexts.includes('ahorrar 2 horas'),
      'No debe contener promesas temporales no demostradas'
    );
    assert.ok(
      allMessageTexts.includes('diseñad') || allMessageTexts.includes('facilitar') || allMessageTexts.includes('simplificar'),
      'Debe utilizar lenguaje prudente y enfocado en propósito de la herramienta'
    );
  });
});
