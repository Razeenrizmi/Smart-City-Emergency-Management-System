export const C = {
  bg: '#F6F8FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F7',
  border: '#DCE3EC',
  text: '#1F2A37',
  textStrong: '#0B1220',
  textDim: '#5B6875',
  textFaint: '#8A97A6',
  blue: '#2563EB',
  green: '#16A34A',
  orange: '#EA580C',
  red: '#DC2626',
  yellow: '#CA8A04',
  purple: '#6366F1',
  purpleDeep: '#7C3AED',
};

export const card = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: '16px',
  padding: '20px',
};

export const button = (color = C.blue, disabled = false) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '8px 14px',
  borderRadius: '10px',
  border: `1px solid ${color}66`,
  background: `${color}1a`,
  color,
  fontSize: '13px',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  transition: 'all 0.2s',
});

export const badge = (color) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '3px 9px',
  borderRadius: '20px',
  background: `${color}1a`,
  border: `1px solid ${color}55`,
  color,
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.4px',
  whiteSpace: 'nowrap',
});

export const input = {
  width: '100%',
  background: '#FFFFFF',
  border: '1px solid #CBD5E1',
  borderRadius: '10px',
  padding: '10px 12px',
  color: C.text,
  fontSize: '13px',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
