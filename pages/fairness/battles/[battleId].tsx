import React from 'react';

const BattleFairnessPage: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#090d16] p-6 text-gray-200">
      <div className="mx-auto max-w-3xl rounded-xl border border-gray-700 bg-[#101726] p-5">
        <h1 className="text-2xl font-black text-white">Battle Fairness Verification</h1>
        <p className="mt-2 text-sm text-gray-400">serverSeedHash, serverSeedReveal, player clientSeeds, and round proofs should be displayed by your route loader.</p>
        <div className="mt-4 space-y-3 text-sm">
          <section className="rounded border border-gray-700 bg-[#0b1220] p-3">
            <h2 className="font-bold text-white">How to verify</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-gray-300">
              <li>Confirm serverSeedHash matches pre-commit hash.</li>
              <li>Recompute each round roll from seeds + nonce.</li>
              <li>Validate item mapping against box odds table.</li>
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
};

export default BattleFairnessPage;
