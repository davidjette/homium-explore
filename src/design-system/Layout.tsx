import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

/** Landing page nav — section anchors + tool link */
export function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-[1100px] mx-auto px-7 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center">
          <img src="/homium-wordmark.svg" alt="Homium" className="h-7" />
        </Link>
        <div className="hidden sm:flex items-center gap-8">
          <AnchorLink href="#programs">Programs</AnchorLink>
          <AnchorLink href="#news">News</AnchorLink>
          <Link
            to="/explore"
            className="font-body font-bold text-[12px] uppercase tracking-[1.5px] bg-green text-white px-4 py-2 rounded-md hover:bg-greenDark transition-colors"
          >
            Affordability Tool
          </Link>
        </div>
      </div>
    </nav>
  );
}

/** Tool pages nav — route-based links */
export function ToolNav() {
  const { pathname } = useLocation();
  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-[1100px] mx-auto px-7 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center">
          <img src="/homium-wordmark.svg" alt="Homium" className="h-7" />
        </Link>
        <div className="hidden sm:flex items-center gap-8">
          <RouteLink to="/explore" active={pathname === '/explore'}>Explore</RouteLink>
          <RouteLink to="/design" active={pathname === '/design'}>Design</RouteLink>
          <RouteLink to="/program" active={pathname === '/program'}>Program</RouteLink>
        </div>
      </div>
    </nav>
  );
}

/** Backward-compat export (alias for ToolNav) */
export const Nav = ToolNav;

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
              <img src="/homium-wordmark.svg" alt="Homium" className="h-6 brightness-0 invert" />
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
