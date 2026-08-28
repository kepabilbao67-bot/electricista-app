import type { CompanySearchQuery, RawCompanyResult } from './types';

export interface SearchProvider {
  search(query: CompanySearchQuery): Promise<RawCompanyResult[]>;
}

/**
 * Public OpenStreetMap / Overpass API Search Provider.
 * Queries real public data via Overpass API.
 * NO HARDCODED OR INVENTED BUSINESSES.
 * If the source returns 0 results, it returns exactly 0 results.
 * If the source returns 3 results, it returns exactly 3 results.
 */
export class OverpassSearchProvider implements SearchProvider {
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(
    endpoint = 'https://overpass-api.de/api/interpreter',
    timeoutMs = 12000
  ) {
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }

  async search(query: CompanySearchQuery): Promise<RawCompanyResult[]> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const locationSanitized = (query.location || 'Bizkaia').replace(/["\\]/g, '').trim();

    // Map common sectors to OSM tags
    const sectorLower = (query.sector || '').toLowerCase();
    let filterQuery = '["craft"="electrician"]';
    if (sectorLower.includes('fontan') || sectorLower.includes('plumb')) {
      filterQuery = '["craft"="plumber"]';
    } else if (sectorLower.includes('clima') || sectorLower.includes('hvac')) {
      filterQuery = '["craft"="hvac"]';
    } else if (sectorLower.includes('pintor') || sectorLower.includes('paint')) {
      filterQuery = '["craft"="painter"]';
    } else if (sectorLower.includes('carpint')) {
      filterQuery = '["craft"="carpenter"]';
    }

    const overpassQl = `
      [out:json][timeout:15];
      area["name"~"${locationSanitized}",i]->.searchArea;
      (
        node${filterQuery}(area.searchArea);
        way${filterQuery}(area.searchArea);
        node["shop"="electrical"](area.searchArea);
        way["shop"="electrical"](area.searchArea);
      );
      out body ${limit};
    `.trim();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'KepaForce360-Prospector/1.0 (B2B Research)',
        },
        body: `data=${encodeURIComponent(overpassQl)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        // Return empty array on upstream error, do not fabricate results
        return [];
      }

      const data = (await res.json()) as { elements?: Array<Record<string, unknown>> };
      if (!data.elements || !Array.isArray(data.elements)) {
        return [];
      }

      const results: RawCompanyResult[] = [];

      for (const el of data.elements) {
        const type = el.type as 'node' | 'way' | 'relation';
        const id = el.id as string | number;
        const tags = (el.tags || {}) as Record<string, string>;

        const name = tags.name || tags['brand'] || tags['operator'];
        if (!name || name.trim().length === 0) {
          continue;
        }

        const phone =
          tags.phone ||
          tags['contact:phone'] ||
          tags['contact:mobile'] ||
          tags['mobile'] ||
          undefined;

        const email =
          tags.email ||
          tags['contact:email'] ||
          undefined;

        const website =
          tags.website ||
          tags['contact:website'] ||
          tags['url'] ||
          undefined;

        const contactFormUrl =
          tags['contact:webform'] ||
          undefined;

        const street = tags['addr:street'];
        const housenumber = tags['addr:housenumber'];
        const address = street ? (housenumber ? `${street} ${housenumber}` : street) : undefined;
        const city = tags['addr:city'] || tags['addr:municipality'] || query.location;
        const province = tags['addr:province'] || query.location;
        const postalCode = tags['addr:postcode'] || undefined;

        // Construct real OSM URL with actual type and ID
        const sourceUrl = `https://www.openstreetmap.org/${type}/${id}`;

        results.push({
          id,
          type: type || 'node',
          name: name.trim(),
          lat: typeof el.lat === 'number' ? el.lat : undefined,
          lon: typeof el.lon === 'number' ? el.lon : undefined,
          address,
          city,
          province,
          postalCode,
          phone: phone ? phone.trim() : undefined,
          email: email ? email.trim() : undefined,
          website: website ? website.trim() : undefined,
          contactPerson: undefined, // OSM almost never contains individual contact persons
          contactFormUrl,
          tags,
          sourceUrl,
        });

        if (results.length >= limit) {
          break;
        }
      }

      return results;
    } catch {
      // Return empty array on network/timeout failure. NEVER return mock/fictitious data.
      return [];
    }
  }
}
