'use client';

import { useEffect, useRef, useState } from 'react';

const IMG = '/perfume.png';

const PRODUCTS = [
  {
    brand: 'YSL', name: 'Libre', sub: 'Eau de Parfum', price: '$185', filter: 'none',
    top: 'Lavanda francesa', mid: 'Jazmín blanco', base: 'Vainilla & almizcle',
    desc: 'Una declaración de libertad. Floral, cálido y audaz.',
  },
  {
    brand: 'Chanel', name: 'N°5', sub: 'Eau de Parfum', price: '$210', filter: 'hue-rotate(52deg) saturate(1.3)',
    top: 'Aldehídos & neroli', mid: 'Rosa & jazmín', base: 'Sándalo & vetiver',
    desc: 'Icónico desde 1921. La esencia de lo femenino eterno.',
  },
  {
    brand: 'Armani', name: 'Sì', sub: 'Eau de Parfum', price: '$165', filter: 'hue-rotate(168deg) saturate(0.75)',
    top: 'Grosella negra', mid: 'Rosa de mayo', base: 'Pachulí & vainilla',
    desc: 'Contemporáneo y sensual. Decir sí a todo lo que amas.',
  },
  {
    brand: 'YSL', name: 'Mon Paris', sub: 'Eau de Toilette', price: '$155', filter: 'hue-rotate(288deg) saturate(1.1)',
    top: 'Fresa & pera', mid: 'Peonía & rosa', base: 'Almizcle blanco',
    desc: 'Un coup de foudre en pleno corazón de París.',
  },
  {
    brand: 'Paco Rabanne', name: 'Olympéa', sub: 'Eau de Parfum', price: '$145', filter: 'grayscale(0.65) brightness(1.15)',
    top: 'Mandarina verde', mid: 'Flor de sal', base: 'Cachemir & sándalo',
    desc: 'Fuerza divina. Para la mujer que desafía los límites.',
  },
];

// 3D slot config for offsets -2, -1, 0, +1, +2
// x = horizontal offset from center (px), ry = rotateY, s = scale, op = opacity
const SLOTS = [
  { x: -400, ry: -48, s: 0.62, op: 0.42 },
  { x: -215, ry: -30, s: 0.82, op: 0.74 },
  { x:    0, ry:   0, s: 1.00, op: 1.00 },
  { x:  215, ry:  30, s: 0.82, op: 0.74 },
  { x:  400, ry:  48, s: 0.62, op: 0.42 },
];

const MOBILE_SLOTS = [
  { x: -250, ry: -42, s: 0.62, op: 0.38 },
  { x: -128, ry: -26, s: 0.80, op: 0.70 },
  { x:    0, ry:   0, s: 1.00, op: 1.00 },
  { x:  128, ry:  26, s: 0.80, op: 0.70 },
  { x:  250, ry:  42, s: 0.62, op: 0.38 },
];

function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function clamp(t: number, a = 0, b = 1) { return Math.max(a, Math.min(b, t)); }
function mapRange(t: number, a: number, b: number) { return clamp((t - a) / (b - a)); }

