import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateMatchBody, DeclareWinnerBody, AdjustUserCoinsBody, UpdateMatchBody } from "@workspace/api-zod";
import {
  useCreateMatch,
  useListMatches,
  useDeclareWinner,
  useGetMatch,
  useGetMe,
  useGetAdminStats,
  useListAdminUsers,
  useGetAdminUser,
  useBanUser,
  useUnbanUser,
  useAdjustUserCoins,
  useUpdateMatch,
  useDeleteMatch,
  useStartMatch,
  useEndMatch,
  useGetAdminLogs,
  getListMatchesQueryKey,
  getGetMatchQueryKey,
  getGetProfileQueryKey,
  getGetMeQueryKey,
  getGetAdminStatsQueryKey,
  getListAdminUsersQueryKey,
  getGetAdminUserQueryKey,
  getGetAdminLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert,
  Plus,
  Trophy,
  Users,
  Activity,
  Coins,
  Swords,
  CheckCircle2,
  Ban,
  RotateCcw,
  Pencil,
  Trash2,
  Play,
  StopCircle,
  Search,
  ScrollText,
  LayoutDashboard,
} from "lucide-react";

export default function AdminPage() {
  const { data: me, isLoading: meLoading } = useGetMe();

  if (meLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!me?.user?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view the admin panel.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/50">
          <ShieldAlert className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight">Admin Control Center</h1>
          <p className="text-muted-foreground">Manage tournaments, users, results and review activity.</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-8 bg-card border border-white/5 h-12">
          <TabsTrigger value="overview"><LayoutDashboard className="mr-2 h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="matches"><Swords className="mr-2 h-4 w-4" />Matches</TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Users</TabsTrigger>
          <TabsTrigger value="results"><Trophy className="mr-2 h-4 w-4" />Results</TabsTrigger>
          <TabsTrigger value="logs"><ScrollText className="mr-2 h-4 w-4" />Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewSection /></TabsContent>
        <TabsContent value="matches"><MatchesSection /></TabsContent>
        <TabsContent value="users"><UsersSection /></TabsContent>
        <TabsContent value="results"><ResultsSection /></TabsContent>
        <TabsContent value="logs"><LogsSection /></TabsContent>
      </Tabs>
    </div>
  );
}

