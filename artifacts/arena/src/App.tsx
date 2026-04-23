import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import AuthPage from "@/pages/auth";
import LobbyPage from "@/pages/lobby";
import MatchDetailsPage from "@/pages/match-details";
import ProfilePage from "@/pages/profile";
import RewardsPage from "@/pages/rewards";
import AdminPage from "@/pages/admin";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={AuthPage} />
        <Route path="/signup" component={AuthPage} />
        <Route path="/lobby" component={LobbyPage} />
        <Route path="/matches/:id" component={MatchDetailsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/rewards" component={RewardsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
