import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://backend-rele-production.up.railway.app';

export default function App() {
  const [systemState, setSystemState] = useState({
    light_on: false,
    manual_mode: false,
    motion_detected: false
  });
  
  const [recentEvents, setRecentEvents] = useState([]);
  const [todayStats, setTodayStats] = useState({
    total_events: 0,
    total_duration: 0,
    manual_controls: 0,
    auto_controls: 0
  });
  const [hourlyStats, setHourlyStats] = useState([]);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const newSocket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      secure: true
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Conectado al servidor');
      setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Desconectado del servidor');
      setConnectionStatus('disconnected');
    });

    newSocket.on('status_update', (data) => {
      setSystemState(data);
    });

    newSocket.on('light_update', (data) => {
      console.log('💡 Light update:', data);
      setSystemState(prev => ({
        ...prev,
        light_on: data.light_on,
        manual_mode: data.manual_mode
      }));
      // Solo actualizamos listas en cambios manuales/voz
      setTimeout(() => fetchRecentEvents(), 200);
    });

    // --- AQUÍ ESTÁ LA CORRECCIÓN MÁGICA ---
    newSocket.on('esp32_motion', (data) => {
      console.log('📡 EVENTO SOCKET:', data);
      
      // 1. Aseguramos que sea booleano real (evita errores de string "False" vs false)
      const isDetected = !!data.detected;
      const isLightOn = !!data.light_on; 

      setSystemState(prev => {
        // LÓGICA BLINDADA:
        // Si el movimiento se detuvo (isDetected === false), 
        // asumimos que la luz DEBE estar apagada visualmente (para modo auto).
        // Si data.light_on viene true por error, lo ignoramos si no hay movimiento.
        
        const finalLightState = isDetected ? isLightOn : (data.light_on || false);

        return {
          ...prev,
          motion_detected: isDetected,
          light_on: finalLightState, 
          manual_mode: data.manual_mode !== undefined ? data.manual_mode : prev.manual_mode
        };
      });

      // 2. Manejo de la actualización de la lista (Base de Datos)
      if (!isDetected) {
        console.log('🛑 Movimiento terminó. Esperando para actualizar historial...');
        // Damos 1 segundo completo para asegurar que la DB guardó el evento "OFF"
        setTimeout(() => {
            fetchRecentEvents();
            fetchTodayStats();
        }, 1000); 
      }
    });

    newSocket.on('mode_update', (data) => {
      setSystemState(prev => ({
        ...prev,
        manual_mode: data.manual_mode
      }));
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchRecentEvents();
    fetchTodayStats();
    fetchHourlyStats();
    
    const interval = setInterval(() => {
      fetchHourlyStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/status`);
      const data = await res.json();
      setSystemState(data);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const fetchRecentEvents = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/events/recent?limit=10`);
      const data = await res.json();
      setRecentEvents(data);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const fetchTodayStats = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/stats/today`);
      const data = await res.json();
      setTodayStats(data);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const fetchHourlyStats = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/stats/hourly`);
      const data = await res.json();
      setHourlyStats(data);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const controlLight = async (action) => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/light/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        setSystemState(prev => ({
          ...prev,
          light_on: data.light_on,
          manual_mode: true
        }));
        fetchRecentEvents();
        fetchTodayStats();
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const setAutoMode = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/mode/auto`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setSystemState(prev => ({
          ...prev,
          manual_mode: false
        }));
        fetchRecentEvents();
        fetchTodayStats();
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
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
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading CSV:', err);
      alert('Error al descargar el archivo CSV');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050810',
      padding: '2rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1128 0%, #05080f 100%)',
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '2rem',
        border: '1px solid rgba(255,255,255,0.05)',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ 
              margin: 0, 
              fontSize: '2rem', 
              color: '#ffffff',
              fontWeight: '600',
              letterSpacing: '-0.5px'
            }}>
              Sistema de Seguridad
            </h1>
            <p style={{ 
              margin: '0.3rem 0 0 0', 
              color: '#6b7280', 
              fontSize: '0.95rem'
            }}>
              Monitoreo y Control en Tiempo Real
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              onClick={downloadCSV}
              disabled={downloading}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: '600',
                border: 'none',
                borderRadius: '8px',
                cursor: downloading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                transition: 'transform 0.2s',
                opacity: downloading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseOver={(e) => !downloading && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              📥 {downloading ? 'Downloading...' : 'Download CSV'}
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: connectionStatus === 'connected' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${connectionStatus === 'connected' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: '8px'
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: connectionStatus === 'connected' ? '#22c55e' : '#ef4444'
              }}></div>
              <span style={{
                color: connectionStatus === 'connected' ? '#22c55e' : '#ef4444',
                fontSize: '0.75rem',
                fontWeight: '600',
                textTransform: 'uppercase'
              }}>
                {connectionStatus === 'connected' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* Light Status */}
        <div style={{
          background: 'linear-gradient(135deg, #0a1128 0%, #05080f 100%)',
          borderRadius: '16px',
          padding: '1.5rem',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Light Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '12px',
              background: systemState.light_on ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' : 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              boxShadow: systemState.light_on ? '0 8px 24px rgba(251, 191, 36, 0.4)' : 'none'
            }}>
              {systemState.light_on ? '💡' : '🌙'}
            </div>
            <div>
              <div style={{ 
                fontSize: '1.75rem', 
                fontWeight: '700', 
                color: systemState.light_on ? '#fbbf24' : '#6b7280' 
              }}>
                {systemState.light_on ? 'ON' : 'OFF'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                {systemState.manual_mode ? '👤 Manual Control' : '🤖 Auto Mode'}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{
          background: 'linear-gradient(135deg, #0a1128 0%, #05080f 100%)',
          borderRadius: '16px',
          padding: '1.5rem',
          border: '1px solid rgba(255,255,255,0.05)',
          gridColumn: 'span 2'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            System Controls
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <button
              onClick={() => controlLight('on')}
              disabled={loading}
              style={{
                padding: '1.25rem',
                fontSize: '1rem',
                fontWeight: '600',
                border: 'none',
                borderRadius: '10px',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: 'white',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                transition: 'transform 0.2s',
                opacity: loading ? 0.5 : 1
              }}
              onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              💡 Turn ON
            </button>
            
            <button
              onClick={() => controlLight('off')}
              disabled={loading}
              style={{
                padding: '1.25rem',
                fontSize: '1rem',
                fontWeight: '600',
                border: 'none',
                borderRadius: '10px',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                transition: 'transform 0.2s',
                opacity: loading ? 0.5 : 1
              }}
              onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              🌙 Turn OFF
            </button>
            
            <button
              onClick={setAutoMode}
              disabled={loading || !systemState.manual_mode}
              style={{
                padding: '1.25rem',
                fontSize: '1rem',
                fontWeight: '600',
                border: 'none',
                borderRadius: '10px',
                cursor: (loading || !systemState.manual_mode) ? 'not-allowed' : 'pointer',
                background: !systemState.manual_mode 
                  ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                boxShadow: !systemState.manual_mode 
                  ? 'none' 
                  : '0 4px 12px rgba(59, 130, 246, 0.3)',
                transition: 'transform 0.2s',
                opacity: (loading || !systemState.manual_mode) ? 0.5 : 1
              }}
              onMouseOver={(e) => !loading && systemState.manual_mode && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              🤖 {!systemState.manual_mode ? 'Auto Mode (Active)' : 'Auto Mode'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <StatCard label="Events Today" value={todayStats.total_events} color="#3b82f6" />
        <StatCard label="Activity Time" value={`${Math.floor((todayStats.total_duration || 0) / 60)}m`} color="#8b5cf6" />
        <StatCard label="Manual" value={todayStats.manual_controls || 0} color="#ec4899" />
        <StatCard label="Auto" value={todayStats.auto_controls || 0} color="#10b981" />
      </div>

      {/* Hourly Chart */}
      <HourlyChart data={hourlyStats} />

      {/* Recent Events */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1128 0%, #05080f 100%)',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid rgba(255,255,255,0.05)',
        marginTop: '1.5rem'
      }}>
        <h2 style={{ 
          margin: '0 0 1.5rem 0', 
          fontSize: '1.1rem', 
          color: '#ffffff',
          fontWeight: '600'
        }}>
          Recent Activity
        </h2>
        
        {recentEvents.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#6b7280',
            fontSize: '0.9rem'
          }}>
            No events yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentEvents.map((event, index) => (
              <EventItem key={event.id || index} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0a1128 0%, #05080f 100%)',
      borderRadius: '16px',
      padding: '1.5rem',
      border: '1px solid rgba(255,255,255,0.05)'
    }}>
      <div style={{ 
        fontSize: '0.75rem', 
        color: '#6b7280', 
        marginBottom: '0.5rem', 
        textTransform: 'uppercase', 
        letterSpacing: '1px' 
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: '2.5rem', 
        fontWeight: '700', 
        color: color,
        lineHeight: '1'
      }}>
        {value}
      </div>
    </div>
  );
}

function HourlyChart({ data }) {
  if (data.length === 0) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #0a1128 0%, #05080f 100%)',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <h2 style={{ 
          margin: '0 0 1.5rem 0', 
          fontSize: '1.1rem', 
          color: '#ffffff',
          fontWeight: '600'
        }}>
          Activity Timeline (Last 60 Minutes)
        </h2>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#6b7280',
          fontSize: '0.9rem'
        }}>
          No activity in the last 60 minutes
        </div>
      </div>
    );
  }

  const maxEvents = Math.max(...data.map(d => d.total_events), 1);
  
  const containerWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 100, 1200) : 1200;
  const width = containerWidth;
  const height = 300;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - (d.total_events / maxEvents) * chartHeight;
    return { x, y, value: d.total_events, time: d.time };
  });

  const linePath = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`
  ).join(' ');

  const areaPath = `M ${padding.left},${padding.top + chartHeight} ` +
    points.map(p => `L ${p.x},${p.y}`).join(' ') +
    ` L ${padding.left + chartWidth},${padding.top + chartHeight} Z`;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0a1128 0%, #05080f 100%)',
      borderRadius: '16px',
      padding: '1.5rem',
      border: '1px solid rgba(255,255,255,0.05)'
    }}>
      <h2 style={{ 
        margin: '0 0 1.5rem 0', 
        fontSize: '1.1rem', 
        color: '#ffffff',
        fontWeight: '600'
      }}>
        Activity Timeline (Last 60 Minutes)
      </h2>
      
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg width={width} height={height} style={{ display: 'block', width: '100%', height: 'auto' }}>
          {[0, 1, 2, 3, 4].map(i => {
            const y = padding.top + (i / 4) * chartHeight;
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartWidth}
                  y2={y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  fill="#6b7280"
                  fontSize="10"
                  textAnchor="end"
                >
                  {Math.round(maxEvents - (i / 4) * maxEvents)}
                </text>
              </g>
            );
          })}

          <defs>
            <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path
            d={areaPath}
            fill="url(#areaGradient)"
          />

          <path
            d={linePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, i) => (
            <g key={i}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="#3b82f6"
                stroke="#0a1128"
                strokeWidth="2"
              />
              {point.value > 0 && (
                <text
                  x={point.x}
                  y={point.y - 12}
                  fill="#3b82f6"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {point.value}
                </text>
              )}
            </g>
          ))}

          {points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 8)) === 0).map((point, i) => (
            <text
              key={i}
              x={point.x}
              y={padding.top + chartHeight + 25}
              fill="#6b7280"
              fontSize="10"
              textAnchor="middle"
            >
              {point.time}
            </text>
          ))}

          <text
            x={20}
            y={padding.top + chartHeight / 2}
            fill="#6b7280"
            fontSize="11"
            textAnchor="middle"
            transform={`rotate(-90, 20, ${padding.top + chartHeight / 2})`}
          >
            Events
          </text>

          <text
            x={padding.left + chartWidth / 2}
            y={height - 10}
            fill="#6b7280"
            fontSize="11"
            textAnchor="middle"
          >
            Time (HH:MM)
          </text>
        </svg>
      </div>
    </div>
  );
}

