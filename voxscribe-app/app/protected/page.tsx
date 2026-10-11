import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShieldCheck, User, Server } from "lucide-react";
import { Suspense } from "react";

async function UserDetails() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return JSON.stringify(data.claims, null, 2);
}

export default function ProtectedPage() {
  return (
    <div className="flex-1 w-full max-w-4xl mx-auto p-6 md:p-10 flex flex-col gap-8">
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-4 px-5 rounded-2xl flex gap-3 items-center shadow-sm">
        <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
        <p className="font-medium">
          Protected Area: You are securely authenticated with VoxScribe AI session token.
        </p>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-zinc-100 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <User className="w-6 h-6 text-indigo-600" />
          <h2 className="font-bold text-2xl tracking-tight">User Session Claims</h2>
        </div>
        <pre className="text-xs font-mono p-4 bg-zinc-900 text-zinc-100 rounded-2xl max-h-64 overflow-auto">
          <Suspense fallback={<p>Loading session data...</p>}>
            <UserDetails />
          </Suspense>
        </pre>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-zinc-100 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Server className="w-6 h-6 text-indigo-600" />
          <h2 className="font-bold text-2xl tracking-tight">System Status & Environment</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
            <p className="text-zinc-500 font-medium mb-1">Backend API Status</p>
            <p className="font-semibold text-emerald-600">Online (FastAPI / LangGraph)</p>
          </div>
          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
            <p className="text-zinc-500 font-medium mb-1">Brand Voice Vector DB</p>
            <p className="font-semibold text-indigo-600">Supabase pgvector</p>
          </div>
        </div>
      </div>
    </div>
  );
}
