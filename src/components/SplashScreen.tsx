import React, { useEffect, useState } from "react";
import logoEssencial from "@/assets/logo-essencial.png";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Show splash for 2.5 seconds, then fade out
    const timer = setTimeout(() => {
      setFadeOut(true);
    }, 2500);

    // Complete after fade animation
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3200);

    return () => {
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

      {/* Loading indicator */}
      <div className="flex items-center gap-2 mb-8 animate-fade-in" style={{ animationDelay: "0.5s" }}>
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>

      {/* Developer credit */}
      <div 
        className="animate-fade-in text-center" 
        style={{ animationDelay: "0.8s", animationFillMode: "both" }}
      >
        <p className="text-sm text-muted-foreground">Carregando...</p>
        <p className="text-xs text-muted-foreground/70 mt-4">
          Desenvolvido por <span className="font-semibold text-primary">Uriel da Fonseca Fortunato</span>
        </p>
      </div>
    </div>
  );
}
