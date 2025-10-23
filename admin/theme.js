export function initTheme(theme = null) {
  return theme || {
    colors: {
      primary: '#9C6BFF',
      secondary: '#A3E3C2',
      text: '#1E1E1E',
      background: '#F8F8FF'
    },
    fonts: {
      display: 'Outfit',
      body: 'Inter'
    },
    radius: {
      small: '0.5rem',
      medium: '1rem',
      large: '2rem'
    }
  };
}
