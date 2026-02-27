import type { ReactNode } from 'react';

interface TypographyProps {
  children: ReactNode;
  className?: string;
}

export function H1({ children, className = '' }: TypographyProps) {
  return (
    <h1 className={`font-heading font-normal text-dark text-[50px] leading-[1.15] md:text-[32px] ${className}`}>
      {children}
    </h1>
  );
}

export function H2({ children, className = '' }: TypographyProps) {
  return (
    <h2 className={`font-heading font-normal text-dark text-[38px] leading-[1.2] md:text-[28px] ${className}`}>
      {children}
    </h2>
  );
}

export function H3({ children, className = '' }: TypographyProps) {
  return (
    <h3 className={`font-heading font-normal text-dark text-[26px] leading-[1.3] md:text-[22px] ${className}`}>
      {children}
    </h3>
  );
}

export function H4({ children, className = '' }: TypographyProps) {
  return (
    <h4 className={`font-heading font-normal text-dark text-[19px] leading-[1.4] ${className}`}>
      {children}
    </h4>
  );
}

export function Body({ children, className = '' }: TypographyProps) {
  return (
    <p className={`font-body font-light text-gray text-base leading-[1.65] ${className}`}>
      {children}
    </p>
  );
}

export function Label({ children, className = '' }: TypographyProps) {
  return (
    <span className={`font-body font-bold text-lightGray text-[11px] uppercase tracking-[2.5px] ${className}`}>
      {children}
    </span>
  );
}

export function Caption({ children, className = '' }: TypographyProps) {
  return (
    <span className={`font-body font-light text-lightGray text-sm ${className}`}>
      {children}
    </span>
  );
}
