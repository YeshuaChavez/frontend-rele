import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://backend-rele-production.up.railway.app';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@400;600;700;800&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #03050d;
    --surface: #080d1a;
    --surface2: #0d1526;
    --border: rgba(99,179,237,0.12);
    --text: #e2e8f0;
    --muted: #4a5568;
    --accent: #63b3ed;
    --green: #68d391;
    --red: #fc8181;
    --yellow: #f6e05e;
    --purple: #b794f4;
    --pink: #f687b3;
  }

  body { background: var(--bg); }

  .app {
    min-height: 100vh;
    background: var(--bg);
    padding: 1rem;
    font-family: 'Syne', sans-serif;
    color: var(--text);
    max-width: 1200px;
    margin: 0 auto;
  }

  /* HEADER */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.25rem 1.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-title h1 {
    font-size: clamp(1.2rem, 4vw, 1.8rem);
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.5px;
    line-height: 1.2;
  }

  .header-title p {
    font-size: 0.8rem;
    color: var(--muted);
    margin-top: 0.25rem;
    font-family: 'JetBrains Mono', monospace;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .btn-csv {
    padding: 0.6rem 1.1rem;
    font-size: 0.8rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    transition: transform 0.15s, opacity 0.15s;
    white-space: nowrap;
  }

  .btn-csv:hover:not(:disabled) { transform: translateY(-2px); }
  .btn-csv:disabled { opacity: 0.5; cursor: not-allowed; }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem;
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 1px;
    white-space: nowrap;
  }

  .status-badge.online {
    background: rgba(104,211,145,0.1);
    border: 1px solid rgba(104,211,145,0.3);
    color: var(--green);
  }

  .status-badge.offline {
    background: rgba(252,129,129,0.1);
    border: 1px solid rgba(252,129,129,0.3);
    color: var(--red);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  /* MAIN GRID */
  .main-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  @media (max-width: 640px) {
    .main-grid { grid-template-columns: 1fr; }
  }

  /* LIGHT STATUS CARD */
  .light-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .card-label {
    font-size: 0.65rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 2px;
    font-family: 'JetBrains Mono', monospace;
  }

  .light-display {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .light-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.8rem;
    flex-shrink: 0;
    transition: all 0.3s;
  }

  .light-icon.on {
    background: linear-gradient(135deg, #f6e05e, #ed8936);
    box-shadow: 0 0 24px rgba(246,224,94,0.4);
  }

  .light-icon.off {
    background: rgba(255,255,255,0.04);
  }

  .light-state {
    font-size: 2.2rem;
    font-weight: 800;
    line-height: 1;
    transition: color 0.3s;
  }

  .light-state.on { color: var(--yellow); }
  .light-state.off { color: var(--muted); }

  .light-mode {
    font-size: 0.75rem;
    color: var(--muted);
    font-family: 'JetBrains Mono', monospace;
    margin-top: 0.2rem;
  }

  /* CONTROLS CARD */
  .controls-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .controls-grid {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .ctrl-btn {
    padding: 0.85rem 1rem;
    font-size: 0.9rem;
    font-weight: 700;
    font-family: 'Syne', sans-serif;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: transform 0.15s, opacity 0.15s;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .ctrl-btn:hover:not(:disabled) { transform: translateY(-2px); }
  .ctrl-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .ctrl-btn.green {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    box-shadow: 0 4px 12px rgba(34,197,94,0.25);
  }

  .ctrl-btn.red {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    box-shadow: 0 4px 12px rgba(239,68,68,0.25);
  }

  .ctrl-btn.blue {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    box-shadow: 0 4px 12px rgba(59,130,246,0.25);
  }

  .ctrl-btn.gray {
    background: linear-gradient(135deg, #4b5563, #374151);
    color: white;
  }

  /* STATS GRID */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  @media (max-width: 640px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
  }

  .stat-label {
    font-size: 0.6rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-family: 'JetBrains Mono', monospace;
    margin-bottom: 0.4rem;
  }

  .stat-value {
    font-size: clamp(1.6rem, 5vw, 2.2rem);
    font-weight: 800;
    line-height: 1;
  }

  /* CHART */
  .chart-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1rem;
  }

  .chart-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 1rem;
  }

  .chart-empty {
    text-align: center;
    padding: 2rem;
    color: var(--muted);
    font-size: 0.85rem;
    font-family: 'JetBrains Mono', monospace;
  }

  .chart-wrap {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* EVENTS */
  .events-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
  }

  .events-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 1rem;
  }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .event-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.85rem 1rem;
    border-radius: 10px;
    border-left: 3px solid;
    gap: 0.75rem;
  }

  .event-info { flex: 1; min-width: 0; }

  .event-title {
    font-weight: 700;
    font-size: 0.82rem;
    margin-bottom: 0.2rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .event-time {
    font-size: 0.68rem;
    color: var(--muted);
    font-family: 'JetBrains Mono', monospace;
  }

  .event-notes {
    font-size: 0.65rem;
    color: #718096;
    margin-top: 0.15rem;
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .event-duration {
    padding: 0.3rem 0.65rem;
    border-radius: 6px;
    color: #fff;
    font-weight: 700;
    font-size: 0.78rem;
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .empty-msg {
    text-align: center;
    padding: 2rem;
    color: var(--muted);
    font-size: 0.85rem;
    font-family: 'JetBrains Mono', monospace;
  }
`;

export default function App() {
  const [systemState, setSystemState] = useState({ light_on: false, manual_mode: false, motion_detected: false });
  const [recentEvents, setRecentEvents] = useState([]);
  const [todayStats, setTodayStats] = useState({ total_events: 0, total_duration: 0, manual_controls: 0, auto_controls: 0 });
  const [hourlyStats, setHourlyStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const newSocket = io(BACKEND_URL, { transports: ['polling', 'websocket'], secure: true });

    newSocket.on('connect', () => setConnectionStatus('connected'));
    newSocket.on('disconnect', () => setConnectionStatus('disconnected'));
    newSocket.on('status_update', (data) => setSystemState(data));
    newSocket.on('light_update', (data) => {
      setSystemState(prev => ({ ...prev, light_on: data.light_on, manual_mode: data.manual_mode }));
      setTimeout(() => fetchRecentEvents(), 200);
    });
    newSocket.on('esp32_motion', (data) => {
      const isDetected = !!data.detected;
      setSystemState(prev => ({
        ...prev,
        motion_detected: isDetected,
        light_on: isDetected ? !!data.light_on : (data.light_on || false),
        manual_mode: data.manual_mode !== undefined ? data.manual_mode : prev.manual_mode
      }));
      if (!isDetected) setTimeout(() => { fetchRecentEvents(); fetchTodayStats(); }, 1000);
    });
    newSocket.on('mode_update', (data) => setSystemState(prev => ({ ...prev, manual_mode: data.manual_mode })));

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    fetchStatus(); fetchRecentEvents(); fetchTodayStats(); fetchHourlyStats();
    const interval = setInterval(() => fetchHourlyStats(), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try { const res = await fetch(`${BACKEND_URL}/api/status`); setSystemState(await res.json()); } catch {}
  };
  const fetchRecentEvents = async () => {
    try { const res = await fetch(`${BACKEND_URL}/api/events/recent?limit=10`); setRecentEvents(await res.json()); } catch {}
  };
  const fetchTodayStats = async () => {
    try { const res = await fetch(`${BACKEND_URL}/api/stats/today`); setTodayStats(await res.json()); } catch {}
  };
  const fetchHourlyStats = async () => {
    try { const res = await fetch(`${BACKEND_URL}/api/stats/hourly`); setHourlyStats(await res.json()); } catch {}
  };

  const controlLight = async (action) => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/light/control`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) { setSystemState(prev => ({ ...prev, light_on: data.light_on, manual_mode: true })); fetchRecentEvents(); fetchTodayStats(); }
    } catch {} finally { setLoading(false); }
  };

  const setAutoMode = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/mode/auto`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { setSystemState(prev => ({ ...prev, manual_mode: false })); fetchRecentEvents(); fetchTodayStats(); }
    } catch {} finally { setLoading(false); }
  };

  const downloadCSV = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/events/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security_events_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch { alert('Error al descargar CSV'); } finally { setDownloading(false); }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        {/* Header */}
        <div className="header">
          <div className="header-title">
            <h1>🔒 Seguridad</h1>
            <p>Monitoreo en Tiempo Real</p>
          </div>
          <div className="header-actions">
            <button className="btn-csv" onClick={downloadCSV} disabled={downloading}>
              📥 {downloading ? 'Descargando...' : 'CSV'}
            </button>
            <div className={`status-badge ${connectionStatus === 'connected' ? 'online' : 'offline'}`}>
              <div className="dot" />
              {connectionStatus === 'connected' ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>

        {/* Main Grid: Light + Controls */}
        <div className="main-grid">
          <div className="light-card">
            <div className="card-label">Estado de Luz</div>
            <div className="light-display">
              <div className={`light-icon ${systemState.light_on ? 'on' : 'off'}`}>
                {systemState.light_on ? '💡' : '🌙'}
              </div>
              <div>
                <div className={`light-state ${systemState.light_on ? 'on' : 'off'}`}>
                  {systemState.light_on ? 'ON' : 'OFF'}
                </div>
                <div className="light-mode">
                  {systemState.manual_mode ? '👤 Manual' : '🤖 Auto'}
                </div>
              </div>
            </div>
          </div>

          <div className="controls-card">
            <div className="card-label">Controles</div>
            <div className="controls-grid">
              <button className="ctrl-btn green" onClick={() => controlLight('on')} disabled={loading}>
                💡 Encender
              </button>
              <button className="ctrl-btn red" onClick={() => controlLight('off')} disabled={loading}>
                🌙 Apagar
              </button>
              <button
                className={`ctrl-btn ${!systemState.manual_mode ? 'gray' : 'blue'}`}
                onClick={setAutoMode}
                disabled={loading || !systemState.manual_mode}
              >
                🤖 {!systemState.manual_mode ? 'Auto Activo' : 'Modo Auto'}
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <StatCard label="Eventos Hoy" value={todayStats.total_events} color="#3b82f6" />
          <StatCard label="Tiempo" value={`${Math.floor((todayStats.total_duration || 0) / 60)}m`} color="#b794f4" />
          <StatCard label="Manual" value={todayStats.manual_controls || 0} color="#f687b3" />
          <StatCard label="Auto" value={todayStats.auto_controls || 0} color="#68d391" />
        </div>

        {/* Chart */}
        <HourlyChart data={hourlyStats} />

        {/* Events */}
        <div className="events-card">
          <div className="events-title">Actividad Reciente</div>
          {recentEvents.length === 0 ? (
            <div className="empty-msg">Sin eventos aún</div>
          ) : (
            <div className="events-list">
              {recentEvents.map((event, i) => <EventItem key={event.id || i} event={event} />)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
    </div>
  );
}

function HourlyChart({ data }) {
  if (data.length === 0) {
    return (
      <div className="chart-card">
        <div className="chart-title">Actividad — Últimos 60 min</div>
        <div className="chart-empty">Sin actividad reciente</div>
      </div>
    );
  }

  const maxEvents = Math.max(...data.map(d => d.total_events), 1);
  const w = Math.max(data.length * 60, 320);
  const h = 220;
  const pad = { top: 24, right: 20, bottom: 40, left: 44 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const points = data.map((d, i) => ({
    x: pad.left + (i / Math.max(data.length - 1, 1)) * cw,
    y: pad.top + ch - (d.total_events / maxEvents) * ch,
    value: d.total_events,
    time: d.time
  }));

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const area = `M ${pad.left},${pad.top + ch} ` + points.map(p => `L ${p.x},${p.y}`).join(' ') + ` L ${pad.left + cw},${pad.top + ch} Z`;

  return (
    <div className="chart-card">
      <div className="chart-title">Actividad — Últimos 60 min</div>
      <div className="chart-wrap">
        <svg width={w} height={h} style={{ display: 'block', minWidth: '100%' }}>
          <defs>
            <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0,1,2,3].map(i => {
            const y = pad.top + (i / 3) * ch;
            return (
              <g key={i}>
                <line x1={pad.left} y1={y} x2={pad.left + cw} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <text x={pad.left - 8} y={y + 4} fill="#4a5568" fontSize="9" textAnchor="end" fontFamily="JetBrains Mono">
                  {Math.round(maxEvents - (i / 3) * maxEvents)}
                </text>
              </g>
            );
          })}
          <path d={area} fill="url(#g)" />
          <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" stroke="#080d1a" strokeWidth="2" />
              {p.value > 0 && (
                <text x={p.x} y={p.y - 10} fill="#63b3ed" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="JetBrains Mono">
                  {p.value}
                </text>
              )}
            </g>
          ))}
          {points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 6)) === 0).map((p, i) => (
            <text key={i} x={p.x} y={h - 8} fill="#4a5568" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono">
              {p.time}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function EventItem({ event }) {
  const getInfo = () => {
    const { type, source, device } = event;
    if (type === 'motion') return { icon: '🔍', title: 'Movimiento PIR', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' };
    if (type === 'light_on') {
      if (source === 'voice') return { icon: '🎤', title: `Voz ON (${device})`, color: '#68d391', bg: 'rgba(104,211,145,0.08)' };
      if (source === 'manual') return { icon: '👤', title: 'Manual — Luz ON', color: '#f687b3', bg: 'rgba(246,135,179,0.08)' };
      return { icon: '🤖', title: 'Auto — Luz ON', color: '#68d391', bg: 'rgba(104,211,145,0.08)' };
    }
    if (type === 'light_off') {
      if (source === 'voice') return { icon: '🎤', title: `Voz OFF (${device})`, color: '#fc8181', bg: 'rgba(252,129,129,0.08)' };
      if (source === 'manual') return { icon: '👤', title: 'Manual — Luz OFF', color: '#4a5568', bg: 'rgba(74,85,104,0.08)' };
      return { icon: '🌙', title: 'Auto — Luz OFF', color: '#4a5568', bg: 'rgba(74,85,104,0.08)' };
    }
    if (type === 'mode_auto') return { icon: '🤖', title: source === 'voice' ? `Voz — Auto (${device})` : 'Modo Auto', color: '#b794f4', bg: 'rgba(183,148,244,0.08)' };
    if (type === 'mode_manual') return { icon: '👤', title: source === 'voice' ? `Voz — Manual (${device})` : 'Modo Manual', color: '#f6e05e', bg: 'rgba(246,224,94,0.08)' };
    return { icon: '📝', title: type, color: '#4a5568', bg: 'rgba(255,255,255,0.02)' };
  };

  const info = getInfo();
  return (
    <div className="event-item" style={{ background: info.bg, borderColor: info.color }}>
      <div className="event-info">
        <div className="event-title" style={{ color: info.color }}>{info.icon} {info.title}</div>
        <div className="event-time">
          {new Date(event.timestamp).toLocaleString('es-PE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        {event.notes && <div className="event-notes">{event.notes}</div>}
      </div>
      {event.duration_seconds > 0 && (
        <div className="event-duration" style={{ background: info.color }}>{event.duration_seconds}s</div>
      )}
    </div>
  );
}