function EventItem({ event }) {
  const getEventInfo = () => {
    const type = event.type;
    const source = event.source;
    const device = event.device;
    
    if (type === 'motion') {
      return {
        icon: '🔍',
        title: 'PIR Motion Detection',
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: '#3b82f6'
      };
    }
    
    if (type === 'light_on') {
      if (source === 'voice') {
        return {
          icon: '🎤',
          title: `Voice Control - Light ON (${device})`,
          color: '#22c55e',
          bgColor: 'rgba(34, 197, 94, 0.1)',
          borderColor: '#22c55e'
        };
      } else if (source === 'manual') {
        return {
          icon: '👤',
          title: 'Manual - Light ON',
          color: '#ec4899',
          bgColor: 'rgba(236, 72, 153, 0.1)',
          borderColor: '#ec4899'
        };
      } else {
        return {
          icon: '🤖',
          title: 'Auto - Light ON',
          color: '#10b981',
          bgColor: 'rgba(16, 185, 129, 0.1)',
          borderColor: '#10b981'
        };
      }
    }
    
    if (type === 'light_off') {
      if (source === 'voice') {
        return {
          icon: '🎤',
          title: `Voice Control - Light OFF (${device})`,
          color: '#ef4444',
          bgColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: '#ef4444'
        };
      } else if (source === 'manual') {
        return {
          icon: '👤',
          title: 'Manual - Light OFF',
          color: '#6b7280',
          bgColor: 'rgba(107, 114, 128, 0.1)',
          borderColor: '#6b7280'
        };
      } else {
        return {
          icon: '🌙',
          title: 'Auto - Light OFF',
          color: '#6b7280',
          bgColor: 'rgba(107, 114, 128, 0.1)',
          borderColor: '#6b7280'
        };
      }
    }
    
    if (type === 'mode_auto') {
      if (source === 'voice') {
        return {
          icon: '🎤',
          title: `Voice Control - Auto Mode ON (${device})`,
          color: '#8b5cf6',
          bgColor: 'rgba(139, 92, 246, 0.1)',
          borderColor: '#8b5cf6'
        };
      } else {
        return {
          icon: '🤖',
          title: 'Auto Mode Activated',
          color: '#8b5cf6',
          bgColor: 'rgba(139, 92, 246, 0.1)',
          borderColor: '#8b5cf6'
        };
      }
    }
    
    if (type === 'mode_manual') {
      if (source === 'voice') {
        return {
          icon: '🎤',
          title: `Voice Control - Manual Mode (${device})`,
          color: '#f59e0b',
          bgColor: 'rgba(245, 158, 11, 0.1)',
          borderColor: '#f59e0b'
        };
      } else {
        return {
          icon: '👤',
          title: 'Manual Mode Activated',
          color: '#f59e0b',
          bgColor: 'rgba(245, 158, 11, 0.1)',
          borderColor: '#f59e0b'
        };
      }
    }
    
    return {
      icon: '📝',
      title: type,
      color: '#6b7280',
      bgColor: 'rgba(255,255,255,0.02)',
      borderColor: '#6b7280'
    };
  };
  
  const info = getEventInfo();
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem',
      background: info.bgColor,
      borderRadius: '10px',
      borderLeft: `3px solid ${info.borderColor}`
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.3rem'
        }}>
          <div style={{ fontWeight: '600', color: info.color, fontSize: '0.9rem' }}>
            {info.icon} {info.title}
          </div>
        </div>
        
        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          {new Date(event.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>
        
        {event.notes && (
          <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.2rem', fontStyle: 'italic' }}>
            {event.notes}
          </div>
        )}
      </div>
      
      {event.duration_seconds > 0 && (
        <div style={{
          padding: '0.4rem 0.8rem',
          background: info.color,
          borderRadius: '6px',
          color: '#ffffff',
          fontWeight: '700',
          fontSize: '0.85rem'
        }}>
          {event.duration_seconds}s
        </div>
      )}
    </div>
  );
}