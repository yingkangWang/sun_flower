// user_magicui / Magic UI (MIT), via motionsites registry. Source snapshot in references/magicui.
// Added type-safe props, keyboard parity and reduced-motion support for the local exhibition.
import type { ButtonHTMLAttributes } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";

export type InteractiveHoverButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement>;

export function InteractiveHoverButton({
  children,
  className,
  type = "button",
  ...props
}: InteractiveHoverButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "interactive-hover-button group relative isolate w-auto cursor-pointer overflow-hidden rounded-full border border-border bg-background px-7 py-4 text-center font-medium text-foreground transition-colors disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="flex items-center justify-center gap-3">
        <span
          aria-hidden="true"
          className="hover-dot h-2 w-2 rounded-full bg-primary transition-transform duration-500 group-hover:scale-[100.8] group-focus-visible:scale-[100.8]"
        />
        <span className="hover-label inline-block transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0 group-focus-visible:translate-x-12 group-focus-visible:opacity-0">
          {children}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="hover-arrival absolute inset-0 z-10 flex translate-x-12 items-center justify-center gap-3 text-primary-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
      >
        <span>{children}</span>
        <ArrowRight size={18} strokeWidth={1.6} />
      </span>
    </button>
  );
}
