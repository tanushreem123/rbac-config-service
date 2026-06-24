'use client';
import { useRouter, usePathname } from 'next/navigation';
import { logout, getSessionUser } from '../lib/auth';

const NAV_LINKS = [
  { href: '/configs',      label: 'Configs'      },
  { href: '/users',        label: 'Users'        },
  { href: '/roles',        label: 'Roles'        },
  { href: '/permissions',  label: 'Permissions'  },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = getSessionUser();

  const handleLogout = async () => {
    await logout();
    window.location.replace('/login');
  };

  return (
    <nav style={{
      background: '#1a1a2e',
      color: 'white',
      padding: '0 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '58px',
      marginBottom: '32px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Left: logo + links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '800', fontSize: '15px', letterSpacing: '0.5px', color: 'white' }}>Authzy</span>
          <span style={{ fontSize: '10px', background: '#3a3a6e', color: '#9ca3af', padding: '2px 6px', borderRadius: '4px', fontWeight: '600', letterSpacing: '0.5px' }}>BETA</span>
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <button key={href} onClick={() => router.push(href)}
                style={{
                  padding: '7px 16px',
                  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: active ? 'white' : '#9ca3af',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: active ? '600' : '400',
                  transition: 'all 0.15s',
                  borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
                }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: user + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {user?.email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'white' }}>
              {user.email[0].toUpperCase()}
            </div>
            <span style={{ fontSize: '12px', color: '#d1d5db', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
          </div>
        )}
        <button onClick={() => router.push('/superadmin')}
          style={{ padding: '6px 12px', background: 'rgba(240,165,0,0.12)', color: '#f0a500', border: '1px solid rgba(240,165,0,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
          Platform Admin
        </button>
        <button onClick={handleLogout}
          style={{ padding: '6px 14px', background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
          Logout
        </button>
      </div>
    </nav>
  );
}
