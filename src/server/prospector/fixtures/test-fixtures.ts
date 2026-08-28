import type { RawCompanyResult } from '../types';

/**
 * TEST-ONLY FIXTURES.
 * NEVER IMPORT OR USE IN PRODUCTION CODE / PRODUCTION SEARCH PROVIDERS.
 */
export const TEST_ONLY_RAW_COMPANIES_SAMPLE: RawCompanyResult[] = [
  {
    id: 1001,
    type: 'node',
    name: 'Instalaciones Eléctricas Nervión',
    phone: '+34 944 112 233',
    email: 'contacto-real@electricidadnervion.es',
    website: 'https://electricidadnervion.es',
    address: 'Gran Vía 45',
    city: 'Bilbao',
    province: 'Bizkaia',
    postalCode: '48001',
    tags: {
      craft: 'electrician',
      name: 'Instalaciones Eléctricas Nervión',
      'addr:city': 'Bilbao',
      'addr:street': 'Gran Vía',
      'addr:housenumber': '45',
      'contact:phone': '+34 944 112 233',
      'contact:email': 'contacto-real@electricidadnervion.es',
      'contact:website': 'https://electricidadnervion.es',
    },
    sourceUrl: 'https://www.openstreetmap.org/node/1001',
  },
  {
    id: 1002,
    type: 'way',
    name: 'Electricidad y Montajes Deusto',
    phone: '+34 944 556 677',
    website: 'http://deustomontajes.com',
    address: 'Av. Lehendakari Aguirre 12',
    city: 'Bilbao',
    province: 'Bizkaia',
    tags: {
      craft: 'electrician',
      name: 'Electricidad y Montajes Deusto',
      'contact:phone': '+34 944 556 677',
      'contact:website': 'http://deustomontajes.com',
    },
    sourceUrl: 'https://www.openstreetmap.org/way/1002',
  },
  {
    id: 1003,
    type: 'node',
    name: 'Electro Bizkaia Reparaciones',
    city: 'Barakaldo',
    province: 'Bizkaia',
    tags: {
      shop: 'electrical',
      name: 'Electro Bizkaia Reparaciones',
      'addr:city': 'Barakaldo',
    },
    sourceUrl: 'https://www.openstreetmap.org/node/1003',
  },
];
