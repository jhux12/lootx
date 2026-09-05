import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { MysteryBox } from '../types';
import { getConfiguredHomepageSummaries, getHomepageSummaries, invalidateHomepageSummaries } from '../utils/boxRepository';
import { usePerformanceMode } from '../src/lib/performance';
import { FigmaHomePage } from '../src/figma/FigmaHomePage';

type HomeReplicaProps = {
  demoBoxId?: string | null;
  trendingBoxIds?: string[];
  isChatCollapsed: boolean;
  onOpenBox: (boxId: string, isFree?: boolean) => void;
  onViewAllBoxes: () => void;
  onSignUp: () => void;
};

const PROMO_BOX_ID = 'JjVFjwx4lcXIXe3SZuAm';

/** Lean data adapter for the Figma homepage. */
export const HomeReplica: React.FC<HomeReplicaProps> = ({ demoBoxId, trendingBoxIds = [], onOpenBox, onViewAllBoxes }) => {
  const performanceMode = usePerformanceMode();
  const [homepageBoxes, setHomepageBoxes] = useState<MysteryBox[]>([]);
  const [configuredBoxes, setConfiguredBoxes] = useState<MysteryBox[]>([]);
  const [summaryError, setSummaryError] = useState(false);
  const summaryLimit = performanceMode.isMobile ? 12 : 24;

  const loadSummaries = useCallback(() => {
    setSummaryError(false);
    void getHomepageSummaries(summaryLimit).then(setHomepageBoxes).catch(() => setSummaryError(true));
  }, [summaryLimit]);

  useEffect(() => loadSummaries(), [loadSummaries]);

  const configuredIds = useMemo(
    () => Array.from(new Set([...trendingBoxIds, ...(demoBoxId ? [demoBoxId] : []), PROMO_BOX_ID])),
    [demoBoxId, trendingBoxIds]
  );
  const configuredIdKey = configuredIds.join('|');

  useEffect(() => {
    let cancelled = false;
    void getConfiguredHomepageSummaries(configuredIds, homepageBoxes).then((selected) => {
      if (!cancelled) setConfiguredBoxes(selected);
    });
    return () => { cancelled = true; };
  }, [configuredIdKey, homepageBoxes]);

  const boxes = useMemo(() => {
    const byId = new Map(homepageBoxes.map((box) => [box.id, box]));
    configuredBoxes.forEach((box) => byId.set(box.id, box));
    return [...byId.values()];
  }, [configuredBoxes, homepageBoxes]);

  return (
    <div className="lootx-page-shell min-h-screen">
      {summaryError ? <div className="bet-home-error" role="status">Packs are temporarily unavailable. <button type="button" onClick={() => { invalidateHomepageSummaries(summaryLimit); loadSummaries(); }}>Retry</button></div> : null}
      <FigmaHomePage boxes={boxes} onOpenBox={onOpenBox} onViewAllBoxes={onViewAllBoxes} />
    </div>
  );
};
