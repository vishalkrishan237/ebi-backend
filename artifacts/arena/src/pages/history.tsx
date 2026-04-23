import React from "react";
import { Link } from "wouter";
import { useGetMatchHistory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Trophy, Coins, Users, Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function HistoryPage() {
  const { data: matches, isLoading } = useGetMatchHistory();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8 flex items-center gap-3">
        <History className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-black tracking-tight">Match History</h1>
          <p className="text-muted-foreground">Past tournaments and their champions.</p>
        </div>
      </div>

      <Card className="border-white/10 bg-card/50 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-background/30">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Completed Tournaments
          </CardTitle>
          <CardDescription>The latest 50 finished matches</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading history...</div>
          ) : !matches || matches.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No completed matches yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {matches.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={`/matches/${m.id}`}
                    className="block p-4 sm:p-6 hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h3 className="font-bold text-lg truncate">{m.name}</h3>
                          <Badge
                            variant="outline"
                            className={
                              m.type === "paid"
                                ? "border-secondary/40 text-secondary text-[10px]"
                                : "border-green-500/40 text-green-500 text-[10px]"
                            }
                          >
                            {m.type.toUpperCase()}
                          </Badge>
                          <Badge className="bg-primary/15 text-primary border border-primary/30 text-[10px]">
                            COMPLETED
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(m.startsAt), "MMM d, yyyy HH:mm")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {m.slotsTaken}/{m.slots} players
                          </span>
                          <span className="flex items-center gap-1 text-secondary">
                            <Coins className="h-3 w-3" />
                            {m.prize} prize
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Winner
                          </p>
                          {m.winnerUsername ? (
                            <div className="flex items-center gap-1.5 justify-end">
                              <Trophy className="h-4 w-4 text-yellow-400" />
                              <p className="font-bold text-foreground">{m.winnerUsername}</p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No winner</p>
                          )}
                          {m.winnerFreeFireUid && (
                            <p className="text-[10px] font-mono text-muted-foreground">
                              UID {m.winnerFreeFireUid}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
