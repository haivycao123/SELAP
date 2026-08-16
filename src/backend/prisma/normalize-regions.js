const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

loadEnv(path.join(__dirname, '..', '.env'));
normalizeDatabaseUrl();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const CITY_ALIASES = new Map([
  ['ho-chi-minh', 'TP Hồ Chí Minh'],
  ['ho-chi-minh-city', 'TP Hồ Chí Minh'],
  ['hcm', 'TP Hồ Chí Minh'],
  ['tp-hcm', 'TP Hồ Chí Minh'],
  ['tp-ho-chi-minh', 'TP Hồ Chí Minh'],
  ['tphcm', 'TP Hồ Chí Minh'],
  ['thanh-pho-ho-chi-minh', 'TP Hồ Chí Minh'],
  ['ha-noi', 'Hà Nội'],
  ['tp-ha-noi', 'Hà Nội'],
  ['thanh-pho-ha-noi', 'Hà Nội'],
]);

const HCMC_DISTRICTS = new Map([
  ['1', 'Quận 1'],
  ['2', 'Quận 2'],
  ['3', 'Quận 3'],
  ['4', 'Quận 4'],
  ['5', 'Quận 5'],
  ['6', 'Quận 6'],
  ['7', 'Quận 7'],
  ['8', 'Quận 8'],
  ['9', 'Quận 9'],
  ['10', 'Quận 10'],
  ['11', 'Quận 11'],
  ['12', 'Quận 12'],
  ['binh-chanh', 'Huyện Bình Chánh'],
  ['binh-tan', 'Quận Bình Tân'],
  ['binh-thanh', 'Quận Bình Thạnh'],
  ['can-gio', 'Huyện Cần Giờ'],
  ['cu-chi', 'Huyện Củ Chi'],
  ['go-vap', 'Quận Gò Vấp'],
  ['hoc-mon', 'Huyện Hóc Môn'],
  ['nha-be', 'Huyện Nhà Bè'],
  ['phu-nhuan', 'Quận Phú Nhuận'],
  ['tan-binh', 'Quận Tân Bình'],
  ['tan-phu', 'Quận Tân Phú'],
  ['thu-duc', 'TP Thủ Đức'],
]);

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

