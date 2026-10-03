"use client";

import { useState } from "react";
import { 
  Send, 
  CheckCircle2, 
  Calendar, 
  User, 
  Mail, 
  Phone, 
  Sparkles, 
  ShieldCheck,
  Trophy
} from "lucide-react";

export default function EnquiryCrmSection() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    interestedPlan: "GOLD",
    preferredSport: "Tennis",
    trialDate: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { apiClient } = await import("@/lib/api/client");
      await apiClient.post("/crm/public/enquiries", {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        interested_plan: formData.interestedPlan,
        preferred_sport: formData.preferredSport,
        preferred_trial_date: formData.trialDate || undefined,
        trial_requested: !!formData.trialDate,
        message: formData.notes
      });
      setSubmitted(true);
    } catch (error) {
      console.error("Failed to submit enquiry:", error);
      alert("There was an issue submitting your request. Please try again.");
    }
  };

  return (
    <section id="contact" className="py-20 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column Information */}
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Complimentary Trial Session</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              Book a Trial & Experience The Champions Club
            </h2>

            <p className="text-slate-600 text-sm leading-relaxed mb-8">
              Step onto our pristine grass and clay courts, meet our certified head coaches, and tour our state-of-the-art facilities before choosing your membership plan.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">45-Minute Court Assessment</div>
                  <div className="text-[11px] text-slate-500">Includes stroke analysis with a certified academy coach.</div>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="w-8 h-8 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Full Clubhouse & Pool Guest Pass</div>
                  <div className="text-[11px] text-slate-500">Relax in the steam/sauna and enjoy an espresso at the lounge.</div>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="w-8 h-8 rounded-xl bg-lime-100 text-lime-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Instant CRM Follow-Up</div>
                  <div className="text-[11px] text-slate-500">Our concierge contacts you within 2 business hours.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: CRM Form */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl p-7 sm:p-9 shadow-2xl border border-slate-200 relative">
              {submitted ? (
                <div className="py-12 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Trial Request Received!
                  </h3>
                  <p className="text-sm text-slate-600 max-w-md mt-2 mb-6">
                    Thank you, <span className="font-semibold text-slate-900">{formData.name}</span>. Our membership concierge has received your request for a {formData.preferredSport} session and will call you at {formData.phone} shortly.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="px-6 py-2.5 rounded-full text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors"
                  >
                    Submit Another Enquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="mb-2">
                    <h3 className="text-xl font-bold text-slate-900">
                      Request Your Free Trial Pass
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Fill out the form below to reserve your complimentary session
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Full Name *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. Rahul Sharma"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+91 98765 43210"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Email Address *
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="rahul@example.com"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Primary Sport of Interest
                      </label>
                      <select
                        value={formData.preferredSport}
                        onChange={(e) => setFormData({ ...formData, preferredSport: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500 bg-white"
                      >
                        <option value="Lawn Tennis">Lawn Tennis (Grass/Clay/Hard)</option>
                        <option value="Badminton">Badminton (Wooden Court)</option>
                        <option value="Padel">Padel (Glass Arena)</option>
                        <option value="Squash">Squash</option>
                        <option value="Swimming">Olympic Swimming</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Target Membership Plan
                      </label>
                      <select
                        value={formData.interestedPlan}
                        onChange={(e) => setFormData({ ...formData, interestedPlan: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500 bg-white"
                      >
                        <option value="GOLD">Gold Champion Plan</option>
                        <option value="SILVER">Silver Essential Plan</option>
                        <option value="JUNIOR">Junior Academy (Ages 6-18)</option>
                        <option value="CORPORATE">Corporate Club Package</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Preferred Trial Date
                      </label>
                      <input
                        type="date"
                        value={formData.trialDate}
                        onChange={(e) => setFormData({ ...formData, trialDate: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500 bg-white"
                      >
                      </input>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Additional Notes or Skill Level
                    </label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="e.g. Intermediate tennis player looking for weekend morning slot availability..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 px-6 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-blue-700 shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Submit Trial Request</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>

                  <p className="text-center text-[10px] text-slate-400">
                    🔒 We respect your privacy. No spam. Instant CRM confirmation email dispatched.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
