"use client";

import { Sparkles, LayoutDashboard, FileText, LogOut } from "lucide-react";
import { UsageSummary, UserProfile } from "@/types";

interface SidebarProps {
  user: UserProfile | null;
  onSignOut: () => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  usage?: UsageSummary | null;
}

export function Sidebar({ user, onSignOut, activeTab = "dashboard", setActiveTab, usage }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-zinc-200 hidden md:flex flex-col h-full">
      <div className="p-6 flex items-center gap-3 border-b border-zinc-100">
        <div className="bg-zinc-900 p-2 rounded-xl">
          <Sparkles className="text-white w-5 h-5" />
        </div>
        <span className="font-bold text-lg tracking-tight text-zinc-900">
          VoxScribe
        </span>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <button
          onClick={() => setActiveTab?.("dashboard")}
          className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-xl font-medium transition-colors ${
            activeTab === "dashboard"
              ? "bg-zinc-100 text-zinc-900 font-semibold"
              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab?.("history")}
          className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-xl font-medium transition-colors ${
            activeTab === "history"
              ? "bg-zinc-100 text-zinc-900 font-semibold"
              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
          }`}
        >
          <FileText className="w-5 h-5" />
          My History
        </button>
      </nav>

      {usage && <UsageMeter usage={usage} />}

      {user && (
        <div className="p-4 border-t border-zinc-100">
          <div className="px-4 py-3 bg-zinc-50 rounded-xl mb-4">
            <p className="text-xs text-zinc-500 font-medium mb-1">
              Signed in as
            </p>
            <p className="text-sm font-semibold truncate">{user.email}</p>
          </div>
          <button
            onClick={onSignOut}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-zinc-500 hover:bg-zinc-50 hover:text-red-600 rounded-xl font-medium transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      )}
    </aside>
  );
}

export function MobileNav({ onSignOut, activeTab = "dashboard", setActiveTab }: SidebarProps) {
  const tabClass = (tab: string) =>
    `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
      activeTab === tab ? "bg-zinc-100 text-zinc-900" : "text-zinc-500"
    }`;

  return (
    <div className="md:hidden sticky top-0 z-10 bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-2">
      <div className="bg-zinc-900 p-1.5 rounded-lg mr-auto">
        <Sparkles className="text-white w-4 h-4" />
      </div>
      <button onClick={() => setActiveTab?.("dashboard")} className={tabClass("dashboard")}>
        <LayoutDashboard className="w-4 h-4" />
        Dashboard
      </button>
      <button onClick={() => setActiveTab?.("history")} className={tabClass("history")}>
        <FileText className="w-4 h-4" />
        History
      </button>
      <button
        onClick={onSignOut}
        aria-label="Sign out"
        className="p-2 rounded-xl text-zinc-500 hover:text-red-600"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}

function UsageMeter({ usage }: { usage: UsageSummary }) {
  const limited = usage.daily_limit > 0;
  const percent = limited ? Math.min(100, (usage.generations_last_24h / usage.daily_limit) * 100) : 0;

  return (
    <div className="mx-4 mb-4 p-4 bg-zinc-50 rounded-xl text-xs">
      <p className="font-semibold text-zinc-700 mb-2">Usage</p>
      {limited && (
        <>
          <div className="flex justify-between text-zinc-500 mb-1">
            <span>Generations (24h)</span>
            <span className="font-medium text-zinc-700">
              {usage.generations_last_24h} / {usage.daily_limit}
            </span>
          </div>
          <div
            className="h-1.5 bg-zinc-200 rounded-full overflow-hidden mb-3"
            role="progressbar"
            aria-valuenow={usage.generations_last_24h}
            aria-valuemax={usage.daily_limit}
          >
            <div
              className={`h-full rounded-full ${percent >= 90 ? "bg-red-500" : "bg-indigo-500"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </>
      )}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{usage.total_posts}</p>
          <p className="text-zinc-500">Posts</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">{usage.voices}</p>
          <p className="text-zinc-500">Voices</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">{usage.samples}</p>
          <p className="text-zinc-500">Samples</p>
        </div>
      </div>
    </div>
  );
}
