import React, { useState } from "react";
import {
  useGetCouponOptions,
  useGetMyCoupons,
  useRedeemCoupon,
  useGetMe,
  getGetMyCouponsQueryKey,
  getGetMeQueryKey,
  getGetRewardsQueryKey,
  type Coupon,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Ticket,
  Coins,
  Gift,
  Copy,
  Check,
  Sparkles,
  IndianRupee,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function CouponsPage() {
  const { data: me } = useGetMe();
  const { data: options } = useGetCouponOptions();
  const { data: myCoupons } = useGetMyCoupons({
    query: { enabled: !!me?.user, queryKey: getGetMyCouponsQueryKey() },
  });
  const redeem = useRedeemCoupon();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [justRedeemed, setJustRedeemed] = useState<Coupon | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const balance = me?.user?.coinBalance ?? 0;

  const handleRedeem = (coinCost: number, valueInr: number) => {
    if (!me?.user) {
      toast({ title: "Login required", description: "Please log in to redeem coupons.", variant: "destructive" });
      return;
    }
    if (balance < coinCost) {
      toast({ title: "Not enough coins", description: `You need ${coinCost - balance} more coins.`, variant: "destructive" });
      return;
    }
    redeem.mutate(
      { data: { coinCost } },
      {
        onSuccess: (coupon) => {
          setJustRedeemed(coupon);
          queryClient.invalidateQueries({ queryKey: getGetMyCouponsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
          toast({ title: "Coupon redeemed!", description: `₹${valueInr} coupon ready to use.` });
        },
        onError: (err: any) => {
          toast({
            title: "Redemption failed",
            description: err?.response?.data?.error ?? "Try again later.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <Ticket className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-black tracking-tight">Coupon Store</h1>
          <p className="text-muted-foreground">Redeem your coins for tournament coupons.</p>
        </div>
      </div>

      <Card className="mb-8 border-white/10 bg-gradient-to-br from-primary/15 via-card/60 to-secondary/10 shadow-[0_0_40px_rgba(219,39,119,0.15)] overflow-hidden relative">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-secondary/20 blur-3xl" />
        <CardContent className="p-6 flex items-center justify-between relative">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Your balance
            </p>
            <div className="flex items-center gap-2">
              <Coins className="h-7 w-7 text-secondary" />
              <span className="font-mono text-4xl font-black text-secondary">
                {balance.toLocaleString()}
              </span>
              <span className="text-muted-foreground text-sm font-medium ml-1">coins</span>
            </div>
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Coupons owned
            </p>
            <p className="font-black text-3xl text-primary">{myCoupons?.length ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" /> Available Coupons
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {options?.map((opt, i) => {
            const canAfford = balance >= opt.coinCost;
            const isLoading =
              redeem.isPending && redeem.variables?.data.coinCost === opt.coinCost;
            return (
              <motion.div
                key={opt.coinCost}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className={`relative overflow-hidden border-white/10 bg-card/60 transition-all hover:border-primary/40 ${
                    canAfford ? "hover:shadow-[0_0_24px_rgba(219,39,119,0.25)]" : "opacity-70"
                  }`}
                >
                  <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
                  <CardContent className="p-5 relative flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center border border-primary/30">
                        <Ticket className="h-5 w-5 text-primary" />
                      </div>
                      <Badge
                        variant="outline"
                        className="border-secondary/40 text-secondary text-[10px] font-mono"
                      >
                        {opt.coinCost} <Coins className="h-2.5 w-2.5 ml-0.5" />
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Tournament Coupon
                      </p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <IndianRupee className="h-5 w-5 text-foreground" />
                        <span className="text-3xl font-black tracking-tight">{opt.valueInr}</span>
                        <span className="text-muted-foreground text-sm">value</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRedeem(opt.coinCost, opt.valueInr)}
                      disabled={!canAfford || isLoading || !me?.user}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(219,39,119,0.35)]"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : !me?.user ? (
                        "Login to Redeem"
                      ) : !canAfford ? (
                        "Not enough coins"
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-1.5" /> Redeem
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Ticket className="h-5 w-5 text-secondary" /> My Coupons
        </h2>
        <Card className="border-white/10 bg-card/50 overflow-hidden">
          <CardContent className="p-0">
            {!me?.user ? (
              <div className="p-12 text-center text-muted-foreground">
                Log in to view your redeemed coupons.
              </div>
            ) : !myCoupons || myCoupons.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Ticket className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>You haven't redeemed any coupons yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {myCoupons.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center shrink-0">
                        <Ticket className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-lg flex items-center">
                            <IndianRupee className="h-4 w-4" />
                            {c.valueInr}
                          </p>
                          <Badge
                            className={
                              c.status === "active"
                                ? "bg-green-500/15 text-green-400 border border-green-500/30 text-[10px]"
                                : "bg-muted text-muted-foreground border text-[10px]"
                            }
                          >
                            {c.status.toUpperCase()}
                          </Badge>
                        </div>
                        <button
                          onClick={() => copyCode(c.code)}
                          className="font-mono text-sm text-foreground/80 hover:text-primary transition-colors flex items-center gap-1.5 group"
                          title="Click to copy"
                        >
                          {c.code}
                          {copied === c.code ? (
                            <Check className="h-3.5 w-3.5 text-green-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
                          )}
                        </button>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Redeemed {format(new Date(c.createdAt), "MMM d, yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Cost
                      </p>
                      <p className="font-mono font-bold flex items-center gap-1 justify-end text-secondary">
                        {c.coinCost}
                        <Coins className="h-3.5 w-3.5" />
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!justRedeemed} onOpenChange={(o) => !o && setJustRedeemed(null)}>
        <DialogContent className="border-primary/30 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Sparkles className="h-6 w-6 text-secondary" /> Coupon Unlocked!
            </DialogTitle>
            <DialogDescription>
              Your tournament coupon has been generated. Save the code below.
            </DialogDescription>
          </DialogHeader>
          {justRedeemed && (
            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-primary/40 bg-gradient-to-br from-primary/10 to-secondary/10 p-6 text-center">
                <div className="flex items-baseline justify-center gap-1 mb-3">
                  <IndianRupee className="h-7 w-7" />
                  <span className="text-5xl font-black">{justRedeemed.valueInr}</span>
                  <span className="text-muted-foreground ml-2">tournament credit</span>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                  Coupon Code
                </p>
                <div className="flex items-center justify-center gap-2">
                  <code className="font-mono text-lg font-bold tracking-wider text-primary">
                    {justRedeemed.code}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyCode(justRedeemed.code)}
                  >
                    {copied === justRedeemed.code ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => setJustRedeemed(null)}
              >
                Awesome
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
