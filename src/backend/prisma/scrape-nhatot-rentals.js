const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const DEFAULT_LISTING_URL =
  'https://gateway.chotot.com/v1/public/ad-listing';
const DEFAULT_DETAIL_URL = 'https://gateway.chotot.com/v1/public/ad-listing';
const DEFAULT_WEB_URL = 'https://www.nhatot.com';
const SOURCE = 'nhatot';
const REAL_ESTATE_CATEGORY = '1000';

loadEnv(path.join(__dirname, '..', '.env'));
normalizeDatabaseUrl();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const PropertyStatus = {
  AVAILABLE: 'AVAILABLE',
};

const PropertyType = {
  APARTMENT: 'APARTMENT',
  HOUSE: 'HOUSE',
  LAND: 'LAND',
  VILLA: 'VILLA',
  OFFICE: 'OFFICE',
  OTHER: 'OTHER',
};

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {
    max: 50,
    limit: 50,
    offset: 0,
    region: undefined,
    delay: 700,
    details: true,
    dryRun: false,
    updateExisting: false,
  };

  for (const arg of argv) {
    const [key, rawValue] = arg.split('=');
    const value = rawValue === undefined ? 'true' : rawValue;

    switch (key) {
      case '--max':
        args.max = parsePositiveInt(value, 'max');
        break;
      case '--limit':
        args.limit = Math.min(parsePositiveInt(value, 'limit'), 50);
        break;
      case '--offset':
        args.offset = parseNonNegativeInt(value, 'offset');
        break;
      case '--region':
        args.region = value;
        break;
      case '--delay':
        args.delay = parseNonNegativeInt(value, 'delay');
        break;
      case '--details':
        args.details = parseBoolean(value);
        break;
      case '--dry-run':
        args.dryRun = parseBoolean(value);
        break;
      case '--update-existing':
        args.updateExisting = parseBoolean(value);
        break;
      default:
        throw new Error(`Unknown argument: ${key}`);
    }
  }

  return args;
}

function normalizeDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const url = new URL(process.env.DATABASE_URL);
  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
  }
  url.searchParams.set('uselibpqcompat', 'true');
  process.env.DATABASE_URL = url.toString();
}

function parsePositiveInt(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${label} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInt(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${label} must be a non-negative integer.`);
  }
  return parsed;
}

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'y'].includes(String(value).toLowerCase());
}

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'vi,en;q=0.9',
      origin: DEFAULT_WEB_URL,
      referer: `${DEFAULT_WEB_URL}/thue-bat-dong-san`,
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    },
  });

  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    await sleep(attempt * 1500);
    return fetchJson(url, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${url}`);
  }

  return response.json();
}

async function scrapeListings(options) {
  const listings = [];
  let offset = options.offset;

  while (listings.length < options.max) {
    const batchLimit = Math.min(options.limit, options.max - listings.length);
    const url = new URL(DEFAULT_LISTING_URL);
    url.searchParams.set('cg', REAL_ESTATE_CATEGORY);
    url.searchParams.set('w', '1');
    url.searchParams.set('limit', String(batchLimit));
    url.searchParams.set('o', String(offset));
    url.searchParams.set('st', 'u');

    if (options.region) {
      url.searchParams.set('region_v2', options.region);
    }

    const payload = await fetchJson(url);
    const ads = Array.isArray(payload.ads) ? payload.ads : [];
    if (ads.length === 0) {
      break;
    }

    listings.push(...ads);
    offset += ads.length;

    if (ads.length < batchLimit) {
      break;
    }

    await sleep(options.delay);
  }

  return listings.slice(0, options.max);
}

async function getDetail(ad, options) {
  if (!options.details) {
    return ad;
  }

  const ids = [...new Set([ad.list_id, ad.ad_id].filter(Boolean))];

  for (const id of ids) {
    try {
      await sleep(options.delay);
      const payload = await fetchJson(`${DEFAULT_DETAIL_URL}/${id}`);
      return {
        ...ad,
        ...(payload.ad || payload),
      };
    } catch (error) {
      if (id === ids[ids.length - 1]) {
        console.warn(`Detail skipped for ${id}: ${error.message}`);
      }
    }
  }

  return ad;
}

