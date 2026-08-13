"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton({ onLogout }: { onLogout?: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch("/api/auth/logout", { method: "POST" });
        onLogout?.();
        router.replace("/login");
        router.refresh();
      }}
      className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      {pending ? "Locking…" : "Lock & sign out"}
    </button>
  );
}
