import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Sparkles, Zap } from 'lucide-react';
import apiClient from '../services/appClient';

const QUICK_PROMPTS = [
  { label: '🚨 Urgent repairs', prompt: 'Where are the worst potholes that need urgent repair?' },
  { label: '📊 City summary', prompt: 'Summarize the city hazard overview' },
  { label: '🔧 Repair order', prompt: 'Generate a repair dispatch order for all verified hazards' },
  { label: '🌊 Flooding', prompt: 'Show me all flooding hazard locations' },
];

const MessageBubble = ({ msg }) => {
  const isAi = msg.role === 'ai';
  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        flexDirection: isAi ? 'row' : 'row-reverse',
        animation: 'fadeInUp 0.3s ease',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isAi
          ? 'linear-gradient(135deg, #667EEA, #764BA2)'
          : 'rgba(66,153,225,0.2)',
        border: isAi ? 'none' : '1px solid #4299E1',
      }}>
        {isAi ? <Bot size={16} color="#fff" /> : <User size={16} color="#4299E1" />}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '78%',
        background: isAi ? 'rgba(102,126,234,0.12)' : 'rgba(66,153,225,0.1)',
        border: isAi ? '1px solid rgba(102,126,234,0.3)' : '1px solid rgba(66,153,225,0.25)',
        borderRadius: isAi ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
        padding: '10px 14px',
        color: '#E2E8F0',
        fontSize: '13px',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.loading ? (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#667EEA',
                animation: `bounce 0.9s ${i * 0.15}s ease infinite`,
              }} />
            ))}
          </div>
        ) : msg.text}
        <div style={{ fontSize: '10px', color: '#4A5568', marginTop: '4px', textAlign: isAi ? 'left' : 'right' }}>
          {msg.time}
        </div>
      </div>
    </div>
  );
};

const AiCopilotDrawer = ({ open, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'ai',
      text: '👋 Hi! I\'m your SRMS AI Copilot. Ask me about road hazards, risk clusters, or generate repair orders.\n\nTry a quick prompt below to get started.',
      time: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const sendMessage = async (prompt) => {
    const text = (prompt ?? input).trim();
    if (!text || loading) return;

    setInput('');
    const userMsg = { id: Date.now(), role: 'user', text, time: new Date().toLocaleTimeString() };
    const loadingMsg = { id: Date.now() + 1, role: 'ai', loading: true, time: '' };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      const res = await apiClient.post('/ai/chat', { prompt: text });
      const reply = res.data?.data?.message ?? 'No response received.';
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        { id: Date.now() + 2, role: 'ai', text: reply, time: new Date().toLocaleTimeString() },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        {
          id: Date.now() + 2, role: 'ai',
          text: `❌ Failed to reach AI backend: ${err.message}`,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
            zIndex: 999,
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Drawer */}
      <div
        id="ai-copilot-drawer"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '420px',
          background: '#0D1117',
          borderLeft: '1px solid #30363D',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: open ? '-8px 0 40px rgba(0,0,0,0.6)' : 'none',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #30363D',
          background: 'linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.1))',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #667EEA, #764BA2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={22} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              AI Copilot
              <Sparkles size={14} color="#ECC94B" />
            </div>
            <div style={{ fontSize: '11px', color: '#8B949E' }}>SRMS Analyst Engine · Powered by spatial AI</div>
          </div>
          <button
            id="ai-copilot-close-btn"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid #30363D',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: '#8B949E',
              display: 'flex',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#8B949E'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick prompts */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #30363D',
          display: 'flex', gap: '6px', flexWrap: 'wrap',
        }}>
          {QUICK_PROMPTS.map(q => (
            <button
              key={q.prompt}
              id={`quick-prompt-${q.label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
              onClick={() => sendMessage(q.prompt)}
              disabled={loading}
              style={{
                background: 'rgba(102,126,234,0.1)',
                border: '1px solid rgba(102,126,234,0.3)',
                borderRadius: '20px',
                padding: '4px 10px',
                fontSize: '11px',
                color: '#A0AEC0',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: loading ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'rgba(102,126,234,0.2)'; e.currentTarget.style.color = '#fff'; }}}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(102,126,234,0.1)'; e.currentTarget.style.color = '#A0AEC0'; }}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid #30363D',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={inputRef}
            id="ai-copilot-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about road risks, clusters, repairs…"
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              background: '#161B22',
              border: '1px solid #30363D',
              borderRadius: '12px',
              padding: '10px 14px',
              color: '#E2E8F0',
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.5',
              transition: 'border-color 0.2s',
              maxHeight: '100px',
              overflowY: 'auto',
            }}
            onFocus={e => e.target.style.borderColor = '#667EEA'}
            onBlur={e => e.target.style.borderColor = '#30363D'}
          />
          <button
            id="ai-copilot-send-btn"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              width: '40px', height: '40px',
              borderRadius: '12px',
              background: input.trim() && !loading
                ? 'linear-gradient(135deg, #667EEA, #764BA2)'
                : '#21262D',
              border: 'none',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            {loading ? <Zap size={16} color="#667EEA" /> : <Send size={16} color={input.trim() ? '#fff' : '#4A5568'} />}
          </button>
        </div>
      </div>
    </>
  );
};

export default AiCopilotDrawer;
