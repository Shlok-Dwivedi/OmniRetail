import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

// A segmented control whose thumb slides to the selected segment. As a tablist it switches
// views (arrow keys move between tabs); as a group its segments are toggle buttons.
export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  tabs = false,
  className = '',
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  tabs?: boolean;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const [settled, setSettled] = useState(false);
  const index = options.findIndex((o) => o.value === value);
  useLayoutEffect(() => {
    const element = track.current;
    if (!element) return;
    const measure = () => {
      const button = element.querySelectorAll<HTMLButtonElement>('button')[index];
      setThumb(button ? { left: button.offsetLeft, width: button.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [index, options.length]);
  useLayoutEffect(() => {
    // Let the first measurement land without animating the thumb in from the left edge.
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!tabs || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = (Math.max(index, 0) + step + options.length) % options.length;
    onChange(options[next].value);
    track.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  }
  return (
    <div
      ref={track}
      className={`segmented ${settled ? 'settled' : ''} ${className}`}
      role={tabs ? 'tablist' : 'group'}
      aria-label={label}
    >
      {thumb && (
        <span
          className="segmented-thumb"
          aria-hidden="true"
          style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
        />
      )}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            type="button"
            key={option.value}
            className={selected ? 'selected' : ''}
            role={tabs ? 'tab' : undefined}
            aria-selected={tabs ? selected : undefined}
            aria-pressed={tabs ? undefined : selected}
            tabIndex={tabs && !selected ? -1 : undefined}
            onKeyDown={onKeyDown}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
