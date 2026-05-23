'use client';

import { useEffect, useState } from 'react';

export default function Header() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: isMobile ? '0.85rem 1.4rem' : '1.1rem 3rem',
      backdropFilter: 'blur(14px)',
      backgroundColor: 'rgba(245, 237, 232, 0.65)',
      borderBottom: '1px solid rgba(188, 143, 143, 0.18)',
    }}>
      <span style={{
        fontFamily: 'Georgia, serif', fontSize: isMobile ? '0.88rem' : '1rem',
        letterSpacing: '0.28em', color: '#7a5040',
      }}>
        SANTHURENIT
      </span>

      {!isMobile && (
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
      )}

      <button style={{
        background: 'none',
        border: '1px solid rgba(188, 143, 143, 0.45)',
        borderRadius: '20px', padding: isMobile ? '0.3rem 0.85rem' : '0.38rem 1.1rem',
        color: '#7a5040', fontSize: '0.68rem',
        letterSpacing: '0.14em', cursor: 'pointer',
      }}>
        {isMobile ? '(0)' : 'CARRITO (0)'}
      </button>
    </header>
  );
}
