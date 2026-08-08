import React, { useState } from 'react';
import { useManagedFooterPage } from './FooterManagedContent';

type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
};

const EMPTY_FORM: ContactForm = {
  firstName: '',
  lastName: '',
  email: '',
  subject: '',
  message: ''
};

export const ContactSupport: React.FC = () => {
  const managedContent = useManagedFooterPage('contact');
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateField = (field: keyof ContactForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSending(true);

    try {
      const response = await fetch('/api/contact-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Unable to send your message. Please try again.');
      }

      setForm(EMPTY_FORM);
      setStatusMessage('Thanks for contacting us. Your message has been sent to contact@pullz.gg.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send your message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const inputClasses = 'min-h-12 w-full rounded-xl border border-white/10 bg-[#0b0f1a] px-4 py-3 text-base text-white outline-none placeholder:text-gray-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm';

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-16 pt-8 sm:gap-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-[#0b0f1a] p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">{managedContent.title}</h1>
        {managedContent.lastUpdated && <p className="mt-2 text-xs uppercase tracking-[0.3em] text-gray-500">Last updated {managedContent.lastUpdated}</p>}
        <div className="mt-4 space-y-3 text-sm text-gray-400 sm:text-base" dangerouslySetInnerHTML={{ __html: managedContent.html }} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-white">Send us a message</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">Complete the form below and our customer support team will reply by email.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="support-first-name" className="text-xs font-semibold uppercase tracking-wide text-gray-400">First name</label>
              <input id="support-first-name" type="text" autoComplete="given-name" value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} className={inputClasses} disabled={isSending} maxLength={60} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="support-last-name" className="text-xs font-semibold uppercase tracking-wide text-gray-400">Last name</label>
              <input id="support-last-name" type="text" autoComplete="family-name" value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} className={inputClasses} disabled={isSending} maxLength={60} required />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="support-email" className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email</label>
            <input id="support-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="you@example.com" className={inputClasses} disabled={isSending} maxLength={254} required />
          </div>
          <div className="space-y-2">
            <label htmlFor="support-subject" className="text-xs font-semibold uppercase tracking-wide text-gray-400">Subject</label>
            <input id="support-subject" type="text" value={form.subject} onChange={(event) => updateField('subject', event.target.value)} placeholder="What can we help with?" className={inputClasses} disabled={isSending} maxLength={120} required />
          </div>
          <div className="space-y-2">
            <label htmlFor="support-message" className="text-xs font-semibold uppercase tracking-wide text-gray-400">Message</label>
            <textarea id="support-message" value={form.message} onChange={(event) => updateField('message', event.target.value)} placeholder="Share the details so we can assist faster." className={`${inputClasses} min-h-40 resize-y`} disabled={isSending} maxLength={3000} required />
          </div>

          <div aria-live="polite">
            {errorMessage && <p role="alert" className="text-sm text-red-400">{errorMessage}</p>}
            {statusMessage && <p className="text-sm text-green-400">{statusMessage}</p>}
          </div>

          <button type="submit" disabled={isSending} className="min-h-12 w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-40">
            {isSending ? 'Sending...' : 'Send message'}
          </button>
        </form>
      </div>
    </section>
  );
};
