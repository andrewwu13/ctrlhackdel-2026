import { useEffect, useRef, useState } from "react";

const LiquidSilkBg = () => {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const rafRef = useRef<number>(undefined);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setMousePos({
          x: (e.clientX / window.innerWidth) * 100,
          y: (e.clientY / window.innerHeight) * 100,
        });
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div
        className="absolute inset-0 animate-liquid-silk"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at ${mousePos.x}% ${mousePos.y}%, hsla(350, 78%, 56%, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at ${100 - mousePos.x}% ${100 - mousePos.y}%, hsla(270, 50%, 30%, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, hsla(46, 100%, 50%, 0.03) 0%, transparent 40%),
            linear-gradient(135deg, hsl(270, 50%, 5%) 0%, hsl(270, 45%, 8%) 30%, hsl(280, 40%, 6%) 60%, hsl(270, 50%, 5%) 100%)
          `,
          backgroundSize: "200% 200%",
          transition: "background-image 0.3s ease",
        }}
      />
      {/* Noise overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundSize: "128px 128px",
      }} />
    </div>
  );
};

export default LiquidSilkBg;
