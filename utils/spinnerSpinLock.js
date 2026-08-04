/**
 * Creates the immutable client-side record for one already-decided spin.
 * Award selection happens before this function is called; this module only
 * preserves the visual reel used to present that result.
 */
export const createLockedSpinState = ({
  resultId,
  nonce,
  winningItemId,
  winningIndex,
  reelItems,
  startTranslateX,
  finalTranslateX,
  cardWidth,
  reelGap,
  viewportWidth
}) => {
  if (!resultId || !winningItemId) throw new Error('A spin result and winning item are required.');
  if (!Number.isInteger(winningIndex) || winningIndex < 0 || winningIndex >= reelItems.length) {
    throw new Error('The winning index is outside the locked reel.');
  }
  if (reelItems[winningIndex]?.id !== winningItemId) {
    throw new Error('The locked reel does not contain the server winner at the target index.');
  }

  return Object.freeze({
    resultId,
    nonce,
    winningItemId,
    winningIndex,
    targetReelIndex: winningIndex,
    reelItems: Object.freeze([...reelItems]),
    startTranslateX,
    finalTranslateX,
    geometry: Object.freeze({ cardWidth, reelGap, viewportWidth })
  });
};

/** Calculate alignment from actual laid-out card geometry, never viewport breakpoints. */
export const calculateCardCenteredTranslate = ({ viewportWidth, cardOffsetLeft, cardWidth }) => (
  (viewportWidth / 2) - (cardOffsetLeft + (cardWidth / 2))
);

/** The displayed result is always read from the immutable result index. */
export const getLockedWinningItem = (spin) => {
  const item = spin.reelItems[spin.winningIndex];
  if (!item || item.id !== spin.winningItemId) throw new Error('Locked spinner result integrity check failed.');
  return item;
};
