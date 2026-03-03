import { WinSharePayload } from './types';

const WIDTH = 1080;
const HEIGHT = 1920;

const loadImage = async (url: string): Promise<HTMLImageElement> => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.src = url;
  await img.decode();
  return img;
};

const blobFromCanvas = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to export image blob'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });

function drawBase(ctx: CanvasRenderingContext2D, payload: WinSharePayload) {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, '#050811');
  gradient.addColorStop(1, '#111827');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = 'rgba(34,211,238,0.1)';
  ctx.beginPath();
  ctx.arc(WIDTH * 0.85, HEIGHT * 0.16, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(99,102,241,0.12)';
  ctx.beginPath();
  ctx.arc(WIDTH * 0.2, HEIGHT * 0.74, 220, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 58px Inter, system-ui, sans-serif';
  ctx.fillText('Pullz.gg', 88, 140);

  if (payload.boxName) {
    ctx.font = '500 34px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(226,232,240,0.78)';
    ctx.fillText(`Opened: ${payload.boxName}`, 88, 194);
  }
}

function drawBottomText(ctx: CanvasRenderingContext2D, payload: WinSharePayload) {
  const verifiedText = payload.verifiedText || 'Verified ✓';
  const openedAt = payload.openedAtISO ? new Date(payload.openedAtISO) : new Date();

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 58px Inter, system-ui, sans-serif';
  ctx.fillText(payload.itemName, 88, 1440, WIDTH - 176);

  ctx.fillStyle = '#22d3ee';
  ctx.font = '700 48px Inter, system-ui, sans-serif';
  ctx.fillText(payload.itemValueText, 88, 1512);

  ctx.fillStyle = 'rgba(16,185,129,0.2)';
  ctx.fillRect(88, 1556, 260, 62);
  ctx.strokeStyle = 'rgba(16,185,129,0.55)';
  ctx.strokeRect(88, 1556, 260, 62);
  ctx.fillStyle = '#bbf7d0';
  ctx.font = '600 34px Inter, system-ui, sans-serif';
  ctx.fillText(verifiedText, 112, 1598);

  ctx.fillStyle = 'rgba(226,232,240,0.6)';
  ctx.font = '500 26px Inter, system-ui, sans-serif';
  ctx.fillText(openedAt.toLocaleString(), 88, 1834);
}

export async function generateWinStoryImage(payload: WinSharePayload): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Canvas unavailable');

  drawBase(ctx, payload);

  const frameX = 88;
  const frameY = 280;
  const frameW = WIDTH - frameX * 2;
  const frameH = 1020;

  ctx.fillStyle = 'rgba(15,23,42,0.82)';
  ctx.fillRect(frameX, frameY, frameW, frameH);
  ctx.strokeStyle = 'rgba(148,163,184,0.4)';
  ctx.lineWidth = 3;
  ctx.strokeRect(frameX, frameY, frameW, frameH);

  try {
    const image = await loadImage(payload.itemImageUrl);
    const ratio = Math.min(frameW / image.width, frameH / image.height);
    const drawW = image.width * ratio;
    const drawH = image.height * ratio;
    const drawX = frameX + (frameW - drawW) / 2;
    const drawY = frameY + (frameH - drawH) / 2;
    ctx.drawImage(image, drawX, drawY, drawW, drawH);
  } catch {
    ctx.fillStyle = 'rgba(148,163,184,0.2)';
    ctx.fillRect(frameX + 40, frameY + 40, frameW - 80, frameH - 80);
    ctx.fillStyle = 'rgba(226,232,240,0.75)';
    ctx.font = '600 40px Inter, system-ui, sans-serif';
    ctx.fillText('Item preview unavailable', frameX + 180, frameY + frameH / 2);
  }

  drawBottomText(ctx, payload);

  try {
    return await blobFromCanvas(canvas);
  } catch {
    drawBase(ctx, payload);
    ctx.fillStyle = 'rgba(15,23,42,0.9)';
    ctx.fillRect(frameX, frameY, frameW, frameH);
    ctx.strokeStyle = 'rgba(148,163,184,0.35)';
    ctx.strokeRect(frameX, frameY, frameW, frameH);
    ctx.fillStyle = 'rgba(226,232,240,0.7)';
    ctx.font = '600 46px Inter, system-ui, sans-serif';
    ctx.fillText('Text-only share card', frameX + 220, frameY + frameH / 2 - 16);
    drawBottomText(ctx, payload);
    return blobFromCanvas(canvas);
  }
}
