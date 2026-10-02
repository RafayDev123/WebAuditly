"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--muted-foreground)]">Manage account preferences and security.</p>
      </header>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold">
          {process.env.NODE_ENV === "development" ? "Workspace" : "Session"}
        </h2>
        {process.env.NODE_ENV === "development" ? (
          <p className="text-sm text-[var(--muted-foreground)]">Local development workspace</p>
        ) : (
          <Button
            variant="secondary"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            Sign out
          </Button>
        )}
      </Card>
    </div>
  );
}
