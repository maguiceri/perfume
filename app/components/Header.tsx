'use client';

export default function Header() {
  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '1.1rem 3rem',
      backdropFilter: 'blur(14px)',
      backgroundColor: 'rgba(245, 237, 232, 0.65)',
      borderBottom: '1px solid rgba(188, 143, 143, 0.18)',
    }}>
      <span style={{
        fontFamily: 'Georgia, serif', fontSize: '1rem',
        letterSpacing: '0.38em', color: '#7a5040',
      }}>
        SANTHURENIT
      </span>

      <nav style={{ display: 'flex', gap: '2.5rem' }}>
        {['COLECCIÓN', 'NOSOTROS', 'CONTACTO'].map(label => (
          <a key={label} href="#" style={{
            fontSize: '0.68rem', letterSpacing: '0.18em',
            color: '#7a5040', textDecoration: 'none', opacity: 0.75,
          }}>
            {label}
          </a>
        ))}
      </nav>

      <button style={{
        background: 'none',
        border: '1px solid rgba(188, 143, 143, 0.45)',
        borderRadius: '20px', padding: '0.38rem 1.1rem',
        color: '#7a5040', fontSize: '0.68rem',
        letterSpacing: '0.14em', cursor: 'pointer',
      }}>
        CARRITO (0)
      </button>
    </header>
  );
}
