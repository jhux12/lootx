import React from 'react';
import { CaseItem } from '../../types';
import { SpinnerItem } from './SpinnerItem';

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

export const PremiumCaseSpinner: React.FC<PremiumCaseSpinnerProps> = ({
  items,
  currentCenterIndex,
  winnerIndex,
  transitionMs,
  animationPhase,
  isMobileViewport,
  spinnerViewportHeight,
  isBoxPreviewVisible
}) => (
  <div
    className={`spinner-container absolute inset-0 z-[19] overflow-hidden transition-opacity duration-300 ${isBoxPreviewVisible ? 'opacity-0' : 'opacity-100'}`}
    style={{ height: `${spinnerViewportHeight}px` }}
  >
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
        />
      ))}
    </div>
  </div>
);