// ----- Overview -----
function OverviewSection() {
  const { data: stats } = useGetAdminStats();
  if (!stats) return <p className="text-muted-foreground">Loading stats…</p>;
  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
    { label: "Total Matches", value: stats.totalMatches, icon: Swords, color: "text-primary" },
    { label: "Active Matches", value: stats.activeMatches, icon: Activity, color: "text-green-400" },
    { label: "Completed", value: stats.completedMatches, icon: CheckCircle2, color: "text-yellow-400" },
    { label: "Banned Users", value: stats.bannedUsers, icon: Ban, color: "text-destructive" },
    { label: "Coins in Circulation", value: stats.coinsInCirculation, icon: Coins, color: "text-amber-400" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-white/10 bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold mt-1">{c.value.toLocaleString()}</p>
                </div>
                <c.icon className={`h-7 w-7 ${c.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-white/10 bg-card/50">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Last 10 admin actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.recentLogs.map((l) => <LogRow key={l.id} log={l} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ----- Matches -----
function MatchesSection() {
  const { data: matches } = useListMatches();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateMatch();
  const deleteMutation = useDeleteMatch();
  const startMutation = useStartMatch();
  const endMutation = useEndMatch();

  const [editing, setEditing] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<number | null>(null);

  const createForm = useForm({
    resolver: zodResolver(CreateMatchBody),
    defaultValues: {
      name: "",
      type: "free" as "free" | "paid",
      entryFee: 0,
      prize: 0,
      slots: 50,
      startsAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAdminLogsQueryKey() });
  };

  const onCreate = (data: any) => {
    const payload = {
      ...data,
      entryFee: Number(data.entryFee),
      prize: Number(data.prize),
      slots: Number(data.slots),
      startsAt: new Date(data.startsAt).toISOString(),
    };
    createMutation.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Match created" });
        createForm.reset();
        invalidateAll();
      },
      onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  };

  const handleStart = (id: number) => {
    startMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Match started" }); invalidateAll(); },
      onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  };
  const handleEnd = (id: number) => {
    endMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Match ended", description: "Entry fees refunded if applicable." }); invalidateAll(); setConfirmEnd(null); },
      onError: (e: any) => { toast({ variant: "destructive", title: "Error", description: e.message }); setConfirmEnd(null); },
    });
  };
  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Match deleted" }); invalidateAll(); setConfirmDelete(null); },
      onError: (e: any) => { toast({ variant: "destructive", title: "Error", description: e.message }); setConfirmDelete(null); },
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-card/50">
        <CardHeader>
          <CardTitle><Plus className="inline h-5 w-5 mr-2" />Create Match</CardTitle>
          <CardDescription>Set up a new tournament.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
              <FormField control={createForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Match Name</FormLabel><FormControl><Input {...field} placeholder="Friday Night Cup" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={createForm.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="free">Free to Play</SelectItem>
                        <SelectItem value="paid">Paid Entry</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="startsAt" render={({ field }) => (
                  <FormItem><FormLabel>Start Time</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <FormField control={createForm.control} name="entryFee" render={({ field }) => (
                  <FormItem><FormLabel>Entry Fee (Coins)</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="prize" render={({ field }) => (
                  <FormItem><FormLabel>Prize (Coins)</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="slots" render={({ field }) => (
                  <FormItem><FormLabel>Total Slots</FormLabel><FormControl><Input type="number" min="2" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating…" : "Create Match"}</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-card/50">
        <CardHeader><CardTitle>All Matches</CardTitle></CardHeader>
        <CardContent>
          {!matches || matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches yet.</p>
          ) : (
            <div className="space-y-2">
              {matches.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-white/5 bg-background/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{m.name}</span>
                      <StatusBadge status={m.status} />
                      <Badge variant="outline" className="text-xs">{m.type}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {m.slotsTaken}/{m.slots} slots · entry {m.entryFee} · prize {m.prize} · starts {new Date(m.startsAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {m.status === "open" && m.slotsTaken === 0 && (
                      <IconBtn label="Edit" onClick={() => setEditing(m.id)}><Pencil className="h-4 w-4" /></IconBtn>
                    )}
                    {m.status === "open" && (
                      <IconBtn label="Start (lock joins)" onClick={() => handleStart(m.id)}><Play className="h-4 w-4 text-green-400" /></IconBtn>
                    )}
                    {m.status !== "completed" && (
                      <IconBtn label="End match (refund)" onClick={() => setConfirmEnd(m.id)}><StopCircle className="h-4 w-4 text-yellow-400" /></IconBtn>
                    )}
                    <IconBtn label="Delete" onClick={() => setConfirmDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></IconBtn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing != null && (
        <EditMatchDialog matchId={editing} onClose={() => setEditing(null)} />
      )}

      <AlertDialog open={confirmDelete != null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this match?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the match. Any paid participants will be refunded their entry fee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && handleDelete(confirmDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmEnd != null} onOpenChange={(o) => !o && setConfirmEnd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this match without a winner?</AlertDialogTitle>
            <AlertDialogDescription>
              All paid participants will be refunded. Use the Results tab instead if you want to declare a winner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmEnd && handleEnd(confirmEnd)}>End Match</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditMatchDialog({ matchId, onClose }: { matchId: number; onClose: () => void }) {
  const { data: match } = useGetMatch(matchId, { query: { queryKey: getGetMatchQueryKey(matchId) } });
  const updateMutation = useUpdateMatch();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(UpdateMatchBody),
    values: match
      ? {
          name: match.name,
          type: match.type,
          entryFee: match.entryFee,
          prize: match.prize,
          slots: match.slots,
          startsAt: new Date(match.startsAt).toISOString().slice(0, 16),
        }
      : undefined,
  });

  const onSubmit = (data: any) => {
    const payload: any = {
      name: data.name,
      type: data.type,
      entryFee: Number(data.entryFee),
      prize: Number(data.prize),
      slots: Number(data.slots),
      startsAt: new Date(data.startsAt).toISOString(),
    };
    updateMutation.mutate({ id: matchId, data: payload }, {
      onSuccess: () => {
        toast({ title: "Match updated" });
        queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
        queryClient.invalidateQueries({ queryKey: getGetAdminLogsQueryKey() });
        onClose();
      },
      onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Match</DialogTitle>
          <DialogDescription>Only matches with no participants can be edited.</DialogDescription>
        </DialogHeader>
        {match && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="startsAt" render={({ field }) => (
                  <FormItem><FormLabel>Start Time</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="entryFee" render={({ field }) => (
                  <FormItem><FormLabel>Entry Fee</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="prize" render={({ field }) => (
                  <FormItem><FormLabel>Prize</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="slots" render={({ field }) => (
                  <FormItem><FormLabel>Slots</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ----- Users -----
function UsersSection() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [openUser, setOpenUser] = useState<number | null>(null);

  const { data: users } = useListAdminUsers({ search: debounced || undefined }, {
    query: { queryKey: getListAdminUsersQueryKey({ search: debounced || undefined }) },
  });

  // Debounce search
  useMemo(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-4">
      <Card className="border-white/10 bg-card/50">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Search by username, email or Free Fire UID.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {!users ? <p className="text-sm text-muted-foreground">Loading…</p> :
            users.length === 0 ? <p className="text-sm text-muted-foreground">No users match.</p> : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-white/5 bg-background/30 hover:bg-background/50 cursor-pointer" onClick={() => setOpenUser(u.id)}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{u.username}</span>
                        {u.isAdmin && <Badge className="bg-primary/20 text-primary border-primary/30">Admin</Badge>}
                        {u.isBanned && <Badge variant="destructive">Banned</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email} · UID {u.freeFireUid}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-semibold flex items-center gap-1"><Coins className="h-3 w-3 text-amber-400" />{u.coinBalance}</div>
                      <div className="text-xs text-muted-foreground">joined {new Date(u.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </CardContent>
      </Card>
      {openUser != null && <UserDetailDialog userId={openUser} onClose={() => setOpenUser(null)} />}
    </div>
  );
}

function UserDetailDialog({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { data, refetch } = useGetAdminUser(userId, { query: { queryKey: getGetAdminUserQueryKey(userId) } });
  const banMut = useBanUser();
  const unbanMut = useUnbanUser();
  const adjustMut = useAdjustUserCoins();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const adjustForm = useForm({
    resolver: zodResolver(AdjustUserCoinsBody),
    defaultValues: { amount: 0, reason: "" },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetAdminUserQueryKey(userId) });
    queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAdminLogsQueryKey() });
    refetch();
  };

  const handleBan = () => {
    banMut.mutate({ id: userId, data: { reason: "Admin action" } }, {
      onSuccess: () => { toast({ title: "User banned" }); invalidate(); },
      onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  };
  const handleUnban = () => {
    unbanMut.mutate({ id: userId }, {
      onSuccess: () => { toast({ title: "User unbanned" }); invalidate(); },
      onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  };
  const onAdjust = (d: { amount: number; reason: string }) => {
    adjustMut.mutate({ id: userId, data: { amount: Number(d.amount), reason: d.reason } }, {
      onSuccess: () => { toast({ title: "Coins adjusted" }); adjustForm.reset({ amount: 0, reason: "" }); invalidate(); },
      onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.user.username ?? "User"}</DialogTitle>
          <DialogDescription>{data?.user.email}</DialogDescription>
        </DialogHeader>
        {data && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Coins" value={data.user.coinBalance.toLocaleString()} />
              <Stat label="UID" value={data.user.freeFireUid} />
              <Stat label="Status" value={data.user.isBanned ? "Banned" : data.user.isAdmin ? "Admin" : "Active"} />
              <Stat label="Joined" value={new Date(data.user.createdAt).toLocaleDateString()} />
            </div>

            <div className="flex flex-wrap gap-2">
              {data.user.isAdmin ? (
                <p className="text-xs text-muted-foreground">Admins cannot be banned.</p>
              ) : data.user.isBanned ? (
                <Button size="sm" onClick={handleUnban} disabled={unbanMut.isPending}><RotateCcw className="h-4 w-4 mr-2" />Unban</Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={handleBan} disabled={banMut.isPending}><Ban className="h-4 w-4 mr-2" />Ban</Button>
              )}
            </div>

            <div className="rounded-lg border border-white/5 p-4">
              <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><Coins className="h-4 w-4 text-amber-400" />Adjust Coins</h3>
              <Form {...adjustForm}>
                <form onSubmit={adjustForm.handleSubmit(onAdjust)} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={adjustForm.control} name="amount" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Amount (negative to remove)</FormLabel><FormControl><Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={adjustForm.control} name="reason" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Reason</FormLabel><FormControl><Input {...field} placeholder="e.g. compensation" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <Button type="submit" size="sm" disabled={adjustMut.isPending}>{adjustMut.isPending ? "Applying…" : "Apply"}</Button>
                </form>
              </Form>
            </div>

            <div className="rounded-lg border border-white/5 p-4">
              <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><Swords className="h-4 w-4" />Match History ({data.joinedMatches.length})</h3>
              {data.joinedMatches.length === 0 ? <p className="text-xs text-muted-foreground">No matches joined.</p> : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {data.joinedMatches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs p-2 rounded bg-background/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate font-medium">{m.name}</span>
                        <StatusBadge status={m.status} />
                        {m.wonByMe && <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Won</Badge>}
                      </div>
                      <span className="text-muted-foreground">{new Date(m.joinedAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-white/5 p-4">
              <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Coin History (last {data.coinHistory.length})</h3>
              {data.coinHistory.length === 0 ? <p className="text-xs text-muted-foreground">No transactions.</p> : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {data.coinHistory.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded bg-background/30">
                      <span className="truncate">{t.reason}</span>
                      <span className={`font-mono font-semibold ${t.amount >= 0 ? "text-green-400" : "text-red-400"}`}>{t.amount >= 0 ? "+" : ""}{t.amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ----- Results -----
function ResultsSection() {
  const { data: matches } = useListMatches();
  const declareMut = useDeclareWinner();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string>("");
  const { data: detail } = useGetMatch(Number(selectedId), {
    query: { enabled: !!selectedId, queryKey: getGetMatchQueryKey(Number(selectedId)) },
  });

  const form = useForm({
    resolver: zodResolver(DeclareWinnerBody),
    defaultValues: { winnerUserId: undefined as any },
  });

  const eligible = matches?.filter((m) => m.status !== "completed") ?? [];

  const onSubmit = (d: any) => {
    if (!selectedId) return;
    declareMut.mutate({ id: Number(selectedId), data: { winnerUserId: Number(d.winnerUserId) } }, {
      onSuccess: () => {
        toast({ title: "Winner declared", description: "Prize distributed." });
        queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(Number(selectedId)) });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminLogsQueryKey() });
        form.reset();
        setSelectedId("");
      },
      onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  };

  return (
    <Card className="border-white/10 bg-card/50">
      <CardHeader>
        <CardTitle><Trophy className="inline h-5 w-5 mr-2" />Declare Winner</CardTitle>
        <CardDescription>Select a match and pick the winning player to distribute the prize.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Match</label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Choose a match" /></SelectTrigger>
              <SelectContent>
                {eligible.length === 0 ? <SelectItem value="none" disabled>No eligible matches</SelectItem> :
                  eligible.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>#{m.id} — {m.name} ({m.slotsTaken}/{m.slots}) · {m.status}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {detail && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border border-white/5 rounded-xl bg-background/30">
                <div className="pb-3 border-b border-white/5">
                  <h3 className="font-bold">{detail.name}</h3>
                  <p className="text-sm text-muted-foreground">Prize: {detail.prize} coins · {detail.participants.length} players</p>
                </div>
                <FormField control={form.control} name="winnerUserId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Winner</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Choose winner" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {detail.participants.length === 0 ? <SelectItem value="none" disabled>No participants</SelectItem> :
                          detail.participants.map((p) => (
                            <SelectItem key={p.userId} value={p.userId.toString()}>{p.username} (UID {p.freeFireUid})</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold" disabled={declareMut.isPending || detail.participants.length === 0}>
                  {declareMut.isPending ? "Declaring…" : "Confirm & Distribute Prize"}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ----- Logs -----
function LogsSection() {
  const { data: logs } = useGetAdminLogs({ limit: 200 }, { query: { queryKey: getGetAdminLogsQueryKey({ limit: 200 }) } });
  return (
    <Card className="border-white/10 bg-card/50">
      <CardHeader><CardTitle>Activity Log</CardTitle><CardDescription>All admin actions, newest first.</CardDescription></CardHeader>
      <CardContent>
        {!logs ? <p className="text-sm text-muted-foreground">Loading…</p> :
          logs.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : (
            <div className="space-y-2">{logs.map((l) => <LogRow key={l.id} log={l} />)}</div>
          )}
      </CardContent>
    </Card>
  );
}

// ----- Shared bits -----
function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "open" ? "bg-green-500/20 text-green-300 border-green-500/30" :
    status === "live" ? "bg-orange-500/20 text-orange-300 border-orange-500/30" :
    "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
  return <Badge variant="outline" className={`${cls} text-xs`}>{status}</Badge>;
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" onClick={onClick}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-background/40 border border-white/5">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function LogRow({ log }: { log: { id: number; adminUsername: string | null; action: string; targetType: string | null; targetId: number | null; details: string | null; createdAt: string } }) {
  return (
    <div className="flex items-start justify-between gap-3 p-2 rounded bg-background/30 text-xs">
      <div className="min-w-0 flex-1">
        <div>
          <span className="font-semibold text-primary">{log.adminUsername ?? `admin#${log.id}`}</span>
          <span className="mx-1.5 text-muted-foreground">·</span>
          <span className="font-mono">{log.action}</span>
          {log.targetType && <span className="text-muted-foreground"> on {log.targetType}#{log.targetId}</span>}
        </div>
        {log.details && <div className="text-muted-foreground mt-0.5 truncate">{log.details}</div>}
      </div>
      <div className="text-muted-foreground whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</div>
    </div>
  );
}
