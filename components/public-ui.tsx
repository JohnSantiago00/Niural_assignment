import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
};

const buttonBase =
  "inline-flex items-center justify-center rounded-full font-semibold tracking-[-0.01em] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const buttonVariants = {
  primary:
    "bg-ink text-white shadow-soft hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-glow",
  secondary:
    "border border-line/80 bg-white/80 text-ink shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-soft",
  ghost: "text-slate-600 hover:text-ink"
};

const buttonSizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base"
};

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps & ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      href={href}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function PublicContainer({
  className,
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return <section className={cn("mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8", className)}>{children}</section>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-bold uppercase tracking-[0.22em] text-accent", className)}>
      {children}
    </p>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line/70 bg-white/75 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm",
        className
      )}
    >
      {children}
    </span>
  );
}

export function SurfaceCard({
  className,
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[2rem] border border-line/70 bg-white/85 shadow-soft backdrop-blur",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PublicHero({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-line/70 bg-hero p-8 shadow-soft sm:p-10 lg:p-12">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
      <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
      <div className="relative max-w-3xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.06em] text-ink sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-base leading-8 text-slate-600 sm:text-lg">
          {description}
        </p>
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </div>
  );
}