async function importListing(ad, options) {
  const detail = await getDetail(ad, options);
  const property = mapListingToProperty(detail, ad);

  if (!property) {
    return { status: 'skipped', reason: 'missing required fields' };
  }

  if (options.dryRun) {
    return { status: 'would-create', property };
  }

  const existing = await findExistingProperty(property.sourceListingId);

  if (existing && !options.updateExisting) {
    return { status: 'exists', id: existing.id };
  }

  if (existing) {
    await saveProperty(property, existing.id);
    return { status: 'updated', id: existing.id };
  }

  const created = await saveProperty(property);

  return { status: 'created', id: created.id };
}

async function findExistingProperty(sourceListingId) {
  const result = await pool.query(
    'SELECT id FROM "Property" WHERE description LIKE $1 LIMIT 1',
    [`%${sourceMarker(sourceListingId)}%`],
  );

  return result.rows[0];
}

async function saveProperty(property, propertyId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const regionId = await ensureRegion(client, property);
    const saved = propertyId
      ? await updateProperty(client, propertyId, property, regionId)
      : await createProperty(client, property, regionId);

    await replaceImages(client, saved.id, property);
    await client.query('COMMIT');
    return saved;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureRegion(client, property) {
  const code = [
    SOURCE,
    slugify(property.city),
    slugify(property.district),
  ]
    .filter(Boolean)
    .join(':')
    .slice(0, 191);

  const result = await client.query(
    `
      INSERT INTO "Region" (code, name, city, district, ward, "updatedAt")
      VALUES ($1, $2, $3, $4, NULL, NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        city = EXCLUDED.city,
        district = EXCLUDED.district,
        ward = NULL,
        "updatedAt" = NOW()
      RETURNING id
    `,
    [code, property.district || property.city, property.city, property.district],
  );

  return result.rows[0].id;
}

async function createProperty(client, property, regionId) {
  const result = await client.query(
    `
      INSERT INTO "Property" (
        title, description, type, status, price, area, address, city, district,
        ward, latitude, longitude, bedroom, bathroom, floor, "regionId",
        "updatedAt"
      )
      VALUES (
        $1, $2, $3::"PropertyType", $4::"PropertyStatus", $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, NOW()
      )
      RETURNING id
    `,
    propertyValues(property, regionId),
  );

  return result.rows[0];
}

async function updateProperty(client, propertyId, property, regionId) {
  const result = await client.query(
    `
      UPDATE "Property" SET
        title = $1,
        description = $2,
        type = $3::"PropertyType",
        status = $4::"PropertyStatus",
        price = $5,
        area = $6,
        address = $7,
        city = $8,
        district = $9,
        ward = $10,
        latitude = $11,
        longitude = $12,
        bedroom = $13,
        bathroom = $14,
        floor = $15,
        "regionId" = $16,
        "updatedAt" = NOW()
      WHERE id = $17
      RETURNING id
    `,
    [...propertyValues(property, regionId), propertyId],
  );

  return result.rows[0];
}

function propertyValues(property, regionId) {
  return [
    property.title,
    property.description,
    property.type,
    PropertyStatus.AVAILABLE,
    property.price.toFixed(2),
    property.area.toFixed(2),
    property.address,
    property.city,
    property.district,
    property.ward || null,
    property.latitude || null,
    property.longitude || null,
    property.bedroom || null,
    property.bathroom || null,
    property.floor || null,
    regionId,
  ];
}

async function replaceImages(client, propertyId, property) {
  await client.query('DELETE FROM "PropertyImage" WHERE "propertyId" = $1', [
    propertyId,
  ]);

  for (const [index, url] of property.images.entries()) {
    await client.query(
      `
        INSERT INTO "PropertyImage" ("propertyId", url, alt, "sortOrder")
        VALUES ($1, $2, $3, $4)
      `,
      [propertyId, url, property.title, index],
    );
  }
}

function mapListingToProperty(detail, ad) {
  const merged = { ...ad, ...detail };
  const sourceListingId = String(
    merged.list_id || merged.ad_id || merged.listId || '',
  );
  const title = cleanText(merged.subject || merged.title);
  const price = parseNumber(merged.price);
  const area = parseArea(merged);
  const city = cleanText(merged.region_name || merged.regionName);
  const district = cleanText(merged.area_name || merged.district_name);
  const ward = cleanText(merged.ward_name);

  if (!sourceListingId || !title || !price || !area || !city || !district) {
    return null;
  }

  const sourceUrl = getSourceUrl(merged, sourceListingId);
  const rawDescription = cleanText(merged.body || merged.description);
  const address =
    cleanText(merged.address) ||
    [ward, district, city].filter(Boolean).join(', ');

  return {
    sourceListingId,
    sourceUrl,
    title,
    description: [
      rawDescription,
      '',
      `Source: ${SOURCE}`,
      `Source listing: ${sourceMarker(sourceListingId)}`,
      `Source URL: ${sourceUrl}`,
    ]
      .filter((part) => part !== undefined)
      .join('\n'),
    type: mapPropertyType(merged),
    price,
    area,
    address,
    city,
    district,
    ward: ward || undefined,
    bedroom: parseInteger(merged.rooms) || parseInteger(merged.bedroom) || parsePn(title),
    bathroom:
      parseInteger(merged.toilets) ||
      parseInteger(merged.bathroom) ||
      parseBathroom(rawDescription),
    floor: parseInteger(merged.floors) || parseFloor(title),
    latitude: parseNumber(merged.latitude || merged.lat),
    longitude: parseNumber(merged.longitude || merged.lng || merged.lon),
    images: collectImages(merged),
  };
}

function mapPropertyType(data) {
  const text = [
    data.category_name,
    data.categoryName,
    data.property_type,
    data.realestate_type,
    data.subject,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('chung') || text.includes('apartment') || text.includes('can ho')) {
    return PropertyType.APARTMENT;
  }
  if (text.includes('dat') || text.includes('land')) {
    return PropertyType.LAND;
  }
  if (text.includes('biet thu') || text.includes('villa')) {
    return PropertyType.VILLA;
  }
  if (text.includes('van phong') || text.includes('mat bang') || text.includes('office')) {
    return PropertyType.OFFICE;
  }
  if (text.includes('nha') || text.includes('phong tro')) {
    return PropertyType.HOUSE;
  }

  return PropertyType.OTHER;
}

function parseArea(data) {
  const direct = parseNumber(
    data.size || data.area_m2 || data.living_size || data.land_area,
  );
  if (direct) {
    return direct;
  }

  const text = [data.subject, data.body, data.description].filter(Boolean).join(' ');
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*m(?:2|\u00b2)/i);
  return match ? parseNumber(match[1]) : undefined;
}

