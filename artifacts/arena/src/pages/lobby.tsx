import React, { useState } from "react";
import { useListMatches } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, Users, Trophy, Calendar, Sword } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function LobbyPage() {
  const { data: matches, isLoading } = useListMatches();
  const [filter, setFilter] = useState<"all" | "paid" | "free">("all");

  const filteredMatches = matches?.filter((m) => filter === "all" || m.type === filter);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Tournament Lobby</h1>
          <p className="text-muted-foreground">Find a match, join the fight, win the prize.</p>
        </div>
        
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full md:w-auto">
          <TabsList className="grid grid-cols-3 w-full md:w-[300px]">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="free">Free</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse bg-card/50 border-white/5 h-64" />
          ))}
        </div>
      ) : filteredMatches?.length === 0 ? (
        <div className="text-center py-20 bg-card/30 rounded-2xl border border-white/5 border-dashed">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Sword className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
          <h3 className="text-xl font-bold mb-2">No matches found</h3>
          <p className="text-muted-foreground">Check back later for new tournaments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredMatches?.map((match, i) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="flex flex-col h-full bg-card/50 backdrop-blur-sm border-white/10 hover:border-primary/50 transition-all hover:shadow-[0_0_30px_rgba(219,39,119,0.15)] overflow-hidden group">
                <div className="h-2 w-full bg-gradient-to-r from-primary/50 to-secondary/50" />
                <CardContent className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <Badge variant={match.type === "paid" ? "default" : "secondary"} className="font-bold uppercase tracking-wider">
                      {match.type}
                    </Badge>
                    <Badge variant={match.status === "open" ? "outline" : "destructive"} className="border-white/10">
                      {match.status}
                    </Badge>
                  </div>
                  
                  <h3 className="text-xl font-bold mb-4 line-clamp-1 group-hover:text-primary transition-colors">{match.name}</h3>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div className="space-y-1.5">
                      <div className="text-muted-foreground flex items-center gap-1.5">
                        <Coins className="h-4 w-4" /> Entry Fee
                      </div>
                      <div className="font-bold text-lg">{match.entryFee > 0 ? match.entryFee : "FREE"}</div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-muted-foreground flex items-center gap-1.5">
                        <Trophy className="h-4 w-4 text-yellow-500" /> Prize Pool
                      </div>
                      <div className="font-bold text-lg text-yellow-500">{match.prize} Coins</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between bg-background/50 p-2 rounded-md">
                      <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Slots</span>
                      <span className="font-medium text-foreground">
                        {match.slotsTaken} / {match.slots}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-background/50 p-2 rounded-md">
                      <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Starts</span>
                      <span className="font-medium text-foreground">
                        {format(new Date(match.startsAt), "MMM d, HH:mm")}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-6 pt-0 mt-auto">
                  <Button asChild className="w-full font-bold" variant={match.status === "completed" ? "secondary" : "default"}>
                    <Link href={`/matches/${match.id}`}>
                      {match.status === "completed" ? "View Results" : "View Match"}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
