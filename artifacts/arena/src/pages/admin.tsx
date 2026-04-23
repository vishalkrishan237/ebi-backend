import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateMatchBody, DeclareWinnerBody } from "@workspace/api-zod";
import { useCreateMatch, useListMatches, useDeclareWinner, useGetMatch, useGetMe, getListMatchesQueryKey, getGetMatchQueryKey, getGetProfileQueryKey, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Plus, Trophy, Calendar } from "lucide-react";

export default function AdminPage() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMatchMutation = useCreateMatch();
  const declareWinnerMutation = useDeclareWinner();
  
  const { data: matches } = useListMatches();
  
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const { data: selectedMatchDetails } = useGetMatch(Number(selectedMatchId), {
    query: { enabled: !!selectedMatchId, queryKey: getGetMatchQueryKey(Number(selectedMatchId)) }
  });

  const createForm = useForm({
    resolver: zodResolver(CreateMatchBody),
    defaultValues: {
      name: "",
      type: "free",
      entryFee: 0,
      prize: 0,
      slots: 50,
      startsAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16), // Tomorrow
    },
  });

  const declareForm = useForm({
    resolver: zodResolver(DeclareWinnerBody),
    defaultValues: {
      winnerUserId: undefined as any,
    }
  });

  if (!me?.user?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view the admin panel.</p>
      </div>
    );
  }

  const onCreateMatch = (data: any) => {
    // Ensure numbers are properly typed from form inputs
    const payload = {
      ...data,
      entryFee: Number(data.entryFee),
      prize: Number(data.prize),
      slots: Number(data.slots),
      startsAt: new Date(data.startsAt).toISOString()
    };

    createMatchMutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          toast({ title: "Success", description: "Match created successfully." });
          createForm.reset();
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Error", description: err.message });
        }
      }
    );
  };

  const onDeclareWinner = (data: any) => {
    if (!selectedMatchId) return;
    
    declareWinnerMutation.mutate(
      { id: Number(selectedMatchId), data: { winnerUserId: Number(data.winnerUserId) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(Number(selectedMatchId)) });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: "Winner Declared", description: "The match has been completed." });
          declareForm.reset();
          setSelectedMatchId("");
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Error", description: err.message });
        }
      }
    );
  };

  const openMatches = matches?.filter(m => m.status === 'open') || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/50">
          <ShieldAlert className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage tournaments and declare winners.</p>
        </div>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-card border border-white/5 h-14">
          <TabsTrigger value="create" className="text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Create Match
          </TabsTrigger>
          <TabsTrigger value="declare" className="text-base data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
            <Trophy className="mr-2 h-4 w-4" /> Declare Winner
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="create">
          <Card className="border-white/10 bg-card/50">
            <CardHeader>
              <CardTitle>Create New Tournament</CardTitle>
              <CardDescription>Set up a new match for players to join.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateMatch)} className="space-y-6">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Match Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Friday Night Scrims" {...field} className="bg-background/50 border-white/10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={createForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Match Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-background/50 border-white/10">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="free">Free to Play</SelectItem>
                              <SelectItem value="paid">Paid Entry</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="startsAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} className="bg-background/50 border-white/10" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={createForm.control}
                      name="entryFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Entry Fee (Coins)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} className="bg-background/50 border-white/10" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="prize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prize Pool (Coins)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} className="bg-background/50 border-white/10" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="slots"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Slots</FormLabel>
                          <FormControl>
                            <Input type="number" min="2" {...field} className="bg-background/50 border-white/10" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={createMatchMutation.isPending}>
                    {createMatchMutation.isPending ? "Creating..." : "Create Match"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="declare">
          <Card className="border-white/10 bg-card/50">
            <CardHeader>
              <CardTitle>Declare Match Winner</CardTitle>
              <CardDescription>Select an open match and choose the winning player.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Select Open Match</label>
                  <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
                    <SelectTrigger className="bg-background/50 border-white/10">
                      <SelectValue placeholder="Choose a match" />
                    </SelectTrigger>
                    <SelectContent>
                      {openMatches.length === 0 ? (
                        <SelectItem value="none" disabled>No open matches available</SelectItem>
                      ) : (
                        openMatches.map(m => (
                          <SelectItem key={m.id} value={m.id.toString()}>
                            #{m.id} - {m.name} ({m.slotsTaken}/{m.slots} players)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedMatchDetails && (
                  <Form {...declareForm}>
                    <form onSubmit={declareForm.handleSubmit(onDeclareWinner)} className="space-y-6 p-6 border border-white/5 rounded-xl bg-background/30">
                      <div className="mb-4 pb-4 border-b border-white/5">
                        <h3 className="font-bold text-lg">{selectedMatchDetails.name}</h3>
                        <p className="text-sm text-muted-foreground">Prize: {selectedMatchDetails.prize} Coins</p>
                      </div>

                      <FormField
                        control={declareForm.control}
                        name="winnerUserId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Winner</FormLabel>
                            <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger className="bg-background/50 border-white/10">
                                  <SelectValue placeholder="Choose winning player" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {selectedMatchDetails.participants.length === 0 ? (
                                  <SelectItem value="none" disabled>No participants joined</SelectItem>
                                ) : (
                                  selectedMatchDetails.participants.map(p => (
                                    <SelectItem key={p.userId} value={p.userId.toString()}>
                                      {p.username} (UID: {p.freeFireUid})
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                        disabled={declareWinnerMutation.isPending || selectedMatchDetails.participants.length === 0}
                      >
                        {declareWinnerMutation.isPending ? "Declaring..." : "Confirm Winner & Distribute Prize"}
                      </Button>
                    </form>
                  </Form>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
