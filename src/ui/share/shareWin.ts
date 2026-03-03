import { generateWinStoryImage } from './generateWinStoryImage';
import { WinSharePayload } from './types';

const getShareText = (payload: WinSharePayload) =>
  `I just unboxed ${payload.itemName} (${payload.itemValueText}) on Pullz.gg 🎉`;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export async function shareWin(payload: WinSharePayload): Promise<{ ok: boolean; method: string; error?: string }> {
  try {
    const blob = await generateWinStoryImage(payload);
    const file = new File([blob], 'pullz-win.png', { type: 'image/png' });
    const shareText = getShareText(payload);

    if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Pullz.gg Win',
        text: shareText,
        files: [file]
      });
      return { ok: true, method: 'web-share' };
    }

    downloadBlob(blob, 'pullz-win.png');
    return { ok: true, method: 'download' };
  } catch (error) {
    return { ok: false, method: 'none', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
