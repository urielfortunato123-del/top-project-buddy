import React, { useEffect, useState } from "react";
import logoEssencial from "@/assets/logo-essencial.png";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress bar over 5 seconds
    const duration = 5000;
    const interval = 50;
    const increment = (100 / duration) * interval;
    
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        return next >= 100 ? 100 : next;
      });
    }, interval);

    // Show splash for 5 seconds, then fade out
    const timer = setTimeout(() => {
      setFadeOut(true);
    }, duration);

    // Complete after fade animation
    const completeTimer = setTimeout(() => {
      onComplete();
    }, duration + 700);

    return () => {
      clearInterval(progressTimer);
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted transition-opacity duration-700 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Logo with entrance animation */}
      <div className="animate-scale-in">
        <img 
          src={logoEssencial} 
          alt="Essencial - Sistema em Ordem" 
          className="w-64 h-auto mb-8 drop-shadow-2xl"
        />
      </div>

      {/* Progress bar */}
      <div 
        className="w-64 h-1.5 bg-muted rounded-full overflow-hidden mb-6 animate-fade-in"
        style={{ animationDelay: "0.3s", animationFillMode: "both" }}
      >
        <div 
          className="h-full bg-gradient-to-r from-primary via-primary to-accent rounded-full transition-all duration-100 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Loading text */}
      <div 
        className="animate-fade-in text-center" 
        style={{ animationDelay: "0.5s", animationFillMode: "both" }}
      >
        <p className="text-sm text-muted-foreground">
          Carregando... <span className="font-semibold text-primary">{Math.round(progress)}%</span>
        </p>
        <p className="text-xs text-muted-foreground/70 mt-4">
          Desenvolvido por <span className="font-semibold text-primary">Uriel da Fonseca Fortunato</span>
        </p>
      </div>
    </div>
  );
}
