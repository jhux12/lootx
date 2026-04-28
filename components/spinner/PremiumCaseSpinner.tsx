import React from 'react';
import { CaseItem } from '../../types';
import { SpinnerItem } from './SpinnerItem';
import {
  getTargetTranslate,
  SPINNER_ITEM_GAP_DESKTOP,
  SPINNER_ITEM_GAP_MOBILE,
  SPINNER_ITEM_WIDTH_DESKTOP,
  SPINNER_ITEM_WIDTH_MOBILE
} from './positioning';
import './premiumSpinner.css';

interface PremiumCaseSpinnerProps {
  items: CaseItem[];
  currentCenterIndex: number;
  winnerIndex: number;
  transitionMs: number;
  animationPhase: 'idle' | 'spinning' | 'settling';
  isMobileViewport: boolean;
  spinnerViewportHeight: number;
  isBoxPreviewVisible: boolean;
}

const SPINNER_DEBUG_KEY = 'pullz:spinner-debug';

export const PremiumCaseSpinner: React.FC<PremiumCaseSpinnerProps> = ({
  items,
  currentCenterIndex,
  winnerIndex,
  transitionMs,
  animationPhase,
  isMobileViewport,
  spinnerViewportHeight,
  isBoxPreviewVisible
}) => {
  const spinnerRef = React.useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = React.useState({
    itemWidth: isMobileViewport ? SPINNER_ITEM_WIDTH_MOBILE : SPINNER_ITEM_WIDTH_DESKTOP,
    gap: isMobileViewport ? SPINNER_ITEM_GAP_MOBILE : SPINNER_ITEM_GAP_DESKTOP,
    viewportWidth: 0
  });
  const isDebug = typeof window !== 'undefined' && window.localStorage.getItem(SPINNER_DEBUG_KEY) === '1';

  const measureMetrics = React.useCallback(() => {
    const spinner = spinnerRef.current;
    if (!spinner) return;
    const sampleItems = Array.from(spinner.querySelectorAll<HTMLElement>('.spinner-item'));
    const first = sampleItems[0];
    const second = sampleItems[1];
    const viewportWidth = spinner.getBoundingClientRect().width;
    const fallbackWidth = isMobileViewport ? SPINNER_ITEM_WIDTH_MOBILE : SPINNER_ITEM_WIDTH_DESKTOP;
    const fallbackGap = isMobileViewport ? SPINNER_ITEM_GAP_MOBILE : SPINNER_ITEM_GAP_DESKTOP;
    const itemWidth = first ? first.getBoundingClientRect().width : fallbackWidth;
    const gap = first && second
      ? second.getBoundingClientRect().left - first.getBoundingClientRect().left - itemWidth
      : fallbackGap;
    setMetrics({ itemWidth, gap: Number.isFinite(gap) ? gap : fallbackGap, viewportWidth });
  }, [isMobileViewport]);

  React.useEffect(() => {
    measureMetrics();
    const spinner = spinnerRef.current;
    if (!spinner) return;
    const observer = new ResizeObserver(() => measureMetrics());
    observer.observe(spinner);
    return () => observer.disconnect();
  }, [items.length, isMobileViewport, measureMetrics]);

  React.useEffect(() => {
    if (!isDebug || animationPhase !== 'idle' || !spinnerRef.current) return;
    const itemFullWidth = metrics.itemWidth + metrics.gap;
    const targetTranslate = getTargetTranslate(metrics.viewportWidth, metrics.itemWidth, metrics.gap, winnerIndex);
    const finalItemCenter = (winnerIndex * itemFullWidth) + (metrics.itemWidth / 2) + targetTranslate;
    const viewportCenter = metrics.viewportWidth / 2;
    const withinOnePixel = Math.abs(finalItemCenter - viewportCenter) <= 1;
    console.debug('[Pullz Spinner Debug]', {
      viewportWidth: metrics.viewportWidth,
      itemWidth: metrics.itemWidth,
      gap: metrics.gap,
      itemFullWidth,
      winningIndex: winnerIndex,
      targetTranslate,
      finalItemCenter,
      viewportCenter,
      withinOnePixel
    });
  }, [animationPhase, isDebug, metrics.gap, metrics.itemWidth, metrics.viewportWidth, winnerIndex]);

  return (
    <div
      ref={spinnerRef}
      className={`spinner-container absolute inset-0 z-[19] overflow-hidden transition-opacity duration-300 ${isBoxPreviewVisible ? 'opacity-0' : 'opacity-100'}`}
      style={{ height: `${spinnerViewportHeight}px` }}
    >
      <div className="spinner-center-line" />
      {isDebug && <div className="pointer-events-none absolute inset-y-0 left-1/2 z-50 w-px -translate-x-1/2 bg-fuchsia-400/80" />}
      <div className="spinner relative h-full w-full">
        {items.map((item, index) => (
          <SpinnerItem
            key={`${item.id}-${index}`}
            item={item}
            index={index}
            currentCenterIndex={currentCenterIndex}
            isCenter={animationPhase === 'idle' && index === winnerIndex}
            transitionMs={transitionMs}
            animationPhase={animationPhase}
            isMobileViewport={isMobileViewport}
            itemWidth={metrics.itemWidth}
            itemFullWidth={metrics.itemWidth + metrics.gap}
          />
        ))}
      </div>
    </div>
  );
};
