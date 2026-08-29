import { useEffect, useMemo, useState } from 'react';

type View = 'candidate' | 'coach';
type RoundState = {
  roundId: string;
  status: 'locked' | 'active' | 'completed';
  title: string;
  purpose?: string;
  timeLimitSeconds?: number | null;
  unlockedAt?: string | null;
  completedAt?: string | null;
  elapsedMs?: number | null;
  round?: { questions?: Array<{ id: string; prompt: string; required?: boolean }> };
};

type SessionState = {
  sessionId: string;
  mode: string;
  round: RoundState;
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export function App() {
  const [view, setView] = useState<View>('candidate');
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Leadership Coaching</p>
          <h1>{view === 'candidate' ? 'Assessment' : 'Coach Workspace'}</h1>
        </div>
        <nav aria-label="Ansicht wählen" className="view-switcher">
          <button aria-pressed={view === 'candidate'} onClick={() => setView('candidate')}>Kandidat</button>
          <button aria-pressed={view === 'coach'} onClick={() => setView('coach')}>Coach</button>
        </nav>
      </header>
      {view === 'candidate' ? <CandidateFlow /> : <CoachShell />}
    </main>
  );
}

function CandidateFlow() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<any>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (round?.status !== 'active') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [round?.status]);

  const elapsedSeconds = useMemo(() => {
    if (!round?.unlockedAt) return 0;
    return Math.max(0, Math.floor((now - new Date(round.unlockedAt).getTime()) / 1000));
  }, [now, round?.unlockedAt]);
  const remaining = round?.timeLimitSeconds ? Math.max(0, round.timeLimitSeconds - elapsedSeconds) : null;

  async function startSession() {
    setError(null);
    try {
      const created = await api<SessionState>('/api/v1/sessions', {
        method: 'POST',
        body: JSON.stringify({ definitionId: 'pes-sgl-sh', subjectRef: 'local-test', mode: 'baseline', label: 'PES / SGL Local Test' })
      });
      setSession(created);
      setRound(created.round);
      setHandoff(null);
      setAnswer('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  async function unlock() {
    if (!session || !round) return;
    setError(null);
    try {
      const active = await api<RoundState>(`/api/v1/sessions/${session.sessionId}/rounds/${round.roundId}/unlock`, { method: 'POST' });
      setRound(active);
      setNow(Date.now());
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  async function complete() {
    if (!session || !round) return;
    const questionId = round.round?.questions?.[0]?.id;
    if (!questionId) return;
    setError(null);
    try {
      await api(`/api/v1/sessions/${session.sessionId}/answers`, {
        method: 'POST',
        body: JSON.stringify({ answers: [{ questionId, value: answer }] })
      });
      const result = await api<any>(`/api/v1/sessions/${session.sessionId}/rounds/${round.roundId}/complete`, { method: 'POST' });
      setHandoff(result);
      setRound({ ...round, status: 'completed', completedAt: result.handoff.timing.completedAt, elapsedMs: result.handoff.timing.elapsedMs });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  if (!session || !round) {
    return (
      <section className="card candidate-card">
        <div className="status-row"><span className="pill">PES / SGL</span><span>Lokaler Test</span></div>
        <h2>Baseline-Session starten</h2>
        <p className="lede">Die Session wird in PostgreSQL angelegt. Runde 1 bleibt zunächst gesperrt; die Bearbeitungszeit beginnt erst beim Freischalten.</p>
        <button className="primary" onClick={startSession}>Neue Test-Session</button>
        {error && <p role="alert">Fehler: {error}</p>}
      </section>
    );
  }

  return (
    <section className="card candidate-card" aria-labelledby="candidate-title">
      <div className="status-row">
        <span className="pill">Baseline</span>
        <span>{round.status === 'locked' ? 'gesperrt' : round.status === 'active' ? 'läuft' : 'abgeschlossen'}</span>
        {remaining !== null && round.status === 'active' && <strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong>}
      </div>
      <h2 id="candidate-title">{round.title}</h2>

      {round.status === 'locked' && (
        <div className="locked-panel">
          <strong>Aufgabe gesperrt</strong>
          <p>Die Aufgabenstellung wird erst beim Freischalten ausgeliefert. Ab dann läuft die serverseitige Zeitmessung auch bei Reload oder geschlossenem Browser weiter.</p>
          <button className="primary" onClick={unlock}>Aufgabe freischalten</button>
        </div>
      )}

      {round.status === 'active' && (
        <div>
          <p className="lede">{round.round?.questions?.[0]?.prompt}</p>
          <label>
            <strong>Antwort</strong>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={12} style={{ width: '100%', marginTop: 8 }} />
          </label>
          <p>Bearbeitungszeit: {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}</p>
          <button className="primary" onClick={complete}>Antwort speichern und abschließen</button>
        </div>
      )}

      {round.status === 'completed' && (
        <div className="locked-panel">
          <strong>Runde abgeschlossen</strong>
          <p>Serverseitig gemessene Bearbeitungszeit: {Math.round((round.elapsedMs || 0) / 1000)} Sekunden.</p>
          {handoff && <details><summary>Raw Handoff anzeigen</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(handoff, null, 2)}</pre></details>}
          <button onClick={startSession}>Neue Test-Session</button>
        </div>
      )}
      {error && <p role="alert">Fehler: {error}</p>}
    </section>
  );
}

function CoachShell() {
  const dimensions = [
    ['Kommunikation', '—'], ['Führung & Zusammenarbeit', '—'], ['Analyse & Entscheidung', '—'],
    ['Verantwortung', '—'], ['Veränderung & Innovation', '—'], ['Selbstmanagement', '—'], ['Reflexion', '—']
  ];
  return (
    <section className="workspace-grid">
      <article className="card">
        <p className="eyebrow">MVP</p><h2>PES / SGL Coaching</h2>
        <dl className="facts">
          <div><dt>Runtime</dt><dd>PostgreSQL</dd></div>
          <div><dt>Timing</dt><dd>server-authoritativ</dd></div>
          <div><dt>LLM</dt><dd>manuelles Prompting</dd></div>
        </dl>
      </article>
      <article className="card">
        <p className="eyebrow">Scorecard</p><h2>Entwicklungsdimensionen</h2>
        <ul className="score-list">{dimensions.map(([name, score]) => <li key={name}><span>{name}</span><strong>{score}</strong></li>)}</ul>
      </article>
    </section>
  );
}
