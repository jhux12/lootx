import { useCallback, useMemo, useState } from 'react';
import { BoxTag, BOX_TAG_OPTIONS, CaseItem, MysteryBox, StripeSettings } from '../types';
import { buildOddsWithRiskAndTargetEV, buildRiskAdjustedOdds, calculateExpectedValue } from '../utils/caseOdds';

type StatusTone = 'success' | 'error' | 'info';

type StatusMessage = {
  tone: StatusTone;
  message: string;
} | null;

type UseCaseLabBuilderProps = {
  items: CaseItem[];
  stripeSettings: StripeSettings;
  createUserBox: (box: MysteryBox) => Promise<string>;
  setView: (view: { type: string; boxId?: string }) => void;
};

const DEFAULT_TARGET_EV = 0.85;
const FIXED_RISK_LEVEL = 50;

export const useCaseLabBuilder = ({
  items,
  stripeSettings,
  createUserBox,
  setView
}: UseCaseLabBuilderProps) => {
  const [step, setStep] = useState(1);
  const [caseName, setCaseName] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<'All' | BoxTag>('All');
  const [selectedItems, setSelectedItems] = useState<CaseItem[]>([]);
  const [lastCalculated, setLastCalculated] = useState(false);
  const [boxPrice, setBoxPrice] = useState<number>(0);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);

  const tagOptions = useMemo(() => ['All', ...BOX_TAG_OPTIONS], []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(normalizedQuery);
      const matchesTag = activeTag === 'All' ? true : item.tags?.includes(activeTag);
      return matchesSearch && matchesTag;
    });
  }, [items, searchQuery, activeTag]);

  const selectedCount = selectedItems.length;
  const selectedValueStats = useMemo(() => {
    if (selectedItems.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }

    const prices = selectedItems.map((item) => item.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    return { min, max, avg };
  }, [selectedItems]);

  const calculatedEv = useMemo(
    () => (lastCalculated ? calculateExpectedValue(selectedItems) : 0),
    [lastCalculated, selectedItems]
  );

  const resetCalculated = useCallback(() => {
    setLastCalculated(false);
    setStatusMessage(null);
  }, []);

  const toggleItem = useCallback(
    (item: CaseItem) => {
      setSelectedItems((prev) => {
        const exists = prev.find((entry) => entry.id === item.id);
        if (exists) {
          return prev.filter((entry) => entry.id !== item.id);
        }
        return [...prev, { ...item }];
      });
      resetCalculated();
    },
    [resetCalculated]
  );

  const removeItem = useCallback(
    (id: string) => {
      setSelectedItems((prev) => prev.filter((entry) => entry.id !== id));
      resetCalculated();
    },
    [resetCalculated]
  );

  const synthesizeOdds = useCallback(() => {
    if (selectedItems.length === 0) {
      return;
    }

    setIsSynthesizing(true);
    setStatusMessage(null);

    const baseItems = selectedItems.map((item) => ({ ...item, chance: 0 }));
    const baseOdds = buildRiskAdjustedOdds(baseItems, FIXED_RISK_LEVEL);
    const baseEv = calculateExpectedValue(baseOdds);
    const calculatedPrice = baseEv / DEFAULT_TARGET_EV;
    const updatedItems = buildOddsWithRiskAndTargetEV(
      baseItems,
      FIXED_RISK_LEVEL,
      DEFAULT_TARGET_EV,
      calculatedPrice
    );

    setSelectedItems(updatedItems);
    setBoxPrice(parseFloat(calculatedPrice.toFixed(2)));
    setLastCalculated(true);
    setIsSynthesizing(false);
    setStatusMessage({ tone: 'success', message: 'Odds synthesized. Review your final drop rates.' });
  }, [selectedItems]);

  const publish = useCallback(async () => {
    if (!caseName.trim()) {
      setStatusMessage({ tone: 'error', message: 'Please name your case before publishing.' });
      setStep(1);
      return;
    }
    if (selectedItems.length === 0) {
      setStatusMessage({ tone: 'error', message: 'Please select at least one item for your case.' });
      setStep(2);
      return;
    }
    if (!coverImage) {
      setStatusMessage({ tone: 'error', message: 'Please choose a cover image before publishing.' });
      setStep(1);
      return;
    }
    if (!lastCalculated) {
      setStatusMessage({ tone: 'error', message: 'Please synthesize odds before publishing.' });
      setStep(3);
      return;
    }

    const newBox: MysteryBox = {
      id: `user-box-${Date.now()}`,
      name: caseName,
      price: boxPrice,
      image: coverImage || 'https://picsum.photos/300',
      accentColor: '#8b5cf6',
      tag: 'New',
      items: selectedItems,
      targetEV: DEFAULT_TARGET_EV,
      riskLevel: FIXED_RISK_LEVEL,
      sellBackRate: Math.min(1, Math.max(0, stripeSettings.caseLabSellBackPercent / 100))
    };

    try {
      setIsPublishing(true);
      setStatusMessage(null);
      const publishedBoxId = await createUserBox(newBox);
      setIsPublishing(false);
      setStatusMessage({ tone: 'success', message: 'Case published! Opening your box now.' });
      setView({ type: 'CASE_OPENING', boxId: publishedBoxId });
    } catch (error) {
      console.error('Failed to publish Case Lab box', error);
      setIsPublishing(false);
      setStatusMessage({ tone: 'error', message: 'Unable to publish your Case Lab box right now. Please try again.' });
    }
  }, [boxPrice, caseName, coverImage, createUserBox, lastCalculated, selectedItems, setView, stripeSettings.caseLabSellBackPercent]);

  return {
    step,
    setStep,
    caseName,
    setCaseName,
    coverImage,
    setCoverImage,
    searchQuery,
    setSearchQuery,
    activeTag,
    setActiveTag,
    selectedItems,
    selectedCount,
    selectedValueStats,
    calculatedEv,
    calculatedPrice: boxPrice,
    lastCalculated,
    isSynthesizing,
    isPublishing,
    statusMessage,
    setStatusMessage,
    tagOptions,
    filteredItems,
    toggleItem,
    removeItem,
    synthesizeOdds,
    publish,
    targetEv: DEFAULT_TARGET_EV,
    riskLevel: FIXED_RISK_LEVEL
  };
};
