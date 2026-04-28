export const SPINNER_ITEM_WIDTH = 195;

export const getSpinnerItemTranslate = (
  index: number,
  currentCenterIndex: number,
  itemWidth: number,
  gap: number
) => {
  const itemFullWidth = itemWidth + gap;
  const x = ((index - currentCenterIndex) * itemFullWidth) - (itemWidth / 2);
  const y = -(itemWidth / 2);
  return `translate3d(${x}px, ${y}px, 0)`;
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
