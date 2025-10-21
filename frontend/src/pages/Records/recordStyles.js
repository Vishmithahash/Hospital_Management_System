export const layout = {
  padding: '2rem',
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem'
}

export const twoColumnGrid = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr',
  gap: '1.5rem'
}

export const singleColumnStack = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem'
}

export const card = {
  background: '#fff',
  borderRadius: '1rem',
  padding: '1.5rem',
  boxShadow: '0 20px 40px rgba(15, 23, 42, 0.08)',
  minHeight: '320px'
}

export const compactCard = {
  ...card,
  minHeight: 'unset'
}

export const cardHeader = {
  marginBottom: '1.5rem'
}

export const cardTitle = {
  margin: 0
}

export const cardSubtitle = {
  margin: 0,
  color: '#64748b'
}

export const sectionStack = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem'
}