function collectImages(data) {
  const values = [];
  for (const key of ['images', 'image_list', 'imageList']) {
    if (Array.isArray(data[key])) {
      values.push(...data[key]);
    }
  }
  if (data.image) {
    values.push(data.image);
  }

  return [...new Set(values.map(normalizeImageUrl).filter(Boolean))];
}

function normalizeImageUrl(value) {
  if (!value) {
    return undefined;
  }

  const raw = typeof value === 'string' ? value : value.url || value.image;
  if (!raw) {
    return undefined;
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  return `https://cdn.chotot.com/unsafe/640x0/${raw.replace(/^\/+/, '')}`;
}

function getSourceUrl(data, sourceListingId) {
  const rawUrl = data.url || data.web_url || data.ad_url;
  if (rawUrl) {
    return rawUrl.startsWith('http') ? rawUrl : `${DEFAULT_WEB_URL}${rawUrl}`;
  }

  return `${DEFAULT_WEB_URL}/thue-bat-dong-san/${sourceListingId}.htm`;
}

function sourceMarker(sourceListingId) {
  return `[${SOURCE}:${sourceListingId}]`;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseInteger(value) {
  const parsed = parseNumber(value);
  return parsed === undefined ? undefined : Math.round(parsed);
}

function parsePn(text) {
  const match = text.match(/(\d+)\s*pn/i);
  return match ? parseInteger(match[1]) : undefined;
}

function parseBathroom(text) {
  const match = text.match(/(\d+)\s*(?:wc|toilet|phong tam)/i);
  return match ? parseInteger(match[1]) : undefined;
}

function parseFloor(text) {
  const match = text.match(/(\d+)\s*(?:tang|lau)/i);
  return match ? parseInteger(match[1]) : undefined;
}

function cleanText(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim();
}

function slugify(value) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const listings = await scrapeListings(options);
  const summary = {
    fetched: listings.length,
    created: 0,
    updated: 0,
    exists: 0,
    skipped: 0,
    dryRun: options.dryRun,
  };

  for (const ad of listings) {
    const result = await importListing(ad, options);
    const summaryKey =
      result.status === 'would-create'
        ? 'created'
        : result.status === 'would-update'
          ? 'updated'
          : result.status;
    summary[summaryKey] = (summary[summaryKey] || 0) + 1;

    const label = result.id ? `#${result.id}` : result.reason || '';
    console.log(`${result.status}: ${label}`);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
