import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import LiquidSilkBg from "@/components/LiquidSilkBg";
import { Mic, MicOff, Check } from "lucide-react";

const VALUES = [
  "Innovation", "Adventure", "Empathy", "Creativity",
  "Ambition", "Humor", "Loyalty", "Spirituality",
  "Sustainability", "Family", "Freedom", "Knowledge",
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0=values, 1=voice, 2=complete
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceDone, setVoiceDone] = useState(false);

  const toggleValue = (v: string) => {
    setSelectedValues((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      setVoiceDone(true);
    } else {
      setIsRecording(true);
      // Auto-stop after 5s for demo
      setTimeout(() => {
        setIsRecording(false);
        setVoiceDone(true);
      }, 5000);
    }
  };

  const completedBricks = [selectedValues.length > 0, voiceDone];
  const brickCount = (step === 0 ? 0 : 1) + (voiceDone ? 1 : 0);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <LiquidSilkBg />

      <div className="relative z-10 w-full max-w-2xl px-4 py-12">
        {/* Progress Tower */}
        <div className="flex justify-center mb-10 gap-2">
          {[0, 1].map((i) => (
            <motion.div
              key={i}
              className={`w-16 h-8 rounded-lg lego-stud ${
                i < brickCount
                  ? "bg-primary glow-rose"
                  : "glass"
              }`}
              initial={{ scale: 0, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: i * 0.2, type: "spring", stiffness: 200 }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="values"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="font-display text-3xl font-bold text-foreground">
                  Build Your <span className="text-gradient-rose">Soul Vector</span>
                </h2>
                <p className="text-muted-foreground">Select the values that define you</p>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {VALUES.map((value, i) => {
                  const isSelected = selectedValues.includes(value);
                  return (
                    <motion.button
                      key={value}
                      onClick={() => toggleValue(value)}
                      className={`relative px-4 py-4 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer lego-stud ${
                        isSelected
                          ? "bg-primary/20 border border-primary glow-rose text-primary-foreground"
                          : "glass hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05, type: "spring" }}
                      whileTap={{ scale: 0.92 }}
                    >
                      {isSelected && (
                        <motion.div
                          className="absolute inset-0 rounded-xl bg-primary/10"
                          layoutId="selected-glow"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        />
                      )}
                      {value}
                    </motion.button>
                  );
                })}
              </div>

              <motion.button
                onClick={() => setStep(1)}
                disabled={selectedValues.length < 3}
                className="w-full py-4 rounded-xl font-display font-semibold text-lg bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-all cursor-pointer glow-rose"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Continue ({selectedValues.length}/3+)
              </motion.button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-8 text-center"
            >
              <div className="space-y-2">
                <h2 className="font-display text-3xl font-bold text-foreground">
                  <span className="text-gradient-gold">Voice Imprint</span>
                </h2>
                <p className="text-muted-foreground">Let your agent learn your voice</p>
              </div>

              {/* Waveform Visualization */}
              <div className="flex items-center justify-center gap-1 h-24">
                {[...Array(24)].map((_, i) => (
                  <motion.div
                    key={i}
                    className={`w-1.5 rounded-full ${isRecording ? "bg-primary" : "bg-muted-foreground/30"}`}
                    animate={{
                      height: isRecording
                        ? [8, 20 + Math.random() * 40, 8]
                        : voiceDone ? [4, 12 + Math.sin(i * 0.5) * 8, 4] : 8,
                    }}
                    transition={{
                      duration: isRecording ? 0.4 + Math.random() * 0.3 : 2,
                      repeat: Infinity,
                      delay: i * 0.05,
                    }}
                  />
                ))}
              </div>

              {/* Mic button */}
              <motion.button
                onClick={handleVoiceRecord}
                className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isRecording
                    ? "bg-primary glow-rose animate-pulse"
                    : voiceDone
                    ? "bg-accent glow-gold"
                    : "glass hover:bg-secondary/50"
                }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {voiceDone ? (
                  <Check className="w-8 h-8 text-accent-foreground" />
                ) : isRecording ? (
                  <MicOff className="w-8 h-8 text-primary-foreground" />
                ) : (
                  <Mic className="w-8 h-8 text-foreground" />
                )}
              </motion.button>

              <p className="text-muted-foreground text-sm">
                {isRecording ? "Recording... speak naturally" : voiceDone ? "Voice captured!" : "Tap to start recording"}
              </p>

              {voiceDone && (
                <motion.button
                  onClick={() => navigate("/lounge")}
                  className="w-full py-4 rounded-xl font-display font-semibold text-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer glow-rose"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Launch Your Agent →
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
