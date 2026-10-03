/**
 * Champions Club — Membership CRM & Growth Leads Pipeline
 */

"use client";

import { useState } from "react";
import {
  TrendingUp,
  Search,
  Plus,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Clock,
  MessageSquare
} from "lucide-react";

interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  interestedPlan: string;
  source: string;
  stage: "NEW_INQUIRY" | "TRIAL_SCHEDULED" | "TOUR_COMPLETED" | "PROPOSAL_SENT" | "CONVERTED";
  notes: string;
}

const LEADS_DATA: Lead[] = [
  { id: 1, name: "Rajesh Singhania", email: "rajesh.s@singhania-group.com", phone: "+91 99000 11223", interestedPlan: "👑 Black Card VIP", source: "Executive Referral", stage: "PROPOSAL_SENT", notes: "Interested in corporate court package & cabana access." },
  { id: 2, name: "Dr. Sunita Deshmukh", email: "sunita.ortho@med.org", phone: "+91 99111 22334", interestedPlan: "💎 Platinum Elite", source: "Instagram Ad", stage: "TRIAL_SCHEDULED", notes: "Lawn tennis trial session booked for Sunday 9 AM." },
  { id: 3, name: "Karan Johar", email: "karan.j@productions.in", phone: "+91 99222 33445", interestedPlan: "🥇 Gold Club", source: "Website Lead Form", stage: "NEW_INQUIRY", notes: "Inquired about badminton coaching for family." },
  { id: 4, name: "Meera Kapoor", email: "meera.kapoor@art.com", phone: "+91 99333 44556", interestedPlan: "💎 Platinum Elite", source: "Club Walk-in", stage: "TOUR_COMPLETED", notes: "Toured pool and Olympic fitness center. Loved facilities." },
  { id: 5, name: "Sameer Nambiar", email: "sameer.n@tech.io", phone: "+91 99444 55667", interestedPlan: "👑 Black Card VIP", source: "Owner Direct Invite", stage: "CONVERTED", notes: "Membership payment verified. Activated." },
];

const STAGES = [
  { id: "NEW_INQUIRY", title: "New Inquiries", bg: "bg-sky-50 border-sky-200 text-sky-800" },
  { id: "TRIAL_SCHEDULED", title: "Trial Scheduled", bg: "bg-amber-50 border-amber-200 text-amber-800" },
  { id: "TOUR_COMPLETED", title: "Tour Completed", bg: "bg-purple-50 border-purple-200 text-purple-800" },
  { id: "PROPOSAL_SENT", title: "Proposal Sent", bg: "bg-indigo-50 border-indigo-200 text-indigo-800" },
  { id: "CONVERTED", title: "Converted & Active", bg: "bg-emerald-50 border-emerald-200 text-emerald-800" },
];

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>(LEADS_DATA);
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
              Membership CRM & Growth Pipeline
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track prospective member leads, trial coaching sessions, VIP onboarding, and conversion metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Prospect Lead</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Active Leads in Funnel</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{leads.length}</p>
          <p className="text-[11px] text-sky-600 font-bold mt-1">Pipeline value: ₹4,80,000</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Trial Sessions This Week</p>
          <p className="text-2xl font-black text-amber-600 mt-1">8 Trials</p>
          <p className="text-[11px] text-slate-500 mt-1">Badminton & Tennis</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Conversion Rate</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">68.4%</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">+12% vs last month</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Top Inquiry Source</p>
          <p className="text-2xl font-black text-slate-900 mt-1">Referral</p>
          <p className="text-[11px] text-slate-500 mt-1">45% of high-tier conversions</p>
        </div>
      </div>

      {/* Kanban Pipeline Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.id);
          return (
            <div key={stage.id} className="bg-slate-50 rounded-3xl p-4 border border-slate-200 flex flex-col h-full">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-black text-slate-800">{stage.title}</h3>
                <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center">
                  {stageLeads.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {stageLeads.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-[11px]">
                    No leads at this stage
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-2.5"
                    >
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                          {lead.source}
                        </span>
                        <h4 className="text-xs font-black text-slate-900">{lead.name}</h4>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 text-[11px] font-bold text-slate-700">
                        {lead.interestedPlan}
                      </div>

                      <p className="text-[11px] text-slate-500 leading-snug">
                        {lead.notes}
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span className="truncate max-w-[80px]">{lead.phone}</span>
                        </span>
                        <span className="text-sky-600 font-bold">Details</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
