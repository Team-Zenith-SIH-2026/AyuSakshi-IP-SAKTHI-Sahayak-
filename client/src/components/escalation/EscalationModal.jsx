import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useJurisdiction } from '../../context/JurisdictionContext';
import { useAuth } from '../../context/AuthContext';
import { escalationAPI } from '../../services/api';
import { UserCheck, X, CheckCircle2, AlertCircle, ShieldAlert, Send } from 'lucide-react';

export const EscalationModal = () => {
  const { activeModal, setActiveModal, escalationPreFill } = useChat();
  const { jurisdiction } = useJurisdiction();
  const { user } = useAuth();

  const [question, setQuestion] = useState('');
  const [reason, setReason] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successTicket, setSuccessTicket] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (escalationPreFill) {
      setQuestion(escalationPreFill.question || '');
      setReason(escalationPreFill.reason || 'Uncertain legal interpretation / Low confidence answer.');
    }
    if (user?.email) {
      setEmail(user.email);
    }
  }, [escalationPreFill, user]);

  if (activeModal !== 'escalate') return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || !reason.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await escalationAPI.submit({
        conversation_id: escalationPreFill?.conversation_id,
        question: question.trim(),
        jurisdiction,
        formulation_summary: escalationPreFill?.formulation_summary,
        retrieved_evidence: escalationPreFill?.retrieved_evidence,
        system_confidence: escalationPreFill?.system_confidence,
        reason: reason.trim(),
        email: email || user?.email || 'practitioner@ayusakshi.gov.in',
      });

      if (res.data?.review_ticket) {
        setSuccessTicket(res.data.review_ticket);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to submit escalation ticket.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccessTicket(null);
    setActiveModal(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border shadow-2xl overflow-hidden p-6 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-darkbg-border">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Request Human IP Facilitator Review
              </h3>
              <p className="text-[11px] text-slate-500">
                Preserve conversation context & escalate to an accredited AYUSH IP Facilitator
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {successTicket ? (
          /* Success confirmation view */
          <div className="py-6 text-center space-y-3 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Escalation Ticket #{successTicket.id.slice(0, 8)} Submitted
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Your inquiry and RAG evidence trace have been queued in the Facilitator Workspace. An AYUSH IP Facilitator will examine the statutory aspects and provide guidance.
            </p>
            <button
              onClick={handleClose}
              className="mt-2 py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
            >
              Back to Conversation
            </button>
          </div>
        ) : (
          /* Form view */
          <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Your Contact Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vaidya@ayushinstitution.edu.in"
                className="w-full bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Question / Legal Issue Summary
              </label>
              <textarea
                rows={2}
                required
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Describe your inquiry..."
                className="w-full bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Reason for Escalation
              </label>
              <textarea
                rows={2}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Need clarification on Section 3(p) rejection risk or ABS fee exemption under 2023 Rules..."
                className="w-full bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/30 text-[11px] text-slate-700 dark:text-slate-300">
              📌 Active Jurisdiction: <strong>{jurisdiction.toUpperCase()}</strong>. Full RAG retrieval logs & formulation properties will be forwarded to the facilitator.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Submitting to Facilitator Queue...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit for Human Facilitator Review</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
