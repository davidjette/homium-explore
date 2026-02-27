import type { ReactNode } from 'react';
import { Label } from './Typography';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white border border-border rounded-lg p-10 ${className}`}>
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  className?: string;
}

export function StatCard({ label, value, className = '' }: StatCardProps) {
  return (
    <div className={`bg-white/90 border border-border rounded-lg px-4 py-4 ${className}`}>
      <Label>{label}</Label>
      <div className="font-heading text-dark text-2xl mt-1">{value}</div>
    </div>
  );
}

interface GapCardProps {
  label: string;
  value: string;
  subtitle?: string;
  className?: string;
}

export function GapCard({ label, value, subtitle, className = '' }: GapCardProps) {
  return (
    <div className={`bg-greenLight border-2 border-green rounded-lg px-7 py-5 ${className}`}>
      <Label className="text-green">{label}</Label>
      <div className="font-heading text-green text-[44px] leading-tight mt-1">{value}</div>
      {subtitle && <p className="font-body font-light text-gray text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  description?: string;
  className?: string;
}

export function MetricCard({ label, value, description, className = '' }: MetricCardProps) {
  return (
    <div className={`text-center ${className}`}>
      <Label>{label}</Label>
      <div className="font-heading text-dark text-[38px] leading-tight mt-2">{value}</div>
      {description && (
        <p className="font-body font-light text-gray text-sm mt-2 max-w-xs mx-auto">{description}</p>
      )}
    </div>
  );
}
