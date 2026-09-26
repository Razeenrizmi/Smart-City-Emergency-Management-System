export const C = {
  bg: '#0D1117',
  surface: '#161B22',
  surfaceAlt: '#21262D',
  border: '#30363D',
  text: '#E2E8F0',
  textStrong: '#FFFFFF',
  textDim: '#8B949E',
  textFaint: '#4A5568',
  blue: '#4299E1',
  green: '#48BB78',
  orange: '#ED8936',
  red: '#E53E3E',
  yellow: '#ECC94B',
  purple: '#667EEA',
  purpleDeep: '#764BA2',
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
  background: `${color}22`,
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
  background: `${color}22`,
  border: `1px solid ${color}55`,
  color,
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.4px',
  whiteSpace: 'nowrap',
});

export const input = {
  width: '100%',
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: '10px',
  padding: '10px 12px',
  color: C.text,
  fontSize: '13px',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
