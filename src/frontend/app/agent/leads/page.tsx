"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { apiGet, apiPost, apiPatch } from "../../lib/api";
import { RoleNavigation } from "../../components/role-navigation";
import { Toast } from "../../components/toast";
import { formatMoney } from "../../properties/types";

type LeadStatus = "NEW" | "CLAIMED" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST" | "CANCELLED";

interface LeadItem {
  id: number;
  customerName?: string;
  customerPhone?: string;
  message?: string;
  status: LeadStatus;
  createdAt: string;
  regionId?: number;
  assignedAgentId?: number | null;
  property: {
    id: number;
    title: string;
    address: string;
    city: string;
    district: string;
    price: string | number;
  };
}

function formatTimeAgo(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 30) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AgentLeadsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"available" | "assigned">("available");
  const [availableLeads, setAvailableLeads] = useState<LeadItem[]>([]);
  const [assignedLeads, setAssignedLeads] = useState<LeadItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [claimedContact, setClaimedContact] = useState<{
    leadId: number;
    name: string;
    phone: string;
  } | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("selapAccessToken");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    loadLeads(token);

    const socket: Socket = io("http://localhost:3001/claiming", {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("new_lead", (newLead: LeadItem) => {
      // Xử lý ẩn tên và sdt từ socket payload real-time
      const sanitizedLead: LeadItem = {
        ...newLead,
        customerName: undefined,
        customerPhone: undefined,
      };

      setAvailableLeads((prev) => [sanitizedLead, ...prev]);

      setToast({
        message: `New Lead Available: ${newLead.property?.title || "Property Request"}`,
        type: "warning",
      });

      try {
        const audio = new Audio("/sounds/lead-notification.mp3");
        audio.play().catch((err) => {
          console.warn("Autoplay is blocked by the browser:", err);
        });
      } catch (error) {
        console.error("Audio playback error:", error);
      }
    });

    socket.on("lead_claimed", (data: { leadId: number; claimedByAgentId: number }) => {
      setAvailableLeads((prev) =>
        prev.map((item) =>
          item.id === data.leadId
            ? { ...item, status: "CLAIMED", assignedAgentId: data.claimedByAgentId }
            : item
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [router, activeTab]);

  const loadLeads = async (token: string) => {
    setLoading(true);
    try {
      if (activeTab === "available") {
        const data = await apiGet<LeadItem[]>("/leads/available", { token });
        setAvailableLeads(data);
      } else {
        const data = await apiGet<LeadItem[]>("/leads/assigned", { token });
        setAssignedLeads(data);
      }
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimLead = async (leadId: number) => {
    const token = localStorage.getItem("selapAccessToken");
    if (!token) return;

    try {
      setErrorMessage(null);
      const res = await apiPost<{
        message: string;
        customerContact: { name: string; phone: string };
        lead: LeadItem;
      }>(`/leads/${leadId}/claim`, { token });

      setClaimedContact({
        leadId,
        name: res.customerContact.name,
        phone: res.customerContact.phone,
      });

      setAvailableLeads((prev) =>
        prev.map((item) =>
          item.id === leadId
            ? {
                ...item,
                status: "CLAIMED",
                customerName: res.customerContact.name,
                customerPhone: res.customerContact.phone,
              }
            : item
        )
      );

      setToast({
        message: `Lead accepted! Contact details unmasked.`,
        type: "success",
      });

    } catch (err: any) {
      setErrorMessage(err.message || "This request was accepted by another Sales Agent.");
      setAvailableLeads((prev) =>
        prev.map((item) => (item.id === leadId ? { ...item, status: "CLAIMED" } : item))
      );
    }
  };

  const handleUpdateStatus = async (leadId: number, newStatus: LeadStatus) => {
    const token = localStorage.getItem("selapAccessToken");
    if (!token) return;

    try {
      const updated = await apiPatch<LeadItem>(`/leads/${leadId}/status`, { body: { status: newStatus }, token: token });
      setAssignedLeads((prev) =>
        prev.map((item) => (item.id === leadId ? { ...item, status: updated.status } : item))
      );
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  const filteredAssignedLeads = assignedLeads.filter((lead) => {
    if (statusFilter === "ALL") return true;
    return lead.status === statusFilter;
  });

  const currentCount = activeTab === "available" ? availableLeads.length : filteredAssignedLeads.length;

  return (
    <main className="catalogMockPage notificationPage">
      <div className="catalogMockShell notificationShell">
        <RoleNavigation />

        {/* Header với Tab Switcher */}
        <header className="notificationHeader">
          <div>
            <p className="pageEyebrow">AGENT DASHBOARD</p>
            <h1>Lead Management</h1>
            <p>Real-time consultation requests from customers in your area.</p>
          </div>

          <div className="notificationTabs" role="tablist" aria-label="Lead filters">
            <button
              aria-selected={activeTab === "available"}
              className={activeTab === "available" ? "notificationTab active" : "notificationTab"}
              onClick={() => setActiveTab("available")}
              role="tab"
              type="button"
            >
              Real-time Inbox
            </button>
            <button
              aria-selected={activeTab === "assigned"}
              className={activeTab === "assigned" ? "notificationTab active" : "notificationTab"}
              onClick={() => setActiveTab("assigned")}
              role="tab"
              type="button"
            >
              My Assigned Leads
            </button>
          </div>
        </header>

        {/* Toolbar bao gồm Filter Status & Đếm tổng số */}
        <div
          className="notificationToolbar"
          style={{
            display: "flex",
            justifyContent: activeTab === "assigned" ? "space-between" : "flex-end",
            alignItems: "center",
          }}
        >
          {activeTab === "assigned" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>Filter status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  fontSize: "13px",
                  color: "#334155",
                  fontWeight: "500",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="CLAIMED">Claimed</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="CONVERTED">Converted</option>
                <option value="LOST">Lost</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          )}

          <span className="notificationCount">{currentCount} total</span>
        </div>

        {/* Khung nội dung */}
        <section className="notificationList">
          {/* TAB 1: REAL-TIME INBOX (AVAILABLE) */}
          {activeTab === "available" && (
            <div>
              {loading ? (
                <div className="mockSkeleton" style={{ height: "112px", borderRadius: "12px" }} />
              ) : availableLeads.length === 0 ? (
                <div className="mockEmpty">No leads available in your region currently.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {availableLeads.map((lead) => {
                    const isClaimedByMe = claimedContact?.leadId === lead.id;
                    const isClosed = lead.status === "CLAIMED" && !isClaimedByMe;

                    return (
                      <div
                        key={lead.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "20px 24px",
                          borderRadius: "12px",
                          border: "1px solid",
                          backgroundColor: isClaimedByMe ? "#ecfdf5" : isClosed ? "#f8fafc" : "#fffbeb",
                          borderColor: isClaimedByMe ? "#a7f3d0" : isClosed ? "#e2e8f0" : "#fde68a",
                          opacity: isClosed ? 0.75 : 1,
                          minHeight: "112px",
                          boxSizing: "border-box",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "20px", flex: 1 }}>
                          <div
                            style={{
                              width: "42px",
                              height: "42px",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#ffffff",
                              fontWeight: "bold",
                              fontSize: "16px",
                              flexShrink: 0,
                              backgroundColor: isClaimedByMe ? "#10b981" : isClosed ? "#94a3b8" : "#f59e0b",
                            }}
                          >
                            {isClaimedByMe ? "✓" : isClosed ? "✕" : "!"}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <h3 style={{ margin: 0, fontSize: "16px", color: "#1e293b", fontWeight: "700" }}>
                              {lead.property?.title}
                            </h3>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: "1.4" }}>
                              {lead.property?.address}, {lead.property?.district} - {formatMoney(lead.property?.price)} / month
                            </p>

                            {isClaimedByMe ? (
                              <p style={{ margin: 0, fontSize: "14px", color: "#047857", fontWeight: "600" }}>
                                Customer: {claimedContact?.name} - {claimedContact?.phone}
                              </p>
                            ) : isClosed ? (
                              <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                                Claim closed - this request was accepted by another Sales Agent.
                              </p>
                            ) : (
                              <div>
                                <span
                                  style={{
                                    display: "inline-block",
                                    backgroundColor: "#fef3c7",
                                    padding: "4px 10px",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    color: "#92400e",
                                    fontFamily: "monospace",
                                    fontWeight: "500",
                                  }}
                                >
                                 
                                  {isClaimedByMe && (lead.customerName || claimedContact?.name)
                                    ? `${claimedContact?.name || lead.customerName} - ${claimedContact?.phone || lead.customerPhone}`
                                    : "New Consultation Request - Accept to view"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ marginLeft: "24px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                          {/* Dòng thời gian hiển thị phía trên nút bấm ở góc phải */}
                          <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                            {formatTimeAgo(lead.createdAt)}
                          </span>

                          {isClaimedByMe ? (
                            <button
                              type="button"
                              style={{
                                height: "42px",
                                width: "150px",
                                padding: "0 16px",
                                borderRadius: "8px",
                                border: "none",
                                backgroundColor: "#10b981",
                                color: "#ffffff",
                                fontWeight: "600",
                                fontSize: "14px",
                                cursor: "pointer",
                              }}
                            >
                              Open Contact
                            </button>
                          ) : isClosed ? (
                            <button
                              disabled
                              type="button"
                              style={{
                                height: "42px",
                                width: "150px",
                                padding: "0 16px",
                                borderRadius: "8px",
                                border: "none",
                                backgroundColor: "#94a3b8",
                                color: "#ffffff",
                                fontWeight: "600",
                                fontSize: "14px",
                                cursor: "not-allowed",
                              }}
                            >
                              Disabled
                            </button>
                          ) : (
                            <button
                              onClick={() => handleClaimLead(lead.id)}
                              type="button"
                              style={{
                                height: "42px",
                                width: "150px",
                                padding: "0 16px",
                                borderRadius: "8px",
                                border: "none",
                                backgroundColor: "#f59e0b",
                                color: "#ffffff",
                                fontWeight: "600",
                                fontSize: "14px",
                                cursor: "pointer",
                              }}
                            >
                              Accept
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY ASSIGNED LEADS */}
          {activeTab === "assigned" && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", backgroundColor: "#ffffff" }}>
              {loading ? (
                <div className="mockSkeleton" style={{ height: "200px" }} />
              ) : filteredAssignedLeads.length === 0 ? (
                <div className="mockEmpty">No assigned leads found for this filter.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#e0f2fe", borderBottom: "1px solid #bae6fd" }}>
                      <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#0369a1", textTransform: "uppercase", width: "42%" }}>
                        PROPERTY
                      </th>
                      <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#0369a1", textTransform: "uppercase", width: "18%" }}>
                        CUSTOMER
                      </th>
                      <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#0369a1", textTransform: "uppercase", width: "23%" }}>
                        MESSAGE
                      </th>
                      <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: "700", color: "#0369a1", textTransform: "uppercase", width: "17%", textAlign: "center" }}>
                        STATUS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignedLeads.map((lead, idx) => (
                      <tr
                        key={lead.id}
                        style={{
                          borderBottom: idx === filteredAssignedLeads.length - 1 ? "none" : "1px solid #f1f5f9",
                        }}
                      >
                        <td style={{ padding: "16px 20px", verticalAlign: "middle" }}>
                          <div style={{ fontWeight: "700", fontSize: "15px", color: "#1e293b" }}>{lead.property?.title}</div>
                          <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px", lineHeight: "1.4" }}>
                            {lead.property?.address}, {lead.property?.district}
                          </div>
                        </td>

                        <td style={{ padding: "16px 20px", verticalAlign: "middle" }}>
                          <div style={{ fontWeight: "600", fontSize: "14px", color: "#0891b2" }}>
                            {lead.customerName || "N/A"}
                          </div>
                          <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px", fontWeight: "500" }}>
                            {lead.customerPhone || "N/A"}
                          </div>
                        </td>

                        <td style={{ padding: "16px 20px", verticalAlign: "middle", fontSize: "13px", color: "#475569", lineHeight: "1.4" }}>
                          {lead.message || "Customer requested consultation from detail page."}
                        </td>

                        <td style={{ padding: "16px 20px", verticalAlign: "middle", textAlign: "center" }}>
                          <select
                            value={lead.status}
                            onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadStatus)}
                            style={{
                              padding: "6px 28px 6px 12px",
                              borderRadius: "6px",
                              border: "1px solid #0891b2",
                              backgroundColor: "#ffffff",
                              color: "#0891b2",
                              fontWeight: "600",
                              fontSize: "13px",
                              cursor: "pointer",
                              outline: "none",
                            }}
                          >
                            <option value="CLAIMED">Claimed</option>
                            <option value="CONTACTED">Contacted</option>
                            <option value="QUALIFIED">Qualified</option>
                            <option value="CONVERTED">Converted</option>
                            <option value="LOST">Lost</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="mockError" style={{ marginTop: "16px", display: "flex", justifyContent: "space-between" }}>
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                ✕
              </button>
            </div>
          )}
        </section>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
        
      </div>
    </main>
  );
}