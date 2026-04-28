export const SPINNER_ITEM_WIDTH = 195;
export const SPINNER_CENTER_OFFSET = -97.5;

export const getSpinnerItemTranslate = (index: number, currentCenterIndex: number) => {
  const x = (index - currentCenterIndex) * SPINNER_ITEM_WIDTH;
  return `translate3d(${x}px, ${SPINNER_CENTER_OFFSET}px, 0)`;
};
