import React from "react";
import { useParams, Link } from "wouter";
import { useGetMatch, useJoinMatch, useGetMe, getGetMatchQueryKey, getGetMeQueryKey, getListMatchesQueryKey, getGetProfileQueryKey, getGetRewardsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Coins, Users, Calendar, ArrowLeft, Loader2, Sword, Clock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function MatchDetailsPage() {
  const params = useParams();
  const matchId = Number(params.id);
  const { data: me } = useGetMe();
  const { data: match, isLoading } = useGetMatch(matchId, { query: { enabled: !!matchId, queryKey: getGetMatchQueryKey(matchId) } });
  const joinMutation = useJoinMatch();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Match not found</h2>
        <Button asChild variant="outline"><Link href="/lobby">Back to Lobby</Link></Button>
      </div>
    );
  }

  const isFull = match.slotsTaken >= match.slots;
  const isCompleted = match.status === "completed";
  const canJoin = !match.joinedByMe && !isFull && !isCompleted;

  const handleJoin = () => {
    if (!me?.user) {
      toast({ title: "Login required", description: "Please log in to join matches." });
      // Redirect handled by Link below ideally, but here we can just show toast
      return;
    }
    
    if (me.user.coinBalance < match.entryFee) {
      toast({ variant: "destructive", title: "Insufficient Coins", description: `You need ${match.entryFee} coins to join this match.` });
      return;
    }

    joinMutation.mutate(
      { id: matchId },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
          toast({ 
            title: "Match Joined!", 
            description: `You have successfully registered for ${match.name}.`
          });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Failed to join", description: err.message || "An error occurred." });
        }
      }
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Button variant="ghost" asChild className="mb-6 pl-0 text-muted-foreground hover:text-foreground">
        <Link href="/lobby"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby</Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-card">
            <div className="absolute inset-0 z-0">
              <img src="/tournament-bg.png" alt="Tournament" className="w-full h-full object-cover opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent" />
            </div>
            
            <div className="relative z-10 p-8 md:p-12 flex flex-col justify-end min-h-[300px]">
              <div className="flex gap-2 mb-4">
                <Badge variant={match.type === "paid" ? "default" : "secondary"} className="text-sm px-3 py-1 uppercase tracking-wider font-bold">
                  {match.type}
                </Badge>
                <Badge variant={isCompleted ? "destructive" : "outline"} className="text-sm px-3 py-1 bg-background/50 backdrop-blur-md">
                  {match.status}
                </Badge>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 drop-shadow-md">{match.name}</h1>
              
              <div className="flex flex-wrap items-center gap-6 text-sm font-medium">
                <div className="flex items-center gap-2 bg-background/50 backdrop-blur-md px-4 py-2 rounded-lg border border-white/5">
                  <Calendar className="h-5 w-5 text-primary" />
                  {format(new Date(match.startsAt), "PPpp")}
                </div>
                <div className="flex items-center gap-2 bg-background/50 backdrop-blur-md px-4 py-2 rounded-lg border border-white/5">
                  <Users className="h-5 w-5 text-secondary" />
                  {match.slotsTaken} / {match.slots} Players
                </div>
              </div>
            </div>
          </div>

          <Card className="border-white/10 bg-card/50">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="flex items-center gap-2">
                <Sword className="h-5 w-5 text-primary" /> 
                Participants ({match.participants.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {match.participants.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                    <Users className="h-6 w-6 opacity-50" />
                  </div>
                  No players have joined yet. Be the first!
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {match.participants.map((p, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={p.userId} 
                      className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border border-white/10">
                          <AvatarFallback className="bg-primary/20 text-primary font-bold">
                            {p.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-foreground">{p.username}</p>
                          <p className="text-xs text-muted-foreground font-mono">UID: {p.freeFireUid}</p>
                        </div>
                      </div>
                      {match.winnerUserId === p.userId && (
                        <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 flex items-center gap-1 px-3 py-1">
                          <Trophy className="h-3 w-3" /> Winner
                        </Badge>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-white/10 bg-card shadow-xl sticky top-24">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-background border border-white/5 text-center">
                  <p className="text-sm text-muted-foreground mb-1 font-medium">Prize Pool</p>
                  <div className="text-4xl font-black text-yellow-500 flex items-center justify-center gap-2">
                    <Trophy className="h-8 w-8" /> {match.prize}
                  </div>
                </div>

                <div className="flex justify-between items-center py-4 border-b border-white/5">
                  <span className="text-muted-foreground font-medium">Entry Fee</span>
                  <span className="font-bold text-lg flex items-center gap-1.5">
                    {match.entryFee > 0 ? (
                      <><Coins className="h-5 w-5 text-secondary" /> {match.entryFee}</>
                    ) : (
                      <span className="text-green-500">FREE</span>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-4 border-b border-white/5">
                  <span className="text-muted-foreground font-medium">Status</span>
                  <Badge variant={isCompleted ? "destructive" : "outline"} className="font-bold">
                    {match.status.toUpperCase()}
                  </Badge>
                </div>
                
                {isCompleted && match.winnerUsername && (
                  <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center space-y-2">
                    <p className="text-xs font-bold text-yellow-500 uppercase tracking-wider">Tournament Winner</p>
                    <p className="text-xl font-bold text-foreground">{match.winnerUsername}</p>
                  </div>
                )}

                <div className="pt-4">
                  {!me?.user ? (
                    <Button asChild className="w-full h-12 text-base font-bold">
                      <Link href="/login">Log in to Join</Link>
                    </Button>
                  ) : match.joinedByMe ? (
                    <Button disabled className="w-full h-12 text-base font-bold bg-green-500/20 text-green-500 border border-green-500/50 opacity-100">
                      You are registered
                    </Button>
                  ) : isCompleted ? (
                    <Button disabled variant="secondary" className="w-full h-12 text-base font-bold">
                      Match Finished
                    </Button>
                  ) : isFull ? (
                    <Button disabled variant="secondary" className="w-full h-12 text-base font-bold">
                      Match Full
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleJoin} 
                      disabled={joinMutation.isPending}
                      className="w-full h-12 text-base font-bold shadow-[0_0_20px_rgba(219,39,119,0.3)] hover:shadow-[0_0_30px_rgba(219,39,119,0.5)] transition-shadow"
                    >
                      {joinMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Join Tournament"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
