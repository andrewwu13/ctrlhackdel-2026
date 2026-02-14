import { useState } from "react";
import { motion } from "framer-motion";
import LiquidSilkBg from "@/components/LiquidSilkBg";
import { Send, Calendar, MapPin } from "lucide-react";

const DEMO_MESSAGES = [
  { from: "agent", text: "Connection established. You've been matched with Priya — 94.2% compatibility." },
  { from: "them", text: "Hey! Your agent was really thorough 😄" },
  { from: "me", text: "Haha right? Apparently we both value innovation and autonomy." },
  { from: "them", text: "And sustainable architecture! My agent mentioned that too." },
];

const ConnectionVault = () => {
  const [messages] = useState(DEMO_MESSAGES);
  const [input, setInput] = useState("");

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <LiquidSilkBg />

      <div className="relative z-10 flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <motion.div
          className="text-center mb-6 space-y-1"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-2xl font-bold text-foreground">
            Connection <span className="text-gradient-gold">Vault</span>
          </h1>
          <p className="text-muted-foreground text-sm">Encrypted · Private · Real</p>
        </motion.div>

        {/* Date Scheduler Card */}
        <motion.div
          className="glass rounded-xl p-4 mb-4 flex items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Suggested Date</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Innovation Hub Café — Saturday 7 PM
            </p>
          </div>
          <button className="text-xs px-3 py-1.5 rounded-lg bg-accent text-accent-foreground font-medium cursor-pointer hover:bg-accent/90 transition-colors">
            Accept
          </button>
        </motion.div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto mb-4">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.2 }}
            >
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm ${
                  msg.from === "me"
                    ? "bg-primary/20 text-foreground rounded-br-md"
                    : msg.from === "agent"
                    ? "bg-accent/10 text-accent border border-accent/20 rounded-bl-md"
                    : "glass text-foreground rounded-bl-md"
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Input */}
        <motion.div
          className="glass rounded-2xl flex items-center gap-2 p-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <button className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default ConnectionVault;
