import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Trophy, Crosshair, Users, ChevronRight, Gamepad2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col justify-center overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 z-0">
          <img
            src="/hero-bg.png"
            alt="Arena Background"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
        </div>

        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent drop-shadow-sm">
                Dominate the <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Arena</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl">
                Join high-stakes Free Fire tournaments, climb the leaderboards, and win real rewards. The ultimate competitive experience starts here.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="h-14 px-8 text-lg font-bold shadow-[0_0_30px_rgba(219,39,119,0.3)] hover:shadow-[0_0_40px_rgba(219,39,119,0.5)] transition-all bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                  <Link href="/lobby">
                    Enter Lobby <ChevronRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-white/10 hover:bg-white/5" asChild>
                  <Link href="/signup">Create Account</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-card/30 border-y border-white/5">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Trophy,
                title: "Daily Tournaments",
                desc: "Compete in daily paid and free matches. Win coins and exchange them for massive rewards.",
                color: "text-yellow-500",
              },
              {
                icon: Crosshair,
                title: "Skill Based",
                desc: "Fair matchmaking ensuring you play against opponents of similar skill levels.",
                color: "text-primary",
              },
              {
                icon: Users,
                title: "Active Community",
                desc: "Join thousands of competitive players in the fastest growing esports platform.",
                color: "text-secondary",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-card p-8 rounded-2xl border border-white/5 hover:border-primary/50 transition-colors group"
              >
                <div className={`h-12 w-12 rounded-xl bg-background flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg ${feature.color}`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
