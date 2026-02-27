import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = '', ...props }: SelectProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block font-body font-bold text-lightGray text-[11px] uppercase tracking-[2.5px] mb-2">
          {label}
        </label>
      )}
      <select
        className="
          w-full font-body font-light text-base text-dark
          px-5 py-3.5 pr-12
          border-[1.5px] border-border rounded-md
          bg-white bg-no-repeat bg-[right_16px_center]
          appearance-none cursor-pointer
          focus:border-green focus:outline-none
          transition-colors duration-200
        "
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        }}
        {...props}
      >
        {props.children}
      </select>
    </div>
  );
}
