import { useState } from 'react';

type View = 'candidate' | 'coach';

export function App() {
  const [view, setView] = useState<View>('candidate');

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Leadership Assessment Coaching</p>
          <h1>{view === 'candidate' ? 'Assessment' : 'Coach Workspace'}</h1>
        </div>
        <nav aria-label="Ansicht wählen" className="view-switcher">
          <button aria-pressed={view === 'candidate'} onClick={() => setView('candidate')}>Kandidat</button>
          <button aria-pressed={view === 'coach'} onClick={() => setView('coach')}>Coach</button>
        </nav>
      </header>

      {view === 'candidate' ? <CandidateShell /> : <CoachShell />}
    </main>
  );
}

function CandidateShell() {
  return (
    <section className="card candidate-card" aria-labelledby="candidate-title">
      <div className="status-row">
        <span className="pill">Baseline</span>
        <span>Runde 1</span>
      </div>
      <h2 id="candidate-title">Priorisierung unter Führungsdruck</h2>
      <p className="lede">Die Aufgabenstellung ist noch gesperrt. Die serverseitige Zeitmessung beginnt erst, wenn du die Aufgabe ausdrücklich freischaltest.</p>
      <div className="locked-panel">
        <strong>Aufgabe gesperrt</strong>
        <p>Nach Freischaltung kann die Zeit nicht durch Neuladen oder Schließen des Browsers pausiert werden.</p>
        <button className="primary" disabled title="API wird im nächsten Vertikalschnitt verbunden">Aufgabe freischalten</button>
      </div>
    </section>
  );
}

function CoachShell() {
  const dimensions = [
    ['Kommunikation', '—'],
    ['Führung & Zusammenarbeit', '—'],
    ['Analyse & Entscheidung', '—'],
    ['Verantwortung', '—'],
    ['Veränderung & Innovation', '—'],
    ['Selbstmanagement', '—'],
    ['Reflexion', '—']
  ];

  return (
    <section className="workspace-grid">
      <article className="card">
        <p className="eyebrow">Session</p>
        <h2>PES / SGL Baseline</h2>
        <dl className="facts">
          <div><dt>Status</dt><dd>Entwurf</dd></div>
          <div><dt>Timing</dt><dd>server-authoritativ</dd></div>
          <div><dt>Assessment</dt><dd>noch keine Evidenz</dd></div>
        </dl>
      </article>
      <article className="card">
        <p className="eyebrow">Scorecard</p>
        <h2>Entwicklungsdimensionen</h2>
        <ul className="score-list">
          {dimensions.map(([name, score]) => <li key={name}><span>{name}</span><strong>{score}</strong></li>)}
        </ul>
      </article>
    </section>
  );
}
