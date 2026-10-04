import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, Trash2, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteUserPermanently } from "@/lib/admin-users.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccountControlsCard({ userId, name, restrictedAt, restrictedReason }: {
  userId: string; name: string; restrictedAt: string | null; restrictedReason: string | null;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const del = useServerFn(deleteUserPermanently);
  const [reason, setReason] = useState("");

  const restrict = useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.rpc("admin_set_restriction", { _user_id: userId, _restricted: on, _reason: reason });
      if (error) throw error;
    },
    onSuccess: (_d, on) => { toast.success(on ? "User restricted" : "Restriction lifted"); setReason(""); qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const typed = window.prompt(`This permanently deletes ${name} and ALL their data (wallet, investments, history). This cannot be undone.\n\nType DELETE to confirm.`);
      if (typed !== "DELETE") throw new Error("Cancelled");
      await del({ data: { userId } });
    },
    onSuccess: () => { toast.success("Account deleted permanently"); qc.invalidateQueries({ queryKey: ["admin-users"] }); navigate({ to: "/admin/users" }); },
    onError: (e: Error) => { if (e.message !== "Cancelled") toast.error(e.message); },
  });

  return (
    <Card className="p-4">
      <h3 className="mb-1 text-sm font-semibold">Account controls</h3>
      {restrictedAt ? (
        <div className="space-y-2">
          <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            Restricted since {new Date(restrictedAt).toLocaleString()}{restrictedReason ? ` — ${restrictedReason}` : ""}
          </p>
          <Button variant="outline" className="w-full gap-2" onClick={() => restrict.mutate(false)} disabled={restrict.isPending}>
            <Unlock className="h-4 w-4" /> Lift restriction
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown to the user)" className="flex-1" />
          <Button variant="secondary" className="gap-2" onClick={() => restrict.mutate(true)} disabled={restrict.isPending}>
            <Ban className="h-4 w-4" /> Restrict user
          </Button>
        </div>
      )}
      <Button variant="destructive" className="mt-3 w-full gap-2" onClick={() => remove.mutate()} disabled={remove.isPending}>
        <Trash2 className="h-4 w-4" /> {remove.isPending ? "Deleting…" : "Delete account permanently"}
      </Button>
    </Card>
  );
}
