import * as React from 'react';
import { cn } from '@/lib/utils';

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'default' | 'outline' | 'ghost' | 'secondary';
    size?: 'default' | 'sm' | 'lg' | 'icon';
  }
>(({ className, variant = 'default', size = 'default', ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
      variant === 'default' &&
        'bg-primary text-primary-foreground shadow hover:bg-primary/90',
      variant === 'outline' &&
        'border border-border bg-background shadow-sm hover:bg-background/90 hover:text-foreground',
      variant === 'ghost' && 'hover:bg-accent/10 hover:text-accent-foreground',
      variant === 'secondary' &&
        'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
      size === 'default' && 'h-9 px-4 py-2',
      size === 'sm' && 'h-8 px-3 text-xs',
      size === 'lg' && 'h-10 px-8',
      size === 'icon' && 'h-9 w-9',
      className,
    )}
    {...props}
  />
));
Button.displayName = 'Button';

export { Button };
