"use client";

import { useState } from "react";
import Image from "next/image";
import { MessageSquare } from "lucide-react";
import { BRAND_CONFIG } from "@/config/brand";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  iconOnly?: boolean;
  showText?: boolean;
}

export function BrandLogo({ className, iconOnly = false, showText = true }: BrandLogoProps) {
  const [imageError, setImageError] = useState(false);

  if (!imageError && BRAND_CONFIG.logo.src) {
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <div className="relative flex h-8 w-auto items-center">
          <Image
            src={BRAND_CONFIG.logo.src}
            alt={BRAND_CONFIG.logo.alt}
            width={BRAND_CONFIG.logo.width}
            height={BRAND_CONFIG.logo.height}
            className="h-8 w-auto object-contain"
            onError={() => setImageError(true)}
            priority
          />
        </div>
      </div>
    );
  }

  // Fallback SVG / icon branding mark
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">
        <MessageSquare className="h-4 w-4" />
      </div>
      {!iconOnly && showText && (
        <span className="text-sm font-semibold tracking-tight text-foreground">
          {BRAND_CONFIG.shortName}
        </span>
      )}
    </div>
  );
}
