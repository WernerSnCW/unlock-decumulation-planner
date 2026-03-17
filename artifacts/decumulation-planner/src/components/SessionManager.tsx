import { useState, useRef, useEffect } from 'react';
import type { SimulationInputs, Asset } from '../engine/decumulation';
import { PORTFOLIO_PRESETS } from '../data/presets';

interface Session {
  name: string;
  created: number;
  inputs: SimulationInputs;
  assets: Asset[];
}

interface SessionManagerProps {
  currentInputs: SimulationInputs;
  currentAssets: Asset[];
  onLoad: (inputs: SimulationInputs, assets: Asset[]) => void;
}

const SESSIONS_KEY = 'unlock-planner-sessions';
const ACTIVE_SESSION_KEY = 'unlock-planner-active-session';

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Session[];
  } catch { return []; }
}

function saveSessions(sessions: Session[]): void {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); }
  catch {}
}

function getActiveSessionName(): string {
  try { return localStorage.getItem(ACTIVE_SESSION_KEY) ?? ''; }
  catch { return ''; }
}

function setActiveSessionName(name: string): void {
  try { localStorage.setItem(ACTIVE_SESSION_KEY, name); }
  catch {}
}

export default function SessionManager({ currentInputs, currentAssets, onLoad }: SessionManagerProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [activeName, setActiveName] = useState(getActiveSessionName);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSave = () => {
    const name = newName.trim();
    if (!name) return;
    const existing = sessions.filter(s => s.name !== name);
    const session: Session = {
      name,
      created: Date.now(),
      inputs: { ...currentInputs },
      assets: currentAssets.map(a => ({ ...a })),
    };
    const updated = [session, ...existing];
    setSessions(updated);
    saveSessions(updated);
    setActiveName(name);
    setActiveSessionName(name);
    setNewName('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleLoad = (session: Session) => {
    onLoad(session.inputs, session.assets);
    setActiveName(session.name);
    setActiveSessionName(session.name);
    setOpen(false);
  };

  const handleLoadPreset = (preset: typeof PORTFOLIO_PRESETS[0]) => {
    const patchedInputs = {
      ...currentInputs,
      ...(preset.suggested_inputs ?? {}),
    };
    onLoad(patchedInputs, preset.assets.map(a => ({ ...a })));
    setActiveName(preset.name);
    setActiveSessionName(preset.name);
    setOpen(false);
  };

  const handleDelete = (name: string) => {
    if (confirmDelete !== name) {
      setConfirmDelete(name);
      return;
    }
    const updated = sessions.filter(s => s.name !== name);
    setSessions(updated);
    saveSessions(updated);
    setConfirmDelete(null);
    if (activeName === name) {
      setActiveName('');
      setActiveSessionName('');
    }
  };

  const handleNew = () => {
    setActiveName('');
    setActiveSessionName('');
    setOpen(false);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="session-manager" ref={panelRef}>
      <button
        className="session-btn"
        onClick={() => setOpen(!open)}
      >
        {activeName || 'Sessions'}
        <span className="session-chevron">{open ? '\u25B4' : '\u25BE'}</span>
      </button>

      {open && (
        <div className="session-dropdown">
          <div className="session-save-row">
            <input
              type="text"
              placeholder="Session name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              maxLength={40}
            />
            <button
              className={`ae-btn primary small ${saved ? 'saved' : ''}`}
              onClick={handleSave}
              disabled={!newName.trim()}
            >
              {saved ? '\u2713 Saved' : 'Save'}
            </button>
          </div>

          {PORTFOLIO_PRESETS.length > 0 && (
            <div className="session-section">
              <div className="session-section-label">Portfolio Presets</div>
              {PORTFOLIO_PRESETS.map(p => (
                <div
                  key={p.name}
                  className={`session-item preset ${activeName === p.name ? 'active' : ''}`}
                >
                  <div className="session-item-info" onClick={() => handleLoadPreset(p)}>
                    <span className="session-item-name">
                      <span className="preset-badge">PRESET</span>
                      {p.name}
                    </span>
                    <span className="session-item-meta">{p.description}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="session-section">
            {sessions.length > 0 && (
              <div className="session-section-label">Saved Sessions</div>
            )}
            <div className="session-list">
              {sessions.length === 0 && PORTFOLIO_PRESETS.length === 0 && (
                <div className="session-empty">No saved sessions yet</div>
              )}
              {sessions.map(s => (
                <div
                  key={s.name}
                  className={`session-item ${activeName === s.name ? 'active' : ''}`}
                >
                  <div className="session-item-info" onClick={() => handleLoad(s)}>
                    <span className="session-item-name">{s.name}</span>
                    <span className="session-item-meta">
                      {s.assets.length} assets &middot; {formatDate(s.created)}
                    </span>
                  </div>
                  <button
                    className={`session-delete-btn ${confirmDelete === s.name ? 'confirm' : ''}`}
                    onClick={() => handleDelete(s.name)}
                    title={confirmDelete === s.name ? 'Click again to confirm' : 'Delete session'}
                  >
                    {confirmDelete === s.name ? 'Sure?' : '\u2715'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {activeName && (
            <button className="session-new-btn" onClick={handleNew}>
              + New Session
            </button>
          )}
        </div>
      )}
    </div>
  );
}
