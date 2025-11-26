/**
 * SQLite Database for Spoolman Location Manager
 *
 * Stores the custom order of spools within each location.
 * Spoolman manages the actual location assignments; we only track order.
 *
 * NOTE: Spoolman uses location NAMES as identifiers, not numeric IDs.
 * Our database uses location_name as the primary identifier.
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "spoolman-order.db");
const DB_VERSION = 2; // Bumped to version 2 for schema change

let db = null;

/**
 * Initialize the database connection and schema
 */
export function initializeDatabase() {
  console.log(`[${new Date().toISOString()}] 📦 Initializing SQLite database...`);
  console.log(`[${new Date().toISOString()}] 📁 Database path: ${DB_PATH}`);

  try {
    // Create database connection
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL"); // Better concurrency
    db.pragma("foreign_keys = ON"); // Enable foreign key constraints

    // Check/create version table
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get current version
    const currentVersion = db.prepare("SELECT MAX(version) as version FROM schema_version").get();
    const version = currentVersion?.version || 0;

    console.log(`[${new Date().toISOString()}] 📊 Current database version: ${version}`);

    // Apply migrations if needed
    if (version < DB_VERSION) {
      applyMigrations(version);
    }

    console.log(`[${new Date().toISOString()}] ✅ Database initialized successfully`);
    return db;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Database initialization error:`, error);
    throw error;
  }
}

/**
 * Apply database migrations from current version to latest
 */
function applyMigrations(currentVersion) {
  console.log(
    `[${new Date().toISOString()}] 🔄 Applying migrations from version ${currentVersion} to ${DB_VERSION}...`,
  );

  const migrations = [
    // Migration 1: Initial schema (deprecated)
    {
      version: 1,
      up: () => {
        console.log(`[${new Date().toISOString()}] 🔨 Migration 1: Creating location_order table...`);

        db.exec(`
          CREATE TABLE IF NOT EXISTS location_order (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            spoolman_location_id INTEGER UNIQUE NOT NULL,
            ordered_spool_ids TEXT NOT NULL DEFAULT '[]',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create index for faster lookups
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_location_order_spoolman_id 
          ON location_order(spoolman_location_id)
        `);

        // Add trigger to update updated_at timestamp
        db.exec(`
          CREATE TRIGGER IF NOT EXISTS update_location_order_timestamp 
          AFTER UPDATE ON location_order
          BEGIN
            UPDATE location_order SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END
        `);

        console.log(`[${new Date().toISOString()}] ✅ Migration 1 complete`);
      },
    },
    // Migration 2: Change to location name-based schema
    {
      version: 2,
      up: () => {
        console.log(`[${new Date().toISOString()}] 🔨 Migration 2: Migrating to name-based schema...`);

        // Drop old table and recreate with new schema
        db.exec(`DROP TABLE IF EXISTS location_order`);
        db.exec(`DROP INDEX IF EXISTS idx_location_order_spoolman_id`);
        db.exec(`DROP TRIGGER IF EXISTS update_location_order_timestamp`);

        // Create new table with location_name as identifier
        db.exec(`
          CREATE TABLE location_order (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location_name TEXT UNIQUE NOT NULL,
            ordered_spool_ids TEXT NOT NULL DEFAULT '[]',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create index for faster lookups
        db.exec(`
          CREATE INDEX idx_location_order_name 
          ON location_order(location_name)
        `);

        // Add trigger to update updated_at timestamp
        db.exec(`
          CREATE TRIGGER update_location_order_timestamp 
          AFTER UPDATE ON location_order
          BEGIN
            UPDATE location_order SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END
        `);

        console.log(`[${new Date().toISOString()}] ✅ Migration 2 complete - now using location names`);
      },
    },
  ];

  // Apply each migration in sequence
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      try {
        migration.up();
        db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(migration.version);
        console.log(`[${new Date().toISOString()}] ✅ Applied migration ${migration.version}`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Migration ${migration.version} failed:`, error);
        throw error;
      }
    }
  }

  console.log(`[${new Date().toISOString()}] ✅ All migrations applied successfully`);
}

/**
 * Get the ordered spool IDs for a specific location
 * @param {string} locationName - Location name
 * @returns {number[]} Array of spool IDs in order
 */
export function getLocationOrder(locationName) {
  if (!db) throw new Error("Database not initialized");

  try {
    const row = db.prepare("SELECT ordered_spool_ids FROM location_order WHERE location_name = ?").get(locationName);

    if (!row) {
      return [];
    }

    return JSON.parse(row.ordered_spool_ids);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting location order for ${locationName}:`, error);
    return [];
  }
}

/**
 * Get all location orders
 * @returns {Object} Map of location names to ordered spool ID arrays
 */
