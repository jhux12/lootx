import React, { useEffect, useState, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';

interface UpgraderSpinnerProps {
  chance: number;
  onFinish: (isWin: boolean) => void;
  isSpinning: boolean;
}

export const UpgraderSpinner: React.FC<UpgraderSpinnerProps> = ({
  chance,
  onFinish,
  isSpinning,
}) => {
  const controls = useAnimation();
  const [rotation, setRotation] = useState(0);
  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // The win zone is a segment of the circle
  // We'll start it at the top (270 degrees)
  const winZoneAngle = (chance / 100) * 360;
  const dashOffset = circumference - (chance / 100) * circumference;

  useEffect(() => {
    if (isSpinning) {
      startSpin();
    }
  }, [isSpinning]);

  const startSpin = async () => {
    // Determine result first
    const isWin = Math.random() * 100 <= chance;
    
    // Calculate target rotation
    // We want at least 5 full rotations (1800 deg)
    // Plus a random offset within the win or lose zone
    const baseRotations = 5 * 360;
    let finalAngle = 0;
    
    if (isWin) {
      // Land between 0 and winZoneAngle
      finalAngle = Math.random() * winZoneAngle;
    } else {
      // Land between winZoneAngle and 360
      finalAngle = winZoneAngle + Math.random() * (360 - winZoneAngle);
    }

    // Adjust for the fact that 0 deg is at the top (12 o'clock)
    // SVG stroke-dasharray starts at 3 o'clock (90 deg) by default if not rotated
    // But we rotate the SVG container -90deg in CSS to start at top.
    
    const totalRotation = baseRotations + finalAngle;

    await controls.start({
      rotate: totalRotation,
      transition: {
        duration: 4,
        ease: [0.45, 0.05, 0.55, 0.95], // Custom cubic-bezier for "slowing down" feel
      },
    });

    setTimeout(() => {
      onFinish(isWin);
    }, 500);
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Background Track */}
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-800"
        />
        {/* Win Zone Segment */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
        />
      </svg>

      {/* Center Info */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-white">{chance.toFixed(1)}%</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chance</span>
      </div>

      {/* Needle / Indicator */}
      <motion.div
        animate={controls}
        className="absolute inset-0 flex items-start justify-center"
        style={{ transformOrigin: 'center' }}
      >
        <div className="w-1 h-10 bg-white rounded-full mt-[-4px] relative shadow-[0_0_10px_rgba(255,255,255,0.8)]">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 rounded-sm" />
        </div>
      </motion.div>

      {/* Outer Glow Decor */}
      <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" />
      <div className="absolute inset-[-10px] rounded-full border border-white/5 pointer-events-none" />
    </div>
  );
};
