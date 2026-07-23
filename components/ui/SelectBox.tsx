"use client";

import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MenuPosition = {
  left: number;
  top: number;
  width: number;
};

type SelectBoxProps = {
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  disabled?: boolean;
};

export default function SelectBox({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  ariaLabel,
  placeholder = "Select an option",
  className,
  menuClassName,
  disabled = false,
}: SelectBoxProps) {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? options.find((option) => !option.disabled)?.value ?? "",
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const currentValue = value ?? internalValue;
  const selectedIndex = options.findIndex(
    (option) => option.value === currentValue,
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuHeight = Math.min(248, options.length * 42 + 12);
    const longestLabelLength = options.reduce(
      (longest, option) => Math.max(longest, option.label.length),
      0,
    );
    const contentWidth = Math.min(280, longestLabelLength * 8 + 58);
    const width = Math.min(
      window.innerWidth - 16,
      Math.max(rect.width, contentWidth),
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < menuHeight + 12 && rect.top > menuHeight;
    const alignToRight = rect.left + width > window.innerWidth - 8;
    const preferredLeft = alignToRight ? rect.right - width : rect.left;
    const left = Math.max(8, Math.min(preferredLeft, window.innerWidth - width - 8));

    setMenuPosition({
      left,
      top: openAbove
        ? Math.max(8, rect.top - menuHeight - 6)
        : rect.bottom + 6,
      width,
    });
  }, [options]);

  const openMenu = useCallback(() => {
    if (disabled || options.length === 0) {
      return;
    }

    updateMenuPosition();
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [disabled, options.length, selectedIndex, updateMenuPosition]);

  const commitValue = useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onValueChange, value],
  );

  const moveActive = (direction: 1 | -1) => {
    if (options.length === 0) {
      return;
    }

    let nextIndex = activeIndex;
    for (let step = 0; step < options.length; step += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length;
      if (!options[nextIndex]?.disabled) {
        setActiveIndex(nextIndex);
        return;
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) {
        openMenu();
      }
      const orderedOptions =
        event.key === "Home" ? options : [...options].reverse();
      const target = orderedOptions.find((option) => !option.disabled);
      const targetIndex = options.findIndex(
        (option) => option.value === target?.value,
      );
      if (targetIndex >= 0) {
        setActiveIndex(targetIndex);
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else {
        const activeOption = options[activeIndex];
        if (activeOption && !activeOption.disabled) {
          commitValue(activeOption.value);
        }
      }
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    if (event.key.length === 1 && /\S/.test(event.key)) {
      const query = event.key.toLocaleLowerCase();
      const matchIndex = options.findIndex(
        (option) =>
          !option.disabled &&
          option.label.toLocaleLowerCase().startsWith(query),
      );
      if (matchIndex >= 0) {
        if (!open) {
          openMenu();
        }
        setActiveIndex(matchIndex);
      }
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleViewportChange = () => updateMenuPosition();

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updateMenuPosition]);

  const menuStyle: CSSProperties | undefined = menuPosition
    ? {
        left: menuPosition.left,
        top: menuPosition.top,
        width: menuPosition.width,
      }
    : undefined;

  return (
    <>
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open ? `${listboxId}-option-${activeIndex}` : undefined
        }
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openMenu();
          }
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-[#20304b] outline-none transition hover:border-[#b8dfe0] focus-visible:border-[#00aeb5] focus-visible:ring-4 focus-visible:ring-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2b4352] dark:bg-[#0a1923] dark:text-[#e6eef5] dark:hover:border-cyan-800",
          className,
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            !selectedOption && "text-slate-400",
          )}
        >
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 dark:text-slate-500",
            open && "rotate-180 text-[#009ca4] dark:text-cyan-300",
          )}
          aria-hidden="true"
        />
      </button>

      {open && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              style={menuStyle}
              className={cn(
                "fixed z-[120] max-h-60 overflow-x-hidden overflow-y-auto rounded-xl border border-[#d7e2eb] bg-white p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.18)] dark:border-[#304957] dark:bg-[#102432] dark:shadow-[0_22px_54px_rgba(0,0,0,0.48)]",
                menuClassName,
              )}
            >
              {options.map((option, index) => {
                const selected = option.value === currentValue;
                const active = index === activeIndex;

                return (
                  <button
                    key={option.value}
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    tabIndex={-1}
                    onPointerMove={() => setActiveIndex(index)}
                    onClick={() => commitValue(option.value)}
                    className={cn(
                      "flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[#34445f] outline-none transition",
                      active &&
                        "bg-[#eef8f8] text-[#007f86] dark:bg-cyan-950/70 dark:text-cyan-200",
                      selected &&
                        "bg-[#e2f5f4] font-bold text-[#007f86] dark:bg-cyan-950 dark:text-cyan-200",
                      !active &&
                        !selected &&
                        "hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#18313f]",
                      option.disabled &&
                        "cursor-not-allowed opacity-45 hover:bg-transparent",
                    )}
                  >
                    <span className="min-w-0 flex-1 whitespace-nowrap">
                      {option.label}
                    </span>
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0 text-[#009ca4] dark:text-cyan-300",
                        !selected && "invisible",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