export function getAllLocationOrders() {
  if (!db) throw new Error("Database not initialized");

  try {
    const rows = db.prepare("SELECT location_name, ordered_spool_ids FROM location_order").all();

    const result = {};
    for (const row of rows) {
      result[row.location_name] = JSON.parse(row.ordered_spool_ids);
    }

    return result;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting all location orders:`, error);
    return {};
  }
}

/**
 * Update the ordered spool IDs for a location
 * @param {string} locationName - Location name
 * @param {number[]} spoolIds - Ordered array of spool IDs
 */
export function updateLocationOrder(locationName, spoolIds) {
  if (!db) throw new Error("Database not initialized");

  try {
    const orderedSpoolIdsJson = JSON.stringify(spoolIds);

    // Upsert: insert or update if exists
    const stmt = db.prepare(`
      INSERT INTO location_order (location_name, ordered_spool_ids)
      VALUES (?, ?)
      ON CONFLICT(location_name) 
      DO UPDATE SET ordered_spool_ids = excluded.ordered_spool_ids
    `);

    stmt.run(locationName, orderedSpoolIdsJson);

    console.log(
      `[${new Date().toISOString()}] 💾 Updated order for location "${locationName}": ${spoolIds.length} spools`,
    );
    return true;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error updating location order for ${locationName}:`, error);
    throw error;
  }
}

/**
 * Delete a location's order data
 * @param {string} locationName - Location name
 */
export function deleteLocationOrder(locationName) {
  if (!db) throw new Error("Database not initialized");

  try {
    db.prepare("DELETE FROM location_order WHERE location_name = ?").run(locationName);
    console.log(`[${new Date().toISOString()}] 🗑️  Deleted order for location "${locationName}"`);
    return true;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error deleting location order for ${locationName}:`, error);
    throw error;
  }
}

/**
 * Initialize database with locations from Spoolman API
 * @param {Array<string>|Array<Object>} locations - Array of location names (strings) or location objects from Spoolman
 */
export function initializeLocationsFromSpoolman(locations) {
  if (!db) throw new Error("Database not initialized");

  console.log(
    `[${new Date().toISOString()}] 🔄 Initializing database with ${locations.length} locations from Spoolman...`,
  );

  try {
    // Get existing location names in database
    const existingNames = db.prepare("SELECT location_name FROM location_order").all();
    const existingSet = new Set(existingNames.map((row) => row.location_name));

    // Add new locations that don't exist yet
    let addedCount = 0;
    let skippedCount = 0;

    for (const location of locations) {
      // Handle both string array format and object format
      let locationName;

      if (typeof location === "string") {
        // Spoolman returns array of strings: ["Printer room", "Storage closet"]
        locationName = location;
      } else if (location && typeof location === "object" && location.name) {
        // Object format with name property: { id: 1, name: "Printer room" }
        locationName = location.name;
      } else {
        console.warn(`[${new Date().toISOString()}] ⚠️  Skipping invalid location:`, location);
        skippedCount++;
        continue;
      }

      // Validate location name
      if (!locationName || typeof locationName !== "string" || locationName.trim() === "") {
        console.warn(`[${new Date().toISOString()}] ⚠️  Skipping invalid location name:`, locationName);
        skippedCount++;
        continue;
      }

      // Add if not exists
      if (!existingSet.has(locationName)) {
        db.prepare(
          `
          INSERT INTO location_order (location_name, ordered_spool_ids)
          VALUES (?, '[]')
        `,
        ).run(locationName);
        addedCount++;
        console.log(`[${new Date().toISOString()}] ➕ Added location: "${locationName}"`);
      }
    }

    console.log(`[${new Date().toISOString()}] ✅ Added ${addedCount} new locations to database`);
    if (skippedCount > 0) {
      console.log(`[${new Date().toISOString()}] ⚠️  Skipped ${skippedCount} invalid locations`);
    }

    return addedCount;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error initializing locations:`, error);
    throw error;
  }
}

/**
 * Clean up orders for locations that no longer exist in Spoolman
 * @param {string[]} validLocationNames - Array of valid location names
 */
export function cleanupDeletedLocations(validLocationNames) {
  if (!db) throw new Error("Database not initialized");

  try {
    const placeholders = validLocationNames.map(() => "?").join(",");
    const result = db
      .prepare(`DELETE FROM location_order WHERE location_name NOT IN (${placeholders})`)
      .run(...validLocationNames);

    if (result.changes > 0) {
      console.log(`[${new Date().toISOString()}] 🗑️  Cleaned up ${result.changes} deleted locations`);
    }

    return result.changes;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error cleaning up deleted locations:`, error);
    throw error;
  }
}

/**
 * Close the database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    console.log(`[${new Date().toISOString()}] 🔒 Database connection closed`);
  }
}

/**
 * Get database statistics
 * @returns {Object} Database statistics
 */
export function getDatabaseStats() {
  if (!db) throw new Error("Database not initialized");

  try {
    const locationCount = db.prepare("SELECT COUNT(*) as count FROM location_order").get();
    const fileSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
    const version = db.prepare("SELECT MAX(version) as version FROM schema_version").get();

    return {
      locationCount: locationCount.count,
      fileSizeBytes: fileSize,
      fileSizeKB: (fileSize / 1024).toFixed(2),
      version: version.version,
      path: DB_PATH,
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting database stats:`, error);
    return null;
  }
}

export default {
  initializeDatabase,
  getLocationOrder,
  getAllLocationOrders,
  updateLocationOrder,
  deleteLocationOrder,
  initializeLocationsFromSpoolman,
  cleanupDeletedLocations,
  closeDatabase,
  getDatabaseStats,
};
