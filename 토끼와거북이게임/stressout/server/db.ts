import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type ObjectType =
  | "window"
  | "cup"
  | "plank"
  | "paper"
  | "laptop"
  | "plate"
  | "keyboard"
  | "monitor"
  | "can"
  | "bubble"
  | "balloon"
  | "ice"
  | "wall"
  | "box"
  | "pencils"
  | "cookie"
  | "jelly";
export type ParticleLevel = "low" | "normal" | "high";

export interface PreferenceRecord {
  volume: number;
  muted: boolean;
  screenShake: boolean;
  particleLevel: ParticleLevel;
}

export interface ObjectProgress {
  objectType: ObjectType;
  hitCount: number;
  destroyedCount: number;
}

const dataDir = path.resolve(process.cwd(), "data");

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(path.join(dataDir, "stressout.sqlite"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS visitors (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS preferences (
    visitor_id TEXT PRIMARY KEY REFERENCES visitors(id) ON DELETE CASCADE,
    volume INTEGER NOT NULL DEFAULT 70,
    muted INTEGER NOT NULL DEFAULT 0,
    screen_shake INTEGER NOT NULL DEFAULT 1,
    particle_level TEXT NOT NULL DEFAULT 'normal',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS play_sessions (
    id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT,
    active_seconds INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS session_objects (
    session_id TEXT NOT NULL REFERENCES play_sessions(id) ON DELETE CASCADE,
    object_type TEXT NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 0,
    destroyed_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, object_type)
  );
`);

const allowedObjects = new Set<ObjectType>([
  "window",
  "cup",
  "plank",
  "paper",
  "laptop",
  "plate",
  "keyboard",
  "monitor",
  "can",
  "bubble",
  "balloon",
  "ice",
  "wall",
  "box",
  "pencils",
  "cookie",
  "jelly"
]);
const allowedParticleLevels = new Set<ParticleLevel>(["low", "normal", "high"]);

export function isObjectType(value: unknown): value is ObjectType {
  return typeof value === "string" && allowedObjects.has(value as ObjectType);
}

export function isParticleLevel(value: unknown): value is ParticleLevel {
  return typeof value === "string" && allowedParticleLevels.has(value as ParticleLevel);
}

export function ensureVisitor(visitorId: string) {
  db.prepare("INSERT OR IGNORE INTO visitors (id) VALUES (?)").run(visitorId);
  db.prepare("INSERT OR IGNORE INTO preferences (visitor_id) VALUES (?)").run(visitorId);
}

export function getPreferences(visitorId: string): PreferenceRecord {
  const row = db
    .prepare("SELECT volume, muted, screen_shake, particle_level FROM preferences WHERE visitor_id = ?")
    .get(visitorId) as {
    volume: number;
    muted: number;
    screen_shake: number;
    particle_level: ParticleLevel;
  };

  return {
    volume: row.volume,
    muted: Boolean(row.muted),
    screenShake: Boolean(row.screen_shake),
    particleLevel: row.particle_level
  };
}

export function savePreferences(visitorId: string, preferences: PreferenceRecord) {
  db.prepare(`
    UPDATE preferences
       SET volume = ?, muted = ?, screen_shake = ?, particle_level = ?, updated_at = CURRENT_TIMESTAMP
     WHERE visitor_id = ?
  `).run(
    preferences.volume,
    preferences.muted ? 1 : 0,
    preferences.screenShake ? 1 : 0,
    preferences.particleLevel,
    visitorId
  );
}

export function createSession(visitorId: string) {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO play_sessions (id, visitor_id) VALUES (?, ?)").run(id, visitorId);
  return id;
}

export function saveSessionProgress(
  visitorId: string,
  sessionId: string,
  activeSeconds: number,
  objects: ObjectProgress[]
) {
  const session = db
    .prepare("SELECT id FROM play_sessions WHERE id = ? AND visitor_id = ?")
    .get(sessionId, visitorId);

  if (!session) {
    return false;
  }

  const updateSession = db.prepare(`
    UPDATE play_sessions
       SET active_seconds = ?, last_saved_at = CURRENT_TIMESTAMP
     WHERE id = ? AND visitor_id = ?
  `);
  const upsertObject = db.prepare(`
    INSERT INTO session_objects (session_id, object_type, hit_count, destroyed_count)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(session_id, object_type) DO UPDATE SET
      hit_count = excluded.hit_count,
      destroyed_count = excluded.destroyed_count
  `);

  try {
    db.exec("BEGIN");
    updateSession.run(activeSeconds, sessionId, visitorId);
    for (const object of objects) {
      upsertObject.run(sessionId, object.objectType, object.hitCount, object.destroyedCount);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return true;
}

export function endSession(
  visitorId: string,
  sessionId: string,
  activeSeconds: number,
  objects: ObjectProgress[]
) {
  const saved = saveSessionProgress(visitorId, sessionId, activeSeconds, objects);

  if (!saved) {
    return false;
  }

  db.prepare(`
    UPDATE play_sessions
       SET ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP), last_saved_at = CURRENT_TIMESTAMP
     WHERE id = ? AND visitor_id = ?
  `).run(sessionId, visitorId);

  return true;
}

export function getStats(visitorId: string) {
  const row = db
    .prepare(`
      SELECT COALESCE(SUM(so.destroyed_count), 0) AS destroyed
        FROM play_sessions ps
        LEFT JOIN session_objects so ON so.session_id = ps.id
       WHERE ps.visitor_id = ?
    `)
    .get(visitorId) as { destroyed: number };

  const destroyed = Number(row.destroyed);

  return {
    destroyed,
    endorphins: destroyed * 10
  };
}

export function listSessions(visitorId: string) {
  return db
    .prepare(`
      SELECT
        ps.id,
        ps.started_at AS startedAt,
        ps.ended_at AS endedAt,
        ps.active_seconds AS activeSeconds,
        COALESCE(SUM(so.hit_count), 0) AS hitCount,
        COALESCE(SUM(so.destroyed_count), 0) AS destroyedCount,
        GROUP_CONCAT(so.object_type || ':' || so.destroyed_count, ',') AS objectSummary
      FROM play_sessions ps
      LEFT JOIN session_objects so ON so.session_id = ps.id
      WHERE ps.visitor_id = ?
      GROUP BY ps.id
      ORDER BY ps.started_at DESC
      LIMIT 30
    `)
    .all(visitorId);
}

export function deleteSession(visitorId: string, sessionId: string) {
  const result = db
    .prepare("DELETE FROM play_sessions WHERE id = ? AND visitor_id = ?")
    .run(sessionId, visitorId);

  return result.changes > 0;
}
