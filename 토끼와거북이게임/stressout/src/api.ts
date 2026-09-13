export type ObjectType = "window" | "keyboard" | "wood" | "paper" | "can" | "tree";
export type ParticleLevel = "low" | "normal" | "high";

export interface Preferences {
  volume: number;
  muted: boolean;
  screenShake: boolean;
  particleLevel: ParticleLevel;
}

export interface Stats {
  destroyed: number;
  endorphins: number;
}

export interface ObjectProgress {
  objectType: ObjectType;
  hitCount: number;
  destroyedCount: number;
}

export interface PlaySession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  activeSeconds: number;
  hitCount: number;
  destroyedCount: number;
  objectSummary: string | null;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "요청에 실패했습니다." }));
    throw new Error(body.message ?? "요청에 실패했습니다.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function initVisitor() {
  return request<{ visitorId: string; preferences: Preferences; stats: Stats }>("/api/visitors", {
    method: "POST"
  });
}

export function savePreferences(preferences: Preferences) {
  return request<Preferences>("/api/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences)
  });
}

export function startSession() {
  return request<{ id: string }>("/api/sessions", { method: "POST" });
}

export function saveProgress(sessionId: string, activeSeconds: number, objects: ObjectProgress[]) {
  return request<{ stats: Stats }>(`/api/sessions/${sessionId}/progress`, {
    method: "PUT",
    body: JSON.stringify({ activeSeconds, objects })
  });
}

export function endSession(sessionId: string, activeSeconds: number, objects: ObjectProgress[]) {
  return request<{ stats: Stats }>(`/api/sessions/${sessionId}/end`, {
    method: "POST",
    body: JSON.stringify({ activeSeconds, objects })
  });
}

export function loadSessions() {
  return request<{ sessions: PlaySession[]; stats: Stats }>("/api/sessions");
}

export function deleteSession(id: string) {
  return request<void>(`/api/sessions/${id}`, { method: "DELETE" });
}
