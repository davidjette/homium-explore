import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'text';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variantClasses = {
  solid: 'bg-green text-white hover:bg-greenDark border-transparent',
  outline: 'bg-transparent text-green border-green hover:bg-green hover:text-white',
  text: 'bg-transparent text-green border-transparent hover:text-greenDark underline underline-offset-4',
} as const;

const sizeClasses = {
  sm: 'px-4 py-2 text-[11px]',
  md: 'px-[22px] py-[11px] text-[12px]',
  lg: 'px-8 py-4 text-[13px]',
} as const;

export function Button({ variant = 'solid', size = 'md', children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`
        font-body font-bold uppercase tracking-[1.5px]
        rounded border-[1.5px] transition-all duration-200
        cursor-pointer inline-flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}

interface LinkButtonProps {
  href: string;
  variant?: 'solid' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

export function LinkButton({ href, variant = 'solid', size = 'md', children, className = '' }: LinkButtonProps) {
  return (
    <a
      href={href}
      className={`
        font-body font-bold uppercase tracking-[1.5px]
        rounded border-[1.5px] transition-all duration-200
        cursor-pointer inline-flex items-center justify-center gap-2 no-underline
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {children}
    </a>
  );
}
