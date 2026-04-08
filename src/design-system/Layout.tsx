import { type ReactNode, useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './Button';
import { useAuthContext } from '../components/shared/AuthProvider';
import SignInModal from '../components/shared/SignInModal';

/** Landing page nav — section anchors + tool link + sign in CTA */
export function LandingNav() {
  const { isAuthenticated, isAdmin, signOut, profile, loading } = useAuthContext();
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <>
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
                  isAdmin={isAdmin}
                  onSignOut={signOut}
                />
              ) : (
                <Button size="sm" onClick={() => setShowSignIn(true)}>
                  Sign In
                </Button>
              )
            )}
          </div>
        </div>
      </nav>
      {showSignIn && <SignInModal modal onClose={() => setShowSignIn(false)} />}
    </>
  );
}

/** Tool pages nav — route-based links + auth */
export function ToolNav() {
  const { pathname } = useLocation();
  const { isAuthenticated, isAdmin, isTeam, signOut, profile, loading } = useAuthContext();
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <>
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
            {isAuthenticated && isTeam && (
              <RouteLink to="/data" active={pathname === '/data'}>Data</RouteLink>
            )}
            {isAuthenticated && isTeam && (
              <NavDropdown
                label="Tools"
                active={pathname.startsWith('/tools')}
                items={[
                  { label: 'UDF: Check Address', to: '/tools/check-address' },
                ]}
              />
            )}
            {isAuthenticated && isAdmin && (
              <RouteLink to="/admin" active={pathname === '/admin'}>Admin</RouteLink>
            )}
            {!loading && (
              isAuthenticated ? (
                <UserMenu
                  name={profile?.name || profile?.email || ''}
                  avatarUrl={profile?.avatar_url}
                  isAdmin={isAdmin}
                  onSignOut={signOut}
                />
              ) : (
                <Button size="sm" onClick={() => setShowSignIn(true)}>
                  Sign In
                </Button>
              )
            )}
          </div>
        </div>
      </nav>
      {showSignIn && <SignInModal modal onClose={() => setShowSignIn(false)} />}
    </>
  );
}

/** Backward-compat export (alias for ToolNav) */
export const Nav = ToolNav;

/** User avatar + dropdown menu */
function UserMenu({ name, avatarUrl, isAdmin, onSignOut }: { name: string; avatarUrl?: string; isAdmin?: boolean; onSignOut: () => void }) {
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
            {isAdmin && (
              <Link
                to="/admin"
                className="block px-4 py-2 font-body text-sm text-gray hover:bg-sectionAlt hover:text-dark transition-colors"
                onClick={() => setOpen(false)}
              >
                Manage Users
              </Link>
            )}
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

function NavDropdown({ label, active, items }: {
  label: string;
  active: boolean;
  items: { label: string; to: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`font-body font-bold text-[12px] uppercase tracking-[1.5px] transition-colors duration-200 cursor-pointer ${
          active ? 'text-green' : 'text-gray hover:text-green'
        }`}
      >
        {label}
        <svg className="inline-block ml-1 w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-50 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[200px]">
          {items.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="block px-4 py-2 font-body text-sm text-gray hover:bg-sectionAlt hover:text-dark transition-colors"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
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
          <div className="font-body text-sm text-right">
            <p>&copy; 2025 Homium, Inc. NMLS #2442369</p>
            <p className="mt-1">Peter C. Gilbert, Chief Lending and Credit Officer, NMLS #136556</p>
            <p className="mt-2">
              For additional consumer information, please visit{' '}
              <a
                href="https://www.nmlsconsumeraccess.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white/60 transition-colors underline"
              >
                NMLSConsumerAccess.org
              </a>
            </p>
            <a
              href="https://www.homium.io"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-white/40 hover:text-white/60 transition-colors block"
            >
              homium.io
            </a>
          </div>
        </div>
        <div className="mt-10 pt-8 border-t border-white/10">
          <p className="font-body text-xs text-white/40 leading-relaxed">
            The material on this website is for informational purposes only and may not be used, published or redistributed without the prior written consent of Homium, LLC or its affiliates (collectively, &ldquo;Homium&rdquo;).
          </p>
          <p className="font-body text-xs text-white/40 leading-relaxed mt-4">
            Nothing herein is an offer to sell or solicitation of an offer to purchase a security. Any such offer will only be made to qualified investors via a private placement memorandum in an offering exempt from registration with the Securities and Exchange Commission (&ldquo;SEC&rdquo;). This material and the digital assets mentioned herein have not been approved or disapproved by the SEC or any state securities regulatory authority.
          </p>
          <p className="font-body text-xs text-white/40 leading-relaxed mt-4">
            The information and opinions expressed herein are provided in good faith and with a reasonable basis, however, Homium makes no representations and gives no warranties of any nature including but not limited to the accuracy, relevance or completeness of such information. Likewise, certain information herein has been obtained from third parties believed to be reliable, but we do not warrant the accuracy or completeness of such information. We have made certain assumptions in conducting this analysis that we believe to be reasonable, but other assumptions might produce different results. The details of all assumptions are available upon request.
          </p>
          <p className="font-body text-xs text-white/40 leading-relaxed mt-4">
            This material does not take into account the investment objectives, financial situation or needs of particular investors. Investors should conduct their own independent diligence and assessment and consider whether this is suitable for your particular circumstances and consult with relevant professional advisors before investing.
          </p>
        </div>
      </Container>
    </footer>
  );
}
