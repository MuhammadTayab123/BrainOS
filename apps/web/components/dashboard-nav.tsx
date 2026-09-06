"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, UserButton } from "@clerk/nextjs";

export type DashboardNavKey =
  | "chat"
  | "tasks"
  | "reminders"
  | "documents"
  | "memories"
  | "automations";

interface NavItem {
  key: DashboardNavKey;
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "chat", label: "Chat", href: "/dashboard" },
  { key: "tasks", label: "Tasks", href: "/dashboard/tasks" },
  { key: "reminders", label: "Reminders", href: "/dashboard/reminders" },
  { key: "documents", label: "Documents", href: "/dashboard/documents" },
  { key: "memories", label: "Memories", href: "/dashboard/memories" },
  { key: "automations", label: "Automations", href: "/dashboard/automations" },
];

export interface DashboardNavProps {
  current?: DashboardNavKey;
  showUserButton?: boolean;
  orientation?: "horizontal" | "vertical";
}

export function DashboardNav({
  current,
  showUserButton = true,
  orientation = "horizontal",
}: DashboardNavProps) {
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    if (current) {
      return current === item.key;
    }
    if (item.href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname?.startsWith(item.href) ?? false;
  }

  if (orientation === "vertical") {
    return (
      <nav className="flex flex-1 flex-col justify-between w-full" aria-label="Dashboard Navigation">
        <Show when="signed-in">
          <div className="flex flex-col gap-1 w-full">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/60"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {showUserButton && (
            <div className="mt-auto pt-4 border-t border-zinc-800 flex items-center justify-between px-1">
              <span className="text-xs text-zinc-500">Account</span>
              <UserButton />
            </div>
          )}
        </Show>
      </nav>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Show when="signed-in">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border border-zinc-500 bg-zinc-800 text-white"
                  : "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}

        {showUserButton && <UserButton />}
      </Show>
    </div>
  );
}
