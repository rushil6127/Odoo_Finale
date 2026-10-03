/**
 * Champions Club — Membership CRM & Growth Leads Pipeline
 */

"use client";

import { useState, useEffect } from "react";
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
  stage: string;
  notes: string;
}

const STAGES = [
  { id: "NEW", title: "New Inquiries", bg: "bg-sky-50 border-sky-200 text-sky-800" },
  { id: "CONTACTED", title: "Contacted", bg: "bg-blue-50 border-blue-200 text-blue-800" },
  { id: "TRIAL_SCHEDULED", title: "Trial Scheduled", bg: "bg-amber-50 border-amber-200 text-amber-800" },
  { id: "PROPOSAL_SENT", title: "Proposal Sent", bg: "bg-indigo-50 border-indigo-200 text-indigo-800" },
  { id: "CONVERTED", title: "Converted & Active", bg: "bg-emerald-50 border-emerald-200 text-emerald-800" },
];

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchLeads = async () => {
    try {
      setIsLoading(true);
      const { apiClient } = await import("@/lib/api/client");
      const res = await apiClient.get<any>("/crm/leads?per_page=100");
      if (res.data) {
        const transformed: Lead[] = res.data.map((l: any) => ({
          id: l.id,
          name: l.first_name + (l.last_name ? ` ${l.last_name}` : ""),
          email: l.email || "No Email",
          phone: l.phone || "No Phone",
          interestedPlan: l.interested_plan || "Any Plan",
          source: l.source || "UNKNOWN",
          stage: l.status || "NEW",
          notes: l.initial_message || l.notes || "No notes available",
        }));
        setLeads(transformed);
      }
    } catch (error) {
      console.error("Failed to fetch leads", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

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
