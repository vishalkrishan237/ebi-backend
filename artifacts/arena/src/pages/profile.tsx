import React from "react";
import { useGetProfile } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Mail, Hash, Coins, Trophy, Calendar, Sword, Clock } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const { data: profile, isLoading } = useGetProfile();

  if (isLoading) return <div className="p-8 text-center">Loading profile...</div>;
  if (!profile) return <div className="p-8 text-center">Profile not found</div>;

  const { user, joinedMatches } = profile;
  
  const matchesWon = joinedMatches.filter(m => m.wonByMe).length;
  const totalWinnings = joinedMatches.filter(m => m.wonByMe).reduce((sum, m) => sum + m.prize, 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Profile Sidebar */}
        <div className="md:col-span-1 space-y-6">
          <Card className="border-white/10 bg-card shadow-xl overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-primary to-secondary" />
            <CardContent className="px-6 pb-6 pt-0 relative">
              <Avatar className="h-24 w-24 border-4 border-card absolute -top-12 bg-background">
                <AvatarFallback className="text-2xl font-black text-primary bg-primary/10">
                  {user.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="pt-16">
                <h2 className="text-2xl font-black tracking-tight">{user.username}</h2>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground bg-background/50 p-2 rounded-md">
                    <Mail className="h-4 w-4 text-primary" /> {user.email}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground bg-background/50 p-2 rounded-md">
                    <Hash className="h-4 w-4 text-secondary" /> FF UID: {user.freeFireUid}
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium bg-background/50 p-2 rounded-md border border-secondary/20">
                    <Coins className="h-4 w-4 text-secondary" /> {user.coinBalance} Coins Available
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="border-white/10 bg-card/50 text-center py-6">
              <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <div className="text-3xl font-black">{matchesWon}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mt-1">Tournaments Won</div>
            </Card>
            <Card className="border-white/10 bg-card/50 text-center py-6">
              <Sword className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-3xl font-black">{joinedMatches.length}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mt-1">Matches Played</div>
            </Card>
          </div>
        </div>

        {/* Match History */}
        <div className="md:col-span-2">
          <Card className="border-white/10 bg-card/50 h-full">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-xl">Match History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {joinedMatches.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Sword className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>You haven't joined any matches yet.</p>
                  <Button asChild className="mt-4" variant="outline">
                    <Link href="/lobby">Browse Lobby</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {joinedMatches.map((match, i) => (
                    <motion.div 
                      key={match.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 sm:p-6 hover:bg-white/5 transition-colors flex flex-col sm:flex-row gap-4 justify-between sm:items-center"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] border-white/10">{match.status}</Badge>
                          {match.wonByMe && (
                            <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 text-[10px]"><Trophy className="h-3 w-3 mr-1"/> Winner</Badge>
                          )}
                        </div>
                        <Link href={`/matches/${match.id}`} className="font-bold text-lg hover:text-primary transition-colors block">
                          {match.name}
                        </Link>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" /> {format(new Date(match.joinedAt), "MMM d, yyyy")}
                        </div>
                      </div>
                      
                      <div className="flex gap-6 items-center bg-background/50 p-3 rounded-lg border border-white/5">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground uppercase mb-1">Fee</div>
                          <div className="font-bold font-mono">{match.entryFee}</div>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground uppercase mb-1 text-yellow-500">Prize</div>
                          <div className="font-bold font-mono text-yellow-500">{match.prize}</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
