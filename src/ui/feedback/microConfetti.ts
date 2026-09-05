export interface MicroConfettiParticle {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  life: number;
  color: string;
}

const COLORS = ['#205DD7', '#22d3ee', '#ffffff'];

export const createMicroConfetti = (count = 18, colors: string[] = COLORS): MicroConfettiParticle[] => {
  const total = Math.max(15, Math.min(60, count));
  const palette = colors.length ? colors : COLORS;
  return Array.from({ length: total }).map((_, index) => ({
    id: `${Date.now()}-${index}`,
    x: 45 + Math.random() * 10,
    y: 35 + Math.random() * 15,
    dx: (Math.random() - 0.5) * 40,
    dy: 20 + Math.random() * 45,
    size: 3 + Math.random() * 4,
    life: 500 + Math.random() * 200,
    color: palette[Math.floor(Math.random() * palette.length)]
  }));
};
