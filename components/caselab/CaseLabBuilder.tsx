import React, { useMemo } from 'react';
import { ChevronLeft, FlaskConical } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useCaseLabBuilder } from '../../hooks/useCaseLabBuilder';
import { StepBasics } from './StepBasics';
import { StepItems } from './StepItems';
import { StepReview } from './StepReview';
import { BuildSummary } from './BuildSummary';
import { StickyActionBar } from './StickyActionBar';

const stepLabels = ['Basics', 'Add Items', 'Review & Publish'];

export const CaseLabBuilder: React.FC = () => {
  const { createUserBox, items, boxes, stripeSettings, setView } = useGame();

  const {
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
    calculatedPrice,
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
    targetEv,
    riskLevel
  } = useCaseLabBuilder({ items, stripeSettings, createUserBox, setView });

  const imageOptions = useMemo(
    () => boxes.filter((box) => !box.isUserCreated).slice(0, 12),
    [boxes]
  );

  const canProceedBasics = Boolean(caseName.trim()) && Boolean(coverImage);
  const canProceedItems = selectedItems.length > 0;
  const canProceed = step === 1 ? canProceedBasics : step === 2 ? canProceedItems : true;

  const handleNext = () => {
    if (step === 1 && !canProceedBasics) {
      setStatusMessage({ tone: 'error', message: 'Add a case name and cover to continue.' });
      return;
    }
    if (step === 2 && !canProceedItems) {
      setStatusMessage({ tone: 'error', message: 'Select at least one item to continue.' });
      return;
    }
    setStep((prev) => Math.min(3, prev + 1));
  };

  const handlePrevious = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setView({ type: 'HOME' })}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0b0f16] px-3 py-1.5 text-sm font-semibold text-gray-300 transition hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          {step > 1 && (
            <button
              type="button"
              onClick={handlePrevious}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-gray-300 transition hover:text-white"
            >
              Previous step
            </button>
          )}
        </div>
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-brand-purple/40 bg-brand-purple/20 p-2">
            <FlaskConical className="h-6 w-6 text-brand-purple" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white">Case Lab</h1>
            <p className="text-sm text-gray-400">Build a custom case in three easy steps.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
              {stepLabels.map((label, index) => {
                const stepIndex = index + 1;
                const isActive = stepIndex === step;
                const isComplete = stepIndex < step;
                return (
                  <div
                    key={label}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
                      isActive
                        ? 'border-brand-purple/70 bg-brand-purple/20 text-purple-200'
                        : isComplete
                          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                          : 'border-white/10 bg-white/5 text-gray-400'
                    }`}
                  >
                    <span className="text-[11px] font-semibold">{stepIndex}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            statusMessage.tone === 'success'
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
              : statusMessage.tone === 'error'
                ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
                : 'border-white/10 bg-white/5 text-gray-300'
          }`}
        >
          {statusMessage.message}
        </div>
      )}

      <div className="lg:hidden">
        <BuildSummary
          caseName={caseName}
          coverImage={coverImage}
          selectedCount={selectedCount}
          selectedItems={selectedItems}
          targetEv={targetEv}
          riskLevel={riskLevel}
          sellBackPercent={stripeSettings.caseLabSellBackPercent}
          publishFee={stripeSettings.caseLabPublishFeeCoins}
          calculatedPrice={calculatedPrice}
          calculatedEv={calculatedEv}
          lastCalculated={lastCalculated}
          collapsible
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {step === 1 && (
            <StepBasics
              caseName={caseName}
              onNameChange={(value) => {
                setCaseName(value);
                setStatusMessage(null);
              }}
              coverImage={coverImage}
              imageOptions={imageOptions}
              onCoverSelect={(image) => {
                setCoverImage(image);
                setStatusMessage(null);
              }}
            />
          )}
          {step === 2 && (
            <StepItems
              searchQuery={searchQuery}
              onSearchChange={(value) => {
                setSearchQuery(value);
                setStatusMessage(null);
              }}
              tagOptions={tagOptions}
              activeTag={activeTag}
              onTagChange={(tag) => {
                setActiveTag(tag as typeof activeTag);
                setStatusMessage(null);
              }}
              filteredItems={filteredItems}
              selectedItems={selectedItems}
              onToggleItem={toggleItem}
              onRemoveItem={removeItem}
            />
          )}
          {step === 3 && (
            <StepReview
              selectedItems={selectedItems}
              selectedCount={selectedCount}
              minValue={selectedValueStats.min}
              maxValue={selectedValueStats.max}
              avgValue={selectedValueStats.avg}
              calculatedPrice={calculatedPrice}
              calculatedEv={calculatedEv}
              lastCalculated={lastCalculated}
              onSynthesize={synthesizeOdds}
              onPublish={publish}
              isSynthesizing={isSynthesizing}
              isPublishing={isPublishing}
            />
          )}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-24">
            <BuildSummary
              caseName={caseName}
              coverImage={coverImage}
              selectedCount={selectedCount}
              selectedItems={selectedItems}
              targetEv={targetEv}
              riskLevel={riskLevel}
              sellBackPercent={stripeSettings.caseLabSellBackPercent}
              publishFee={stripeSettings.caseLabPublishFeeCoins}
              calculatedPrice={calculatedPrice}
              calculatedEv={calculatedEv}
              lastCalculated={lastCalculated}
            />
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#121826] p-4">
              <button
                type="button"
                onClick={step === 3 ? (lastCalculated ? publish : synthesizeOdds) : handleNext}
                disabled={(step < 3 && !canProceed) || isSynthesizing || isPublishing}
                className="w-full rounded-xl bg-brand-purple px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-600 disabled:opacity-50"
              >
                {step < 3
                  ? 'Next'
                  : lastCalculated
                    ? isPublishing
                      ? 'Publishing...'
                      : 'Publish Case'
                    : isSynthesizing
                      ? 'Synthesizing...'
                      : 'Synthesize Odds'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <StickyActionBar
        step={step}
        selectedCount={selectedCount}
        lastCalculated={lastCalculated}
        canProceed={canProceed}
        isSynthesizing={isSynthesizing}
        isPublishing={isPublishing}
        onNext={handleNext}
        onSynthesize={synthesizeOdds}
        onPublish={publish}
      />
    </div>
  );
};
