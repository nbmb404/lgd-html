import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSession,
  deleteSession,
  endSession,
  ensureVisitor,
  getPreferences,
  getStats,
  isObjectType,
  isParticleLevel,
  listSessions,
  savePreferences,
  saveSessionProgress,
  type ObjectProgress,
  type PreferenceRecord
} from "./db.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const cookieName = "wajangchang_visitor";

app.use(express.json({ limit: "256kb" }));

app.use("/api", (request, response, next) => {
  const visitorId = getOrCreateVisitorId(request.headers.cookie);
  ensureVisitor(visitorId);
  response.cookie(cookieName, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 365
  });
  response.locals.visitorId = visitorId;
  next();
});

app.post("/api/visitors", (_request, response) => {
  const visitorId = response.locals.visitorId as string;

  response.json({
    visitorId,
    preferences: getPreferences(visitorId),
    stats: getStats(visitorId)
  });
});

app.get("/api/preferences", (_request, response) => {
  response.json(getPreferences(response.locals.visitorId));
});

app.put("/api/preferences", (request, response) => {
  const parsed = parsePreferences(request.body);

  if (!parsed.ok) {
    response.status(400).json({ message: parsed.message });
    return;
  }

  savePreferences(response.locals.visitorId, parsed.preferences);
  response.json(getPreferences(response.locals.visitorId));
});

app.post("/api/sessions", (_request, response) => {
  response.status(201).json({ id: createSession(response.locals.visitorId) });
});

app.put("/api/sessions/:id/progress", (request, response) => {
  const parsed = parseProgress(request.body);

  if (!parsed.ok) {
    response.status(400).json({ message: parsed.message });
    return;
  }

  const saved = saveSessionProgress(
    response.locals.visitorId,
    request.params.id,
    parsed.activeSeconds,
    parsed.objects
  );

  if (!saved) {
    response.status(404).json({ message: "세션을 찾을 수 없습니다." });
    return;
  }

  response.json({ stats: getStats(response.locals.visitorId) });
});

app.post("/api/sessions/:id/end", (request, response) => {
  const parsed = parseProgress(request.body);

  if (!parsed.ok) {
    response.status(400).json({ message: parsed.message });
    return;
  }

  const saved = endSession(response.locals.visitorId, request.params.id, parsed.activeSeconds, parsed.objects);

  if (!saved) {
    response.status(404).json({ message: "세션을 찾을 수 없습니다." });
    return;
  }

  response.json({ stats: getStats(response.locals.visitorId) });
});

app.get("/api/sessions", (_request, response) => {
  response.json({
    sessions: listSessions(response.locals.visitorId),
    stats: getStats(response.locals.visitorId)
  });
});

app.delete("/api/sessions/:id", (request, response) => {
  const deleted = deleteSession(response.locals.visitorId, request.params.id);

  if (!deleted) {
    response.status(404).json({ message: "삭제할 기록을 찾을 수 없습니다." });
    return;
  }

  response.status(204).end();
});

const dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(dirname, "../../dist");
app.use(express.static(distPath));
app.get(/^\/(?!api).*/, (_request, response) => {
  response.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Wajangchang API is running on http://127.0.0.1:${port}`);
});

function getOrCreateVisitorId(cookieHeader: string | undefined) {
  const cookies = new Map<string, string>(
    (cookieHeader ?? "")
      .split(";")
      .map((cookie): [string, string] | null => {
        const [key, value] = cookie.trim().split("=");
        return key && value ? [key, value] : null;
      })
      .filter((cookie): cookie is [string, string] => cookie !== null)
  );

  return cookies.get(cookieName) ?? crypto.randomUUID();
}

function parsePreferences(body: unknown):
  | { ok: true; preferences: PreferenceRecord }
  | { ok: false; message: string } {
  if (!isRecord(body)) {
    return { ok: false, message: "설정 형식이 올바르지 않습니다." };
  }

  const volume = Number(body.volume);
  const muted = body.muted === true;
  const screenShake = body.screenShake !== false;
  const particleLevel = body.particleLevel;

  if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
    return { ok: false, message: "볼륨은 0부터 100 사이의 정수여야 합니다." };
  }

  if (!isParticleLevel(particleLevel)) {
    return { ok: false, message: "파편 효과 값이 올바르지 않습니다." };
  }

  return {
    ok: true,
    preferences: { volume, muted, screenShake, particleLevel }
  };
}

function parseProgress(body: unknown):
  | { ok: true; activeSeconds: number; objects: ObjectProgress[] }
  | { ok: false; message: string } {
  if (!isRecord(body) || !Array.isArray(body.objects)) {
    return { ok: false, message: "진행 기록 형식이 올바르지 않습니다." };
  }

  const activeSeconds = Number(body.activeSeconds);

  if (!Number.isInteger(activeSeconds) || activeSeconds < 0 || activeSeconds > 60 * 60 * 24) {
    return { ok: false, message: "이용 시간 값이 올바르지 않습니다." };
  }

  const objects: ObjectProgress[] = [];

  for (const item of body.objects) {
    if (!isRecord(item) || !isObjectType(item.objectType)) {
      return { ok: false, message: "물건 종류가 올바르지 않습니다." };
    }

    const hitCount = Number(item.hitCount);
    const destroyedCount = Number(item.destroyedCount);

    if (!Number.isInteger(hitCount) || hitCount < 0 || !Number.isInteger(destroyedCount) || destroyedCount < 0) {
      return { ok: false, message: "타격 또는 파괴 횟수 값이 올바르지 않습니다." };
    }

    objects.push({ objectType: item.objectType, hitCount, destroyedCount });
  }

  return { ok: true, activeSeconds, objects };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