function Carousel({ isMobile }: { isMobile: boolean }) {
  const [active, setActive]   = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const n = PRODUCTS.length;
  const go = (dir: 1 | -1) => setActive(i => (i + dir + n) % n);
  const slots = isMobile ? MOBILE_SLOTS : SLOTS;

  return (
    <div style={{ width: '100%', userSelect: 'none' }}>

      {/* 3D stage — overflow visible so side cards show outside bounds */}
      <div style={{
        height: isMobile ? '280px' : '370px',
        marginTop: isMobile ? '8px' : '0',
        position: 'relative', overflow: 'visible',
      }}>
        {PRODUCTS.map((prod, i) => {
            let off = ((i - active) % n + n) % n;
            if (off > Math.floor(n / 2)) off -= n; // –2..+2

            const slot     = slots[off + 2];
            const isActive = off === 0;

            const baseScale = isActive ? slot.s * (isMobile ? 1.03 : 1.10) : slot.s;

            return (
              // ── Outer shell: carousel 3D positioning (React-driven) ──
              <div
                key={i}
                style={{
                  position: 'absolute', top: 0, left: '50%', marginLeft: '-90px',
                  width: '180px',
                  zIndex: 5 - Math.abs(off),
                  transform: `perspective(1100px) translateX(${slot.x}px) rotateY(${slot.ry}deg)`,
                  opacity: slot.op,
                  transition: 'transform 0.65s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.65s ease',
                  cursor: isActive ? 'default' : 'pointer',
                }}
                onClick={() => !isActive && go(off > 0 ? 1 : -1)}
              >
              {/* ── Scale wrapper: grows downward only, no upward bleed ── */}
              <div style={{
                transform: `scale(${baseScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.65s cubic-bezier(0.25,0.46,0.45,0.94)',
              }}>
              {/* ── Inner card: visual styling + hover tilt (DOM-driven) ── */}
              <div
                className={isActive ? 'card-active' : ''}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={(e) => {
                  setHovered(null);
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transition = 'transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.4s ease';
                  el.style.transform  = '';
                  el.style.boxShadow  = '';
                }}
                onMouseMove={(e) => {
                  if (!isActive) return;
                  const el   = e.currentTarget as HTMLDivElement;
                  const rect = el.getBoundingClientRect();
                  const dx   = (e.clientX - rect.left  - rect.width  / 2) / (rect.width  / 2);
                  const dy   = (e.clientY - rect.top   - rect.height / 2) / (rect.height / 2);
                  el.style.transition = 'none';
                  el.style.transform  = `perspective(700px) rotateX(${-dy * 9}deg) rotateY(${dx * 11}deg) translate(${dx * 5}px,${dy * 4}px) scale(1.03)`;
                  el.style.boxShadow  = [
                    'inset 0 1px 0 rgba(255,255,255,1)',
                    `0 ${28 + dy * -6}px ${60 + Math.abs(dy) * 10}px rgba(188,143,143,0.32)`,
                    `0 6px 28px rgba(196,163,90,0.22)`,
                  ].join(', ');
                }}
                style={{
                  background: 'linear-gradient(160deg, rgba(255,255,255,0.97) 0%, rgba(255,249,243,0.93) 55%, rgba(255,241,230,0.90) 100%)',
                  borderRadius: '20px',
                  border: isActive
                    ? '1px solid rgba(196,163,90,0.50)'
                    : '1px solid rgba(255,255,255,0.75)',
                  ...(!isActive ? {
                    boxShadow: [
                      'inset 0 1px 0 rgba(255,255,255,0.95)',
                      'inset 0 -1px 0 rgba(188,143,143,0.08)',
                      '0 2px 6px rgba(0,0,0,0.04)',
                      '0 10px 32px rgba(188,143,143,0.14)',
                    ].join(', '),
                  } : {}),
                  padding: isMobile ? '0.75rem 0.9rem 0.7rem' : '1.4rem 1rem 1.15rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? '0.22rem' : '0.36rem',
                  backdropFilter: 'blur(6px)',
                  willChange: 'transform',
                }}
              >
                {/* Top rim highlight line */}
                <div style={{
                  position: 'absolute', top: 0, left: '15%', right: '15%', height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 40%, rgba(255,255,255,1) 60%, transparent)',
                  borderRadius: '1px',
                }} />

                {/* Bottle + radial glow platform */}
                <div style={{
                  position: 'relative',
                  height: isMobile ? '110px' : '155px',
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                  borderRadius: '12px',
                }}>
                  {/* Glow under bottle */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0, left: '10%', right: '10%', height: '30px',
                    background: 'radial-gradient(ellipse at center, rgba(196,163,90,0.22) 0%, transparent 70%)',
                    filter: 'blur(4px)',
                  }} />

                  <img
                    src={IMG}
                    alt={prod.name}
                    className={isActive ? 'bottle-img' : ''}
                    style={{
                      maxHeight: isMobile ? '96px' : '142px',
                      maxWidth: isMobile ? '80px' : '118px',
                      objectFit: 'contain',
                      filter: prod.filter,
                      transition: 'transform 0.4s ease, opacity 0.35s ease',
                      position: 'relative', zIndex: 1,
                      opacity: hovered === i ? 0.15 : 1,
                      transform: hovered === i ? 'scale(0.88)' : 'scale(1)',
                    }}
                  />

                  {/* Hover detail overlay */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: '0.3rem',
                    padding: '0.75rem 0.5rem',
                    background: 'linear-gradient(160deg, rgba(255,252,248,0.97) 0%, rgba(255,245,235,0.95) 100%)',
                    opacity: hovered === i ? 1 : 0,
                    transform: hovered === i ? 'translateY(0)' : 'translateY(10px)',
                    transition: 'opacity 0.3s ease, transform 0.3s ease',
                    borderRadius: '12px',
                    zIndex: 2,
                  }}>
                    <div style={{ fontSize: '0.5rem', letterSpacing: '0.22em', color: '#c4a35a', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                      Notas
                    </div>
                    {[
                      { label: 'Salida', value: prod.top,  dot: '#f0c080' },
                      { label: 'Corazón', value: prod.mid, dot: '#bc8f8f' },
                      { label: 'Base',   value: prod.base, dot: '#9a7a6a' },
                    ].map(({ label, value, dot }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%', padding: '0 0.2rem' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.46rem', color: '#b09080', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
                          <span style={{ fontSize: '0.58rem', color: '#5a3020', fontFamily: 'Georgia, serif' }}>{value}</span>
                        </div>
                      </div>
                    ))}
                    <div style={{
                      marginTop: '0.3rem',
                      fontSize: '0.52rem', color: '#9a7060',
                      textAlign: 'center', lineHeight: 1.5,
                      fontStyle: 'italic',
                      padding: '0 0.2rem',
                    }}>
                      "{prod.desc}"
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{
                  width: '40px', height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(196,163,90,0.45), transparent)',
                  margin: '0.1rem 0',
                }} />

                <div style={{
                  fontSize: '0.56rem', letterSpacing: '0.26em',
                  color: '#bc8f8f', textTransform: 'uppercase',
                }}>
                  {prod.brand}
                </div>
                <div style={{
                  fontSize: '1.05rem', fontFamily: 'Georgia, serif',
                  color: '#4a2818', letterSpacing: '0.04em',
                }}>
                  {prod.name}
                </div>
                <div style={{ fontSize: '0.62rem', color: '#a08878', letterSpacing: '0.06em' }}>
                  {prod.sub}
                </div>
                <div style={{
                  fontSize: '1.1rem', fontWeight: 600,
                  color: '#c4a35a',
                  textShadow: '0 1px 8px rgba(196,163,90,0.35)',
                  letterSpacing: '0.04em',
                }}>
                  {prod.price}
                </div>

                <button
                  onClick={e => e.stopPropagation()}
                  className={isActive ? 'shimmer-btn' : ''}
                  style={{
                    marginTop: '0.6rem',
                    border: 'none', borderRadius: '20px', color: 'white',
                    padding: '0.52rem 0', width: '100%',
                    fontSize: '0.58rem', letterSpacing: '0.14em', cursor: 'pointer',
                    opacity: isActive ? 1 : 0,
                    pointerEvents: isActive ? 'auto' : 'none',
                    transition: 'opacity 0.4s ease',
                    // fallback when not active
                    background: 'linear-gradient(135deg, #bc8f8f, #c4a35a)',
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  AGREGAR AL CARRITO
                </button>
              </div>
              </div>
              </div>
            );
        })}
      </div>

      {/* Arrow buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', marginTop: isMobile ? '1.8rem' : '2.2rem' }}>
        {([[-1, '‹'], [1, '›']] as const).map(([dir, label]) => (
          <button
            key={dir}
            onClick={() => go(dir)}
            style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(255,245,238,0.85))',
              border: '1px solid rgba(196,163,90,0.30)',
              color: '#9a6848', fontSize: '1.6rem', lineHeight: 1,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: [
                'inset 0 1px 0 rgba(255,255,255,1)',
                '0 4px 14px rgba(188,143,143,0.18)',
                '0 1px 4px rgba(196,163,90,0.12)',
              ].join(', '),
              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.transform = 'scale(1.08)';
              b.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,1), 0 6px 20px rgba(188,143,143,0.28), 0 2px 8px rgba(196,163,90,0.20)';
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.transform = 'scale(1)';
              b.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,1), 0 4px 14px rgba(188,143,143,0.18), 0 1px 4px rgba(196,163,90,0.12)';
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

const FIELDS = ['Nombre', 'Correo electrónico', 'Mensaje'] as const;

export default function PerfumeScene() {
  const [appeared, setAppeared] = useState(false);
  // raw: scrollY / innerHeight, NOT clamped — can exceed 1
  const [raw, setRaw] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Refs for cursor tilt + float (RAF-driven, no re-renders)
  const heroImgRef  = useRef<HTMLImageElement>(null);
  const mouseRef    = useRef({ x: 0, y: 0 });
  const smoothRef   = useRef({ x: 0, y: 0 });
  const rawRef      = useRef(0);

  useEffect(() => { rawRef.current = raw; }, [raw]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    const tid = setTimeout(() => setAppeared(true), 250);
    const onScroll = () => setRaw(window.scrollY / window.innerHeight);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(tid);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Cursor tilt + float RAF loop
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth  - 0.5;
      mouseRef.current.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('mousemove', onMouse);

    let raf: number;
    let t = 0;
    const loop = () => {
      t += 0.018;
      // Smooth lerp toward cursor
      smoothRef.current.x += (mouseRef.current.x - smoothRef.current.x) * 0.05;
      smoothRef.current.y += (mouseRef.current.y - smoothRef.current.y) * 0.05;

      const img = heroImgRef.current;
      if (img && rawRef.current < 0.5) {
        const { x, y } = smoothRef.current;
        const rx  = y * -14;                          // tilt vertical
        const ry  = x *  18;                          // tilt horizontal
        const tx  = x *  24;                          // parallax X
        const ty  = y *  14 + Math.sin(t * 1.1) * 9; // parallax Y + float sine
        img.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translate(${tx}px,${ty}px)`;
        img.style.filter    = `drop-shadow(${-ry * 0.6}px ${Math.abs(rx) * 0.5 + 22}px 38px rgba(0,0,0,0.20))`;
      } else if (img) {
        // Reset when scrolled past hero
        img.style.transform = '';
        img.style.filter    = '';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', onMouse);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── Phase 1: hero → shop (raw 0-2) ────────────────────────────────
  const p1 = easeInOut(clamp(raw, 0, 1));

  const floatScale   = 1 - p1 * 0.74;
  const floatX       = p1 * (isMobile ? -6 : -34);
  const floatY       = p1 * (isMobile ? -8 : -5);
  // Perfume fades out slowly: starts at raw 0.8, gone by raw 1.4
  const floatOpacity = appeared ? clamp(1 - mapRange(raw, 0.8, 1.4)) : 0;

  // ── Phase 2: shop → contact (raw 2.2-3.4) ─────────────────────────
  const contactP = easeInOut(mapRange(raw, 2.2, 3.4));

  // Shop appears raw 0.6-1.6, exits as contact rises
  const shopP         = easeInOut(mapRange(raw, 0.6, 1.6));
  // Entrance: slides in 55px from below. Exit: rides 100vh off the top (matches contact's rise).
  const shopEnterPx   = (1 - shopP) * 55;
  const shopExitVh    = contactP * -100;
  // Slide up from bottom + diagonal clip-path
  const contactY  = (1 - contactP) * 100;
  // Diagonal top edge animates in with the slide
  const diagPx    = Math.round((1 - contactP) * 80);

  return (
    <>
      {/* ── Floating perfume ──────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {/* Fade-in wrapper */}
        <div style={{ opacity: appeared ? 1 : 0, transition: 'opacity 1.8s ease' }}>
          {/* Scroll-driven: position + scale */}
          <div style={{
            opacity: floatOpacity,
            transform: `translateX(${floatX}vw) translateY(${floatY}vh) scale(${floatScale})`,
            transformOrigin: 'center center',
          }}>
            {/* Cursor-driven: tilt + float — set via ref in RAF */}
            <img
              ref={heroImgRef}
              src={IMG}
              alt="Libre YSL"
              style={{
                maxHeight: isMobile ? '62vh' : '78vh',
                maxWidth: isMobile ? '82vw' : '55vw',
                objectFit: 'contain', display: 'block',
                willChange: 'transform, filter',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Shop section ──────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingTop: '68px',
        opacity: shopP,
        transform: `translateY(calc(${shopEnterPx}px + ${shopExitVh}vh))`,
        pointerEvents: 'none',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          width: '100%',
          pointerEvents: shopP > 0.6 ? 'auto' : 'none',
        }}>
          <h2 style={{
            fontFamily: 'Georgia, serif', fontWeight: 300,
            fontSize: isMobile ? '1rem' : '1.55rem',
            letterSpacing: isMobile ? '0.2em' : '0.45em',
            color: '#7a5040', marginBottom: '0.5rem',
          }}>
            NUESTRA COLECCIÓN
          </h2>
          <Carousel isMobile={isMobile} />
        </div>
      </div>

      {/* ── Contact section ───────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 30,
        background: '#2e1c14',
        // diagonal top edge: left corner higher than right
        clipPath: `polygon(0 ${diagPx}px, 100% 0, 100% 100%, 0 100%)`,
        transform: `translateY(${contactY}%)`,
        transition: 'none',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '4rem 1.5rem 2.5rem' : '5rem 2rem 3rem',
        pointerEvents: 'none',
        opacity: clamp(contactP * 2, 0, 1),
      }}>
        {/* Subtle warm grain overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 80% 60% at 30% 40%, rgba(196,163,90,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: '560px',
          pointerEvents: contactP > 0.5 ? 'auto' : 'none',
        }}>

          {/* Heading */}
          <div style={{ textAlign: 'center', marginBottom: '2.8rem' }}>
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.35em', color: '#c4a35a', textTransform: 'uppercase', marginBottom: '0.7rem' }}>
              Estamos aquí para vos
            </div>
            <h2 style={{
              fontFamily: 'Georgia, serif', fontWeight: 300,
              fontSize: '2rem', letterSpacing: '0.4em',
              color: '#f5ede8', margin: 0,
            }}>
              CONTACTO
            </h2>
            <div style={{
              margin: '1rem auto 0', width: '48px', height: '1px',
              background: 'linear-gradient(90deg, transparent, #c4a35a, transparent)',
            }} />
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {FIELDS.map(field => {
              const isMsg = field === 'Mensaje';
              const Tag = isMsg ? 'textarea' : 'input';
              return (
                <div key={field} style={{ position: 'relative' }}>
                  <Tag
                    placeholder={field}
                    rows={isMsg ? 4 : undefined}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: 'none',
                      borderBottom: '1px solid rgba(196,163,90,0.35)',
                      borderRadius: isMsg ? '10px' : '0',
                      ...(isMsg ? { border: '1px solid rgba(196,163,90,0.25)', borderRadius: '10px' } : {}),
                      color: '#f5ede8',
                      fontSize: '0.82rem',
                      letterSpacing: '0.06em',
                      padding: isMsg ? '1rem 1.1rem' : '0.85rem 0.2rem',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'Georgia, serif',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              );
            })}

            <button style={{
              marginTop: '0.8rem',
              background: 'linear-gradient(135deg, #bc8f8f 0%, #c4a35a 100%)',
              border: 'none', borderRadius: '30px',
              color: 'white', padding: '0.85rem 0',
              width: '100%', cursor: 'pointer',
              fontSize: '0.68rem', letterSpacing: '0.2em',
              fontFamily: 'Georgia, serif',
              boxShadow: '0 8px 28px rgba(196,163,90,0.22)',
              transition: 'opacity 0.2s ease, transform 0.2s ease',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            >
              ENVIAR MENSAJE
            </button>
          </div>

          {/* Contact info */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: isMobile ? '0.7rem' : '3rem',
            marginTop: '2.2rem',
            fontSize: '0.62rem', letterSpacing: '0.1em',
            color: 'rgba(245,237,232,0.45)',
          }}>
            {[
              ['hola@santhurenit.com', '✉'],
              ['+54 11 5555-0000', '☎'],
              ['Buenos Aires, AR', '◎'],
            ].map(([text, icon]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: '#c4a35a', fontSize: '0.75rem' }}>{icon}</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
