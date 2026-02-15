import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import LiquidSilkBg from "@/components/LiquidSilkBg";
import LegoRose from "@/components/LegoRose";

const Index = () => {
  const router = useRouter();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <LiquidSilkBg />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-rose/30"
          style={{
            left: `${15 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: 4 + i,
            repeat: Infinity,
            delay: i * 0.5,
          }}
        />
      ))}

      {/* Hero content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-4">
        {/* LEGO Rose */}
        <motion.div
          className="animate-float"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <LegoRose size={240} />
        </motion.div>

        {/* Title */}
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          <h1 className="font-display text-6xl md:text-8xl font-black tracking-tight">
            <span className="text-gradient-rose">Soul</span>
            <span className="text-foreground">Bound</span>
          </h1>
          <motion.p
            className="text-muted-foreground text-lg md:text-xl max-w-md mx-auto font-light"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            Your AI agent finds your match.
            <br />
            <span className="text-gold-soft">No swiping. No hassle. Just connection.</span>
          </motion.p>
        </motion.div>

        {/* CTA Button */}
        <motion.button
          onClick={() => router.push("/onboarding")}
          className="glass glow-rose px-10 py-4 rounded-2xl font-display font-semibold text-lg text-primary-foreground bg-primary/80 hover:bg-primary transition-all duration-300 cursor-pointer"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          whileHover={{ scale: 1.05, boxShadow: "0 0 40px -5px hsla(350, 78%, 56%, 0.6)" }}
          whileTap={{ scale: 0.98 }}
        >
          Begin Soul-Sync
        </motion.button>

        {/* Subtitle */}
        <motion.p
          className="text-muted-foreground/60 text-sm font-light tracking-widest uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.8 }}
        >
          Agentic Matchmaking · Powered by AI
        </motion.p>
      </div>
    </div>
  );
};

export default Index;
