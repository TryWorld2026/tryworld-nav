import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "16 185 129" -> rgb(16 185 129) */
export function rgb(color: string) {
  return `rgb(${color.replace(/\s+/g, ' ')})`;
}

/** "16 185 129" -> rgba(16 185 129 / .12) */
export function rgbAlpha(color: string, alpha: number) {
  return `rgb(${color.replace(/\s+/g, ' ')} / ${alpha})`;
}
