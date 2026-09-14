import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteSession,
  endSession,
  initVisitor,
  loadSessions,
  savePreferences,
  saveProgress,
  startSession,
  type ObjectProgress,
  type ObjectType,
  type ParticleLevel,
  type PlaySession,
  type Preferences,
  type Stats
} from "./api";
import GameCanvas from "./GameCanvas";
import { objects } from "./game";

const defaultPreferences: Preferences = {
  volume: 70,
  muted: false,
  screenShake: true,
  particleLevel: "normal"
};

const initialStats: Stats = {
  destroyed: 0,
  endorphins: 0
};

type Screen = "start" | "game" | "records";

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [stats, setStats] = useState(initialStats);
  const [selectedObject, setSelectedObject] = useState<ObjectType>("window");
  const [canvasKey, setCanvasKey] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [progress, setProgress] = useState<Record<ObjectType, ObjectProgress>>(createProgress());
  const [records, setRecords] = useState<PlaySession[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("계속 눌러도 멈추지 않아요");
  const savingRef = useRef(false);

  useEffect(() => {
    initVisitor()
      .then((data) => {
        setPreferences(data.preferences);
        setStats(data.stats);
      })
      .catch(() => setStatusMessage("서버 연결을 확인해주세요"));
  }, []);

  const activeSeconds = useCallback(() => {
    if (!sessionStartedAt) {
      return 0;
    }

    return Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000));
  }, [sessionStartedAt]);

  const progressList = useMemo(() => Object.values(progress), [progress]);

  const flushProgress = useCallback(async () => {
    if (!sessionId || savingRef.current) {
      return;
    }

    savingRef.current = true;
    try {
      const result = await saveProgress(sessionId, activeSeconds(), Object.values(progress));
      setStats(result.stats);
    } catch {
      setStatusMessage("저장은 잠시 실패했지만 게임은 계속할 수 있어요");
    } finally {
      savingRef.current = false;
    }
  }, [activeSeconds, progress, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const timer = window.setInterval(() => {
      void flushProgress();
    }, 8000);

    return () => window.clearInterval(timer);
  }, [flushProgress, sessionId]);

  const begin = async () => {
    try {
      const session = await startSession();
      setProgress(createProgress());
      setSessionId(session.id);
      setSessionStartedAt(Date.now());
      setCanvasKey((key) => key + 1);
      setScreen("game");
      setStatusMessage("클릭하거나 드래그하면 계속 부서져요");
    } catch {
      setStatusMessage("세션 시작에 실패했습니다");
    }
  };

  const leaveGame = async () => {
    if (sessionId) {
      try {
        const result = await endSession(sessionId, activeSeconds(), progressList);
        setStats(result.stats);
      } catch {
        setStatusMessage("종료 저장에 실패했습니다");
      }
    }

    setSessionId(null);
    setSessionStartedAt(null);
    setScreen("start");
  };

  const updatePreferences = async (next: Preferences) => {
    setPreferences(next);
    try {
      setPreferences(await savePreferences(next));
    } catch {
      setStatusMessage("설정 저장에 실패했습니다");
    }
  };

  const registerHit = (type: ObjectType) => {
    setProgress((current) => ({
      ...current,
      [type]: {
        ...current[type],
        hitCount: current[type].hitCount + 1
      }
    }));
  };

  const registerDestroyed = (type: ObjectType) => {
    setProgress((current) => ({
      ...current,
      [type]: {
        ...current[type],
        destroyedCount: current[type].destroyedCount + 1
      }
    }));
    setStats((current) => ({
      destroyed: current.destroyed + 1,
      endorphins: current.endorphins + 10
    }));
    setStatusMessage("엔돌핀 +10");
  };

  const refill = () => {
    setCanvasKey((key) => key + 1);
    setStatusMessage("파편을 정리했어요");
  };

  const openRecords = async () => {
    try {
      const data = await loadSessions();
      setRecords(data.sessions);
      setStats(data.stats);
      setScreen("records");
    } catch {
      setStatusMessage("기록을 불러오지 못했습니다");
    }
  };

  const removeRecord = async (id: string) => {
    await deleteSession(id);
    const data = await loadSessions();
    setRecords(data.sessions);
    setStats(data.stats);
  };

  return (
    <main className="app-shell">
      {screen === "start" && (
        <section className="start-screen">
          <div className="brand-block">
            <p className="eyebrow">스트레스 전환용 파괴 공간</p>
            <h1>와장창</h1>
            <p>오늘 쌓인 기분, 여기서 와장창.</p>
          </div>

          <div className="start-actions">
            <button className="primary-button" onClick={begin}>마음껏 부수기</button>
            <button className="ghost-button" onClick={openRecords}>이용 기록 보기</button>
          </div>

          <div className="stat-strip">
            <strong>쌓인 엔돌핀 {stats.endorphins.toLocaleString()}</strong>
            <span>지금까지 부순 물건 {stats.destroyed.toLocaleString()}개</span>
          </div>
        </section>
      )}

      {screen === "game" && (
        <section className="game-screen">
          <header className="topbar">
            <button className="logo-button" onClick={leaveGame}>와장창</button>
            <div className="top-stats">
              <strong>엔돌핀 {stats.endorphins.toLocaleString()}</strong>
              <span>{stats.destroyed.toLocaleString()}개 부숨</span>
            </div>
            <div className="top-actions">
              <button onClick={() => updatePreferences({ ...preferences, muted: !preferences.muted })}>
                {preferences.muted ? "소리 켜기" : "음소거"}
              </button>
              <button onClick={() => setSettingsOpen((value) => !value)}>설정</button>
              <button onClick={leaveGame}>나가기</button>
            </div>
          </header>

          <div className="playfield">
            <GameCanvas
              key={`${selectedObject}-${canvasKey}`}
              objectType={selectedObject}
              muted={preferences.muted}
              volume={preferences.volume}
              screenShake={preferences.screenShake}
              particleLevel={preferences.particleLevel}
              onHit={registerHit}
              onDestroyed={registerDestroyed}
            />
            <div className="floating-hint">{statusMessage}</div>
          </div>

          <footer className="object-bar">
            <div className="object-tabs">
              {objects.map((object) => (
                <button
                  key={object.type}
                  className={selectedObject === object.type ? "selected" : ""}
                  onClick={() => {
                    setSelectedObject(object.type);
                    setCanvasKey((key) => key + 1);
                    setStatusMessage(object.action);
                  }}
                >
                  <span>{object.label}</span>
                  <small>{object.action}</small>
                </button>
              ))}
            </div>
            <button className="refill-button" onClick={refill}>파편 정리</button>
          </footer>

          {settingsOpen && (
            <aside className="settings-panel">
              <h2>설정</h2>
              <label>
                <span>전체 볼륨</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={preferences.volume}
                  onChange={(event) =>
                    updatePreferences({ ...preferences, volume: Number(event.currentTarget.value) })
                  }
                />
              </label>
              <label className="toggle-row">
                <span>음소거</span>
                <input
                  type="checkbox"
                  checked={preferences.muted}
                  onChange={(event) => updatePreferences({ ...preferences, muted: event.currentTarget.checked })}
                />
              </label>
              <label className="toggle-row">
                <span>화면 흔들림</span>
                <input
                  type="checkbox"
                  checked={preferences.screenShake}
                  onChange={(event) =>
                    updatePreferences({ ...preferences, screenShake: event.currentTarget.checked })
                  }
                />
              </label>
              <div className="segmented">
                {(["low", "normal", "high"] as ParticleLevel[]).map((level) => (
                  <button
                    key={level}
                    className={preferences.particleLevel === level ? "selected" : ""}
                    onClick={() => updatePreferences({ ...preferences, particleLevel: level })}
                  >
                    {level === "low" ? "적게" : level === "normal" ? "보통" : "많이"}
                  </button>
                ))}
              </div>
            </aside>
          )}
        </section>
      )}

      {screen === "records" && (
        <section className="records-screen">
          <header className="records-header">
            <div>
              <p className="eyebrow">내 브라우저 이용 이력</p>
              <h1>이용 기록</h1>
            </div>
            <button className="ghost-button" onClick={() => setScreen("start")}>돌아가기</button>
          </header>

          <div className="stat-strip">
            <strong>누적 엔돌핀 {stats.endorphins.toLocaleString()}</strong>
            <span>총 {stats.destroyed.toLocaleString()}개 부숨</span>
          </div>

          <div className="record-list">
            {records.length === 0 && <p className="empty-state">아직 저장된 이용 기록이 없습니다.</p>}
            {records.map((record) => (
              <article className="record-card" key={record.id}>
                <div>
                  <strong>{formatDate(record.startedAt)}</strong>
                  <p>
                    {formatDuration(record.activeSeconds)} · {Number(record.destroyedCount).toLocaleString()}개 부숨 ·
                    엔돌핀 +{(Number(record.destroyedCount) * 10).toLocaleString()}
                  </p>
                  <small>{formatSummary(record.objectSummary)}</small>
                </div>
                <button onClick={() => removeRecord(record.id)}>삭제</button>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function createProgress(): Record<ObjectType, ObjectProgress> {
  return Object.fromEntries(
    objects.map((object) => [
      object.type,
      {
        objectType: object.type,
        hitCount: 0,
        destroyedCount: 0
      }
    ])
  ) as Record<ObjectType, ObjectProgress>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds}초`;
  }

  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

function formatSummary(summary: string | null) {
  if (!summary) {
    return "사용한 물건 기록 없음";
  }

  const names: Record<string, string> = {
    window: "유리창",
    keyboard: "키보드",
    wood: "나무판자",
    paper: "종이",
    can: "캔",
    tree: "나무"
  };

  return summary
    .split(",")
    .map((item) => {
      const [type, count] = item.split(":");
      return `${names[type] ?? type} ${count}개`;
    })
    .join(" · ");
}
