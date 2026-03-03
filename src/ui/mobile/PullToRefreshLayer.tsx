import React from 'react';
import { usePullToRefresh } from './usePullToRefresh';
import { PullIndicator } from './PullIndicator';

type PullToRefreshLayerProps = {
  enabled: boolean;
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
};

export const PullToRefreshLayer: React.FC<PullToRefreshLayerProps> = ({ enabled, onRefresh, children }) => {
  const { pullDistance, isPulling, isReady, isRefreshing, contentStyle } = usePullToRefresh({ enabled, onRefresh });

  return (
    <>
      <PullIndicator
        visible={enabled && (isPulling || isRefreshing)}
        isReady={isReady}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
      />
      <div style={enabled ? contentStyle : undefined}>{children}</div>
    </>
  );
};
