export const SPINNER_ITEM_WIDTH_DESKTOP = 192;
export const SPINNER_ITEM_WIDTH_MOBILE = 182;
export const SPINNER_ITEM_GAP_DESKTOP = 18;
export const SPINNER_ITEM_GAP_MOBILE = 16;

export const getSpinnerItemTranslate = (
  index: number,
  currentCenterIndex: number,
  itemFullWidth: number
) => {
  const x = (index - currentCenterIndex) * itemFullWidth;
  return `translate3d(calc(-50% + ${x}px), -50%, 0)`;
};

export const getTargetTranslate = (
  spinnerViewportWidth: number,
  itemWidth: number,
  gap: number,
  winningIndex: number
) => {
  const itemFullWidth = itemWidth + gap;
  return (spinnerViewportWidth / 2) - (itemFullWidth * winningIndex) - (itemWidth / 2);
};
