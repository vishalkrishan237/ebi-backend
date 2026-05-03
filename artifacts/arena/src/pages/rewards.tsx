import React from "react";
import { useGetRewards } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, TrendingUp, TrendingDown, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function RewardsPage() {
  const { data: transactions, isLoading } = useGetRewards();

  if (isLoading) return <div className="p-8 text-center">Loading transactions...</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight mb-2">Coin Rewards</h1>
        <p className="text-muted-foreground">Track your earnings and tournament fees.</p>
      </div>

      <Card className="border-white/10 bg-card/50 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-background/30">
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-secondary" /> Transaction History
          </CardTitle>
          <CardDescription>All your coin movements in one place</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!transactions || transactions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Coins className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No coin transactions found.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {transactions.map((tx, i) => {
                const isEarn = tx.amount > 0;
                return (
                  <motion.div 
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-4 sm:p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center border ${
                        isEarn 
                          ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                          : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {isEarn ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{tx.reason}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}
                          </span>
                          {tx.matchName && (
                            <>
                              <span className="text-muted-foreground text-xs">•</span>
                              <Badge variant="outline" className="text-[10px] border-white/10 font-normal">
                                {tx.matchName}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className={`font-mono font-bold text-lg flex items-center gap-1 ${
                      isEarn ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {isEarn ? '+' : ''}{tx.amount}
                      <Coins className="h-4 w-4" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
