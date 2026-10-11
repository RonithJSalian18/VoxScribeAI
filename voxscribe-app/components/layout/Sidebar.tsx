"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  AudioLines,
  Check,
  ChevronsUpDown,
  Laptop,
  Library,
  LogOut,
  Moon,
  PenSquare,
  Sun,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { UsageSummary, UserProfile } from "@/types";

export type AppView = "create" | "voices" | "library";

export const NAV_ITEMS: { id: AppView; label: string; icon: LucideIcon; description: string }[] = [
  { id: "create", label: "Create", icon: PenSquare, description: "Generate new content" },
  { id: "voices", label: "Brand Voices", icon: AudioLines, description: "Train your writing style" },
  { id: "library", label: "Library", icon: Library, description: "Your generated content" },
];

interface ShellProps {
  user: UserProfile;
  view: AppView;
  onNavigate: (view: AppView) => void;
  onSignOut: () => void;
  usage?: UsageSummary | null;
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-sm shadow-primary/30">
        <AudioLines className="h-4 w-4" strokeWidth={2.5} />
      </div>
      <span className="text-[15px] font-semibold tracking-tight">VoxScribe</span>
    </div>
  );
}

const initialOf = (email?: string) => (email ? email.charAt(0).toUpperCase() : "U");

function UserMenu({ user, onSignOut, compact = false }: { user: UserProfile; onSignOut: () => void; compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const themes: { value: string; label: string; icon: LucideIcon }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Laptop },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-3 rounded-xl text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "p-1" : "w-full p-2",
        )}
        aria-label="Account menu"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-fuchsia-500/80 text-sm font-semibold text-white">
          {initialOf(user.email)}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.email?.split("@")[0]}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-60 rounded-xl">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        {themes.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)} className="gap-2">
            <Icon className="h-4 w-4" />
            {label}
            {mounted && theme === value && <Check className="ml-auto h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut} className="gap-2 text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UsageMeter({ usage }: { usage: UsageSummary }) {
  const limited = usage.daily_limit > 0;
  const percent = limited ? Math.min(100, (usage.generations_last_24h / usage.daily_limit) * 100) : 0;

  return (
    <div className="rounded-xl border bg-card p-3.5 text-xs">
      {limited && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Daily generations</span>
            <span className="tabular-nums text-muted-foreground">
              {usage.generations_last_24h}/{usage.daily_limit}
            </span>
          </div>
          <div
            className="mb-3 h-1.5 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-label="Daily generations used"
            aria-valuenow={usage.generations_last_24h}
            aria-valuemin={0}
            aria-valuemax={usage.daily_limit}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                percent >= 90 ? "bg-destructive" : "bg-gradient-to-r from-primary to-fuchsia-500",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </>
      )}
      <div className="grid grid-cols-3 divide-x text-center">
        {[
          [usage.total_posts, "Posts"],
          [usage.voices, "Voices"],
          [usage.samples, "Samples"],
        ].map(([value, label]) => (
          <div key={label}>
            <p className="text-sm font-semibold tabular-nums">{value}</p>
            <p className="text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sidebar({ user, view, onNavigate, onSignOut, usage }: ShellProps) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/50 md:flex">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="space-y-3 p-3">
        {usage && <UsageMeter usage={usage} />}
        <UserMenu user={user} onSignOut={onSignOut} />
      </div>
    </aside>
  );
}

/** Top bar shown on small screens. */
export function MobileHeader({ user, onSignOut }: Pick<ShellProps, "user" | "onSignOut">) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-lg md:hidden">
      <Logo />
      <UserMenu user={user} onSignOut={onSignOut} compact />
    </header>
  );
}

/** Bottom tab bar shown on small screens. */
export function MobileTabBar({ view, onNavigate }: Pick<ShellProps, "view" | "onNavigate">) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
