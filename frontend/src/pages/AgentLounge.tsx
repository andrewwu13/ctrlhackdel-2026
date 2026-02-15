import { useNavigate } from "react-router-dom";
import LiquidSilkBg from "@/components/LiquidSilkBg";

const AgentLounge = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <LiquidSilkBg />

      <div className="relative z-10 text-center space-y-4 px-4">
        <h1 className="font-display text-5xl font-bold text-foreground">Agent Launched</h1>
        <p className="text-muted-foreground">Your agent session is now active.</p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
        >
          Back to Landing
        </button>
      </div>
    </div>
  );
};

export default AgentLounge;
