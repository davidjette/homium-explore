import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './Button';
import { useAuthContext } from '../components/shared/AuthProvider';

/** Landing page nav — section anchors + tool link + sign in CTA */
export function LandingNav() {
  const { isAuthenticated, signInWithGoogle, signOut, profile, loading } = useAuthContext();

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-[1100px] mx-auto px-7 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center">
          <img src={import.meta.env.BASE_URL + 'homium-wordmark.svg'} alt="Homium" className="h-7" />
        </Link>
        <div className="hidden sm:flex items-center gap-8">
          <AnchorLink href="#programs">Programs</AnchorLink>
          <AnchorLink href="#news">News</AnchorLink>
          <AnchorLink href="#affordability">Affordability Tool</AnchorLink>
          {!loading && (
            isAuthenticated ? (
              <UserMenu
                name={profile?.name || profile?.email || ''}
                avatarUrl={profile?.avatar_url}
                onSignOut={signOut}
              />
            ) : (
              <Button size="sm" onClick={signInWithGoogle}>
                Sign In
              </Button>
            )
          )}
        </div>
      </div>
    </nav>
  );
}

/** Tool pages nav — route-based links + auth */
export function ToolNav() {
  const { pathname } = useLocation();
  const { isAuthenticated, signInWithGoogle, signOut, profile, loading } = useAuthContext();

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-[1100px] mx-auto px-7 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center">
          <img src={import.meta.env.BASE_URL + 'homium-wordmark.svg'} alt="Homium" className="h-7" />
        </Link>
        <div className="hidden sm:flex items-center gap-8">
          <RouteLink to="/explore" active={pathname === '/explore'}>Explore</RouteLink>
          <RouteLink to="/design" active={pathname === '/design'}>Design</RouteLink>
          <RouteLink to="/program" active={pathname === '/program'}>Program</RouteLink>
          {isAuthenticated && (
            <RouteLink to="/dashboard" active={pathname === '/dashboard'}>My Designs</RouteLink>
          )}
          {!loading && (
            isAuthenticated ? (
              <UserMenu
                name={profile?.name || profile?.email || ''}
                avatarUrl={profile?.avatar_url}
                onSignOut={signOut}
              />
            ) : (
              <Button size="sm" onClick={signInWithGoogle}>
                Sign In
              </Button>
            )
          )}
        </div>
      </div>
    </nav>
  );
}

/** Backward-compat export (alias for ToolNav) */
export const Nav = ToolNav;

/** User avatar + dropdown menu */
function UserMenu({ name, avatarUrl, onSignOut }: { name: string; avatarUrl?: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 cursor-pointer"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-green text-white flex items-center justify-center font-body text-xs font-bold">
            {initials}
          </div>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
            <div className="px-4 py-2 border-b border-border">
              <p className="font-body text-sm font-medium text-dark truncate">{name}</p>
            </div>
            <Link
              to="/dashboard"
              className="block px-4 py-2 font-body text-sm text-gray hover:bg-sectionAlt hover:text-dark transition-colors"
              onClick={() => setOpen(false)}
            >
              My Designs
            </Link>
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="w-full text-left px-4 py-2 font-body text-sm text-gray hover:bg-sectionAlt hover:text-dark transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AnchorLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="font-body font-bold text-[12px] uppercase tracking-[1.5px] text-gray hover:text-green transition-colors duration-200"
    >
      {children}
    </a>
  );
}

function RouteLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={`font-body font-bold text-[12px] uppercase tracking-[1.5px] transition-colors duration-200 ${
        active ? 'text-green' : 'text-gray hover:text-green'
      }`}
    >
      {children}
    </Link>
  );
}

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`max-w-[1100px] mx-auto px-7 ${className}`}>
      {children}
    </div>
  );
}

export function Section({ children, className = '', alt = false, id }: {
  children: ReactNode;
  className?: string;
  alt?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`py-[88px] ${alt ? 'bg-sectionAlt' : 'bg-white'} ${className}`}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-dark text-white/70 py-16">
      <Container>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={import.meta.env.BASE_URL + 'homium-wordmark.svg'} alt="Homium" className="h-6 brightness-0 invert" />
            </div>
            <p className="font-body font-light text-sm max-w-xs">
              Shared appreciation mortgages that make homeownership accessible while creating sustainable returns.
            </p>
          </div>
          <div className="font-body text-sm">
            <p>&copy; {new Date().getFullYear()} Homium, Inc.</p>
            <a
              href="https://www.homium.io"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-white/40 hover:text-white/60 transition-colors block"
            >
              homium.io
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
