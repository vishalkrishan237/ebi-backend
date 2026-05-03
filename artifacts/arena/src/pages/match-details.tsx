import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetMatch, useJoinMatch, useGetMe, usePreviewCoupon, getGetMatchQueryKey, getGetMeQueryKey, getListMatchesQueryKey, getGetProfileQueryKey, getGetRewardsQueryKey, getGetMyCouponsQueryKey, type CouponPreview } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Coins, Users, Calendar, ArrowLeft, Loader2, Sword, Ticket, X, Check, IndianRupee } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function MatchDetailsPage() {
  const params = useParams();
  const matchId = Number(params.id);
  const { data: me } = useGetMe();
  const { data: match, isLoading } = useGetMatch(matchId, { query: { enabled: !!matchId, queryKey: getGetMatchQueryKey(matchId) } });
  const joinMutation = useJoinMatch();
  const previewMutation = usePreviewCoupon();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(null);

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
  const isPaid = match.type === "paid" && match.entryFee > 0;
  const discount = appliedCoupon ? Math.min(appliedCoupon.valueInr, match.entryFee) : 0;
  const finalFee = Math.max(0, match.entryFee - discount);

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      toast({ variant: "destructive", title: "Enter a code", description: "Type your coupon code first." });
      return;
    }
    previewMutation.mutate(
      { data: { code } },
      {
        onSuccess: (preview) => {
          setAppliedCoupon(preview);
          toast({ title: "Coupon applied", description: `₹${preview.valueInr} off your entry fee.` });
        },
        onError: (err: any) => {
          setAppliedCoupon(null);
          toast({
            variant: "destructive",
            title: "Coupon invalid",
            description: err?.response?.data?.error ?? "Could not apply that code.",
          });
        },
      },
    );
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
  };

  const handleJoin = () => {
    if (!me?.user) {
      toast({ title: "Login required", description: "Please log in to join matches." });
      // Redirect handled by Link below ideally, but here we can just show toast
      return;
    }
    
    if (me.user.coinBalance < finalFee) {
      toast({ variant: "destructive", title: "Insufficient Coins", description: `You need ${finalFee} coins to join this match.` });
      return;
    }

    joinMutation.mutate(
      { id: matchId, data: { couponCode: appliedCoupon?.code } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMyCouponsQueryKey() });
          toast({
            title: "Match Joined!",
            description: appliedCoupon
              ? `Registered for ${match.name} using coupon ${appliedCoupon.code}.`
              : `You have successfully registered for ${match.name}.`,
          });
          setAppliedCoupon(null);
          setCouponInput("");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Failed to join",
            description: err?.response?.data?.error ?? err.message ?? "An error occurred.",
          });
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
                  <span className={`font-bold text-lg flex items-center gap-1.5 ${appliedCoupon ? "line-through text-muted-foreground" : ""}`}>
                    {match.entryFee > 0 ? (
                      <><Coins className="h-5 w-5 text-secondary" /> {match.entryFee}</>
                    ) : (
                      <span className="text-green-500">FREE</span>
                    )}
                  </span>
                </div>

                {isPaid && me?.user && !match.joinedByMe && !isCompleted && !isFull && (
                  <div className="py-4 border-b border-white/5 space-y-2">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
                      <Ticket className="h-3.5 w-3.5 text-primary" /> Apply Coupon
                    </label>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-green-400 text-sm font-bold">
                            <Check className="h-3.5 w-3.5" />
                            <span className="font-mono truncate">{appliedCoupon.code}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center">
                            <IndianRupee className="h-3 w-3" />{appliedCoupon.valueInr} off
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleRemoveCoupon}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          placeholder="ARN-XX-XXXXXXXX"
                          className="font-mono text-sm uppercase bg-background border-white/10 focus-visible:ring-primary/40"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleApplyCoupon();
                          }}
                        />
                        <Button
                          variant="outline"
                          onClick={handleApplyCoupon}
                          disabled={previewMutation.isPending || !couponInput.trim()}
                          className="border-primary/40 text-primary hover:bg-primary/10 shrink-0"
                        >
                          {previewMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Apply"
                          )}
                        </Button>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Don't have one? <Link href="/coupons" className="text-primary hover:underline">Redeem coins for coupons</Link>.
                    </p>
                  </div>
                )}

                {isPaid && appliedCoupon && (
                  <div className="flex justify-between items-center py-4 border-b border-white/5">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <Ticket className="h-4 w-4 text-primary" /> Coupon discount
                    </span>
                    <span className="font-bold text-lg text-green-400 flex items-center">
                      -<IndianRupee className="h-4 w-4" />{discount}
                    </span>
                  </div>
                )}

                {isPaid && (
                  <div className="flex justify-between items-center py-4 border-b border-white/5">
                    <span className="font-bold uppercase tracking-wider text-sm">Final price</span>
                    <span className="font-black text-2xl flex items-center gap-1.5 text-primary">
                      {finalFee > 0 ? (
                        <>
                          <Coins className="h-6 w-6" /> {finalFee}
                        </>
                      ) : (
                        <span className="text-green-400">FREE</span>
                      )}
                    </span>
                  </div>
                )}

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
