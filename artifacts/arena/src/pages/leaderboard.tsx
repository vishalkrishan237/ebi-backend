import React from "react";
import { useGetLeaderboard, useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Coins, Medal, Crown, Award } from "lucide-react";
import { motion } from "framer-motion";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="h-12 w-12 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-[0_0_24px_rgba(250,204,21,0.5)]">
        <Crown className="h-6 w-6" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="h-12 w-12 rounded-full flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-500 text-black shadow-[0_0_18px_rgba(203,213,225,0.4)]">
        <Medal className="h-6 w-6" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="h-12 w-12 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-800 text-black shadow-[0_0_18px_rgba(217,119,6,0.4)]">
        <Award className="h-6 w-6" />
      </div>
    );
  return (
    <div className="h-12 w-12 rounded-full flex items-center justify-center bg-accent/40 border border-white/10 text-muted-foreground font-mono font-bold">
      #{rank}
    </div>
  );
}

export default function LeaderboardPage() {
  const { data: entries, isLoading } = useGetLeaderboard();
  const { data: me } = useGetMe();
  const myId = me?.user?.id;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8 flex items-center gap-3">
        <Trophy className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-black tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground">Top players ranked by tournament prize earnings.</p>
        </div>
      </div>

      <Card className="border-white/10 bg-card/50 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-background/30">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Hall of Fame
          </CardTitle>
          <CardDescription>Compete to climb the ranks</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading rankings...</div>
          ) : !entries || entries.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No players ranked yet. Be the first to win.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {entries.map((entry, i) => {
                const isMe = entry.userId === myId;
                return (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`p-4 sm:p-6 flex items-center justify-between gap-4 transition-colors ${
                      isMe ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <RankBadge rank={entry.rank} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground truncate">{entry.username}</p>
                          {isMe && (
                            <Badge className="bg-primary/20 text-primary border border-primary/40 text-[10px]">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          UID {entry.freeFireUid}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Wins
                        </p>
                        <p className="font-mono font-bold">{entry.wins}</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Balance
                        </p>
                        <p className="font-mono font-bold flex items-center gap-1 justify-end">
                          {entry.coinBalance}
                          <Coins className="h-3 w-3 text-secondary" />
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Prize won
                        </p>
                        <p className="font-mono font-black text-lg text-primary flex items-center gap-1 justify-end">
                          {entry.totalPrize}
                          <Coins className="h-4 w-4" />
                        </p>
                      </div>
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