function normalizeKey(value) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .replace(/\b(thanh pho|tp|quan|huyen|thi xa|tx)\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugify(value) {
  return normalizeKey(value) || 'unknown';
}

function cleanText(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim();
}

function toTitleCase(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function hasVietnameseAccent(value) {
  return /[À-ỹĐđ]/.test(value);
}

function canonicalCity(value) {
  const cleaned = cleanText(value);
  const direct = CITY_ALIASES.get(normalizeKey(cleaned));
  return direct || cleaned || 'Unknown';
}

function districtCore(value) {
  return normalizeKey(value);
}

function canonicalDistrict(value, city) {
  const cleaned = cleanText(value);
  const core = districtCore(cleaned);

  if (canonicalCity(city) === 'TP Hồ Chí Minh' && HCMC_DISTRICTS.has(core)) {
    return HCMC_DISTRICTS.get(core);
  }

  if (!cleaned) {
    return 'Unknown';
  }

  if (/^(Quận|Huyện|TP|Thị xã)\s/i.test(cleaned)) {
    return hasVietnameseAccent(cleaned) ? cleaned : toTitleCase(cleaned);
  }

  return hasVietnameseAccent(cleaned) ? cleaned : toTitleCase(cleaned);
}

function bestDisplay(values, fallback) {
  const uniqueValues = [...new Set(values.map(cleanText).filter(Boolean))];
  return (
    uniqueValues.find((value) => hasVietnameseAccent(value)) ||
    uniqueValues.find((value) => /^(Quận|Huyện|TP|Thị xã)\s/i.test(value)) ||
    uniqueValues[0] ||
    fallback
  );
}

function groupKey(city, district) {
  return `${normalizeKey(canonicalCity(city))}:${districtCore(district)}`;
}

async function getGroups(client) {
  const [regions, properties] = await Promise.all([
    client.query('SELECT id, name, code, city, district, ward FROM "Region"'),
    client.query(
      'SELECT id, city, district, "regionId" FROM "Property" WHERE city IS NOT NULL AND district IS NOT NULL',
    ),
  ]);

  const groups = new Map();

  for (const region of regions.rows) {
    if (!region.city || !region.district) {
      continue;
    }

    const key = groupKey(region.city, region.district);
    const group = ensureGroup(groups, key, region.city, region.district);
    group.regionIds.add(region.id);
    group.cityNames.push(region.city);
    group.districtNames.push(region.district, region.name);
  }

  for (const property of properties.rows) {
    const key = groupKey(property.city, property.district);
    const group = ensureGroup(groups, key, property.city, property.district);
    group.propertyIds.add(property.id);
    group.cityNames.push(property.city);
    group.districtNames.push(property.district);
  }

  return groups;
}

function ensureGroup(groups, key, city, district) {
  if (!groups.has(key)) {
    groups.set(key, {
      key,
      cityNames: [city],
      districtNames: [district],
      propertyIds: new Set(),
      regionIds: new Set(),
    });
  }

  return groups.get(key);
}

async function normalizeGroups(client, groups, dryRun) {
  const summary = {
    groups: groups.size,
    canonicalRegionsCreated: 0,
    canonicalRegionsReused: 0,
    propertiesUpdated: 0,
    agentAssignmentsMoved: 0,
    regionsDeleted: 0,
    dryRun,
  };

  for (const group of groups.values()) {
    const city = canonicalCity(bestDisplay(group.cityNames, 'Unknown'));
    const district = canonicalDistrict(
      bestDisplay(group.districtNames, 'Unknown'),
      city,
    );
    const code = `district:${slugify(city)}:${slugify(district)}`.slice(0, 191);

    const existing = await client.query(
      'SELECT id FROM "Region" WHERE code = $1',
      [code],
    );

    let canonicalRegionId = existing.rows[0]?.id;
    if (dryRun) {
      canonicalRegionId = canonicalRegionId || 0;
    } else if (canonicalRegionId) {
      await client.query(
        `
          UPDATE "Region"
          SET name = $1, city = $2, district = $3, ward = NULL, "updatedAt" = NOW()
          WHERE id = $4
        `,
        [district, city, district, canonicalRegionId],
      );
      summary.canonicalRegionsReused += 1;
    } else {
      const created = await client.query(
        `
          INSERT INTO "Region" (code, name, city, district, ward, "updatedAt")
          VALUES ($1, $2, $3, $4, NULL, NOW())
          RETURNING id
        `,
        [code, district, city, district],
      );
      canonicalRegionId = created.rows[0].id;
      summary.canonicalRegionsCreated += 1;
    }

    const oldRegionIds = [...group.regionIds].filter(
      (id) => id !== canonicalRegionId,
    );
    const propertyIds = [...group.propertyIds];

    if (dryRun) {
      summary.propertiesUpdated += propertyIds.length;
      summary.regionsDeleted += oldRegionIds.length;
      continue;
    }

    if (propertyIds.length > 0) {
      const updated = await client.query(
        'UPDATE "Property" SET "regionId" = $1 WHERE id = ANY($2::int[])',
        [canonicalRegionId, propertyIds],
      );
      summary.propertiesUpdated += updated.rowCount;
    }

    if (oldRegionIds.length > 0) {
      const movedAssignments = await client.query(
        `
          INSERT INTO "AgentRegion" ("agentProfileId", "regionId")
          SELECT DISTINCT "agentProfileId", $1::int
          FROM "AgentRegion"
          WHERE "regionId" = ANY($2::int[])
          ON CONFLICT ("agentProfileId", "regionId") DO NOTHING
        `,
        [canonicalRegionId, oldRegionIds],
      );
      summary.agentAssignmentsMoved += movedAssignments.rowCount;

      await client.query(
        'DELETE FROM "AgentRegion" WHERE "regionId" = ANY($1::int[])',
        [oldRegionIds],
      );
      await client.query(
        'UPDATE "Lead" SET "regionId" = $1 WHERE "regionId" = ANY($2::int[])',
        [canonicalRegionId, oldRegionIds],
      );

      const deleted = await client.query(
        `
          DELETE FROM "Region"
          WHERE id = ANY($1::int[])
            AND NOT EXISTS (
              SELECT 1 FROM "Property" WHERE "regionId" = "Region".id
            )
            AND NOT EXISTS (
              SELECT 1 FROM "Lead" WHERE "regionId" = "Region".id
            )
            AND NOT EXISTS (
              SELECT 1 FROM "AgentRegion" WHERE "regionId" = "Region".id
            )
        `,
        [oldRegionIds],
      );
      summary.regionsDeleted += deleted.rowCount;
    }
  }

  return summary;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const groups = await getGroups(client);
    const summary = await normalizeGroups(client, groups, dryRun);

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
