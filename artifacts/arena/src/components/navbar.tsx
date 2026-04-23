import React from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Coins, LogOut, Menu, UserCircle, Trophy, Home } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const { data: me } = useGetMe();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/");
      },
    });
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center p-[2px]">
              <div className="h-full w-full bg-background rounded-md flex items-center justify-center group-hover:bg-transparent transition-colors">
                <Trophy className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
              </div>
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Arena
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link href="/lobby" className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              Lobby
            </Link>
            <Link href="/leaderboard" className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              Leaderboard
            </Link>
            <Link href="/history" className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              History
            </Link>
            {me?.user && (
              <>
                <Link href="/profile" className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  Profile
                </Link>
                <Link href="/rewards" className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  Rewards
                </Link>
              </>
            )}
            {me?.user?.isAdmin && (
              <Link href="/admin" className="px-3 py-2 rounded-md text-sm font-medium text-primary hover:text-primary hover:bg-primary/10 transition-colors">
                Admin Panel
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {me?.user ? (
            <div className="flex items-center gap-4">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={me.user.coinBalance}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="hidden md:flex items-center gap-1.5 bg-accent/50 px-3 py-1.5 rounded-full border border-white/5"
                >
                  <Coins className="h-4 w-4 text-secondary" />
                  <span className="font-mono text-sm font-medium text-secondary">{me.user.coinBalance}</span>
                </motion.div>
              </AnimatePresence>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <UserCircle className="h-6 w-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{me.user.username}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {me.user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="md:hidden p-2">
                    <div className="flex items-center gap-2 mb-2 text-sm">
                      <Coins className="h-4 w-4 text-secondary" />
                      <span className="font-mono">{me.user.coinBalance} Coins</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator className="md:hidden" />
                  <DropdownMenuItem asChild>
                    <Link href="/lobby" className="cursor-pointer w-full">Lobby</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/leaderboard" className="cursor-pointer w-full">Leaderboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/history" className="cursor-pointer w-full">Match History</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer w-full">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/rewards" className="cursor-pointer w-full">Rewards</Link>
                  </DropdownMenuItem>
                  {me.user.isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer w-full text-primary">Admin Panel</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(219,39,119,0.4)]" asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
