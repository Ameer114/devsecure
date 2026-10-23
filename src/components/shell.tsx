"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { FolderGit2, LayoutDashboard, Mail, Moon, Rocket, ScrollText, Settings, ShieldAlert, Sun, Workflow } from "lucide-react";

const NAV = [
  { href: "/", label: "Release gate", icon: LayoutDashboard },
  { href: "/repositories", label: "Repositories", icon: FolderGit2 },
  { href: "/pipelines", label: "Pipelines", icon: Workflow },
  { href: "/findings", label: "Findings", icon: ShieldAlert },
  { href: "/notifications", label: "Notifications", icon: Mail },
  { href: "/deployments", label: "Deployments", icon: Rocket },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/configuration", label: "Configuration", icon: Settings },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle light and dark mode"
      className="inline-flex size-9 items-center justify-center rounded-md border border-line text-muted hover:text-ink"
    >
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
    </button>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="md:grid md:min-h-screen md:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-surface md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-5">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            SecureShip <span className="text-accent">AI</span>
          </Link>
          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </div>
        <nav aria-label="Primary" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-3 md:pb-4">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap ${
                  active ? "bg-accent/10 font-semibold text-accent" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-5 py-4 md:block">
          <ThemeToggle />
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-10 md:py-9">{children}</main>
    </div>
  );
}
