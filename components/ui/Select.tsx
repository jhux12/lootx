import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

type OptionData = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type SelectProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'className'> & {
  value?: string | number;
  onChange?: (event: { target: { value: string } }) => void;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  children: React.ReactNode;
  className?: string;
  wrapperClassName?: string;
  buttonClassName?: string;
  listClassName?: string;
};

const getOptions = (children: React.ReactNode): OptionData[] => {
  return React.Children.toArray(children)
    .map((child) => {
      if (!React.isValidElement(child) || child.type !== 'option') return null;
      const optionValue = String(child.props.value ?? '');
      return {
        value: optionValue,
        label: child.props.children,
        disabled: child.props.disabled
      };
    })
    .filter(Boolean) as OptionData[];
};

export const Select: React.FC<SelectProps> = ({
  value = '',
  onChange,
  name,
  disabled,
  placeholder = 'Select an option',
  children,
  className,
  wrapperClassName,
  buttonClassName,
  listClassName,
  ...props
}) => {
  const options = useMemo(() => getOptions(children), [children]);
  const normalizedValue = value === null || value === undefined ? '' : String(value);
  const selectedOption = options.find((option) => option.value === normalizedValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => options.findIndex((option) => option.value === normalizedValue));
  const listboxId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const buttonEl = buttonRef.current;
      if (!buttonEl) return;
      const rect = buttonEl.getBoundingClientRect();
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        zIndex: 60
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    setActiveIndex(options.findIndex((option) => option.value === normalizedValue));
  }, [options, normalizedValue]);

  const handleSelect = (nextValue: string) => {
    if (disabled) return;
    onChange?.({ target: { value: nextValue } });
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (prev >= 0 ? prev : 0));
      return;
    }
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, options.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option && !option.disabled) {
        handleSelect(option.value);
      }
    }
  };

  const triggerClasses =
    'flex w-full items-center justify-between gap-3 !rounded-[14px] border !border-white/10 !bg-[#0b101a] px-4 py-2.5 text-left text-sm !text-white/90 shadow-sm transition hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-50';
  const listClasses =
    'max-h-64 overflow-auto rounded-[16px] border border-white/10 bg-[#0b101a]/95 p-2 text-sm text-white/90 shadow-2xl backdrop-blur';
  const optionClasses =
    'flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left transition hover:bg-white/5 focus:outline-none';

  const listbox = open ? (
    <div ref={listRef} style={menuStyle} className={[listClasses, listClassName].filter(Boolean).join(' ')}>
      <div
        role="listbox"
        id={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
      >
        {options.map((option, index) => {
          const isSelected = option.value === normalizedValue;
          const isActive = index === activeIndex;
          return (
            <button
              key={option.value}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={option.disabled}
              onClick={() => handleSelect(option.value)}
              onMouseEnter={() => setActiveIndex(index)}
              className={[
                optionClasses,
                isSelected ? 'bg-white/10 text-white' : '',
                isActive ? 'bg-white/5' : '',
                option.disabled ? 'cursor-not-allowed opacity-50' : '',
                'focus:bg-white/10'
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className={wrapperClassName} {...props}>
      {name && <input type="hidden" name={name} value={normalizedValue} />}
      <button
        ref={buttonRef}
        type="button"
        className={[triggerClasses, className, buttonClassName].filter(Boolean).join(' ')}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
      >
        <span className={selectedOption ? 'text-white/90' : 'text-white/40'}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-white/60 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? createPortal(listbox, document.body) : null}
    </div>
  );
};
