"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RoleNavigation } from "../../components/role-navigation";
import { apiGet, apiPost } from "../../lib/api";

type Region = {
  id: number;
  name: string;
  code: string;
  city: string | null;
  district: string | null;
  ward: string | null;
};

type PendingAgent = {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: "PENDING";
  createdAt: string;
  regions: Region[];
};

type RegionsResponse = {
  data: Region[];
};

type PendingAgentsResponse = {
  data: PendingAgent[];
};

type SelectedRegions = Record<number, string>;

export default function PendingAgentsPage() {
  const [agents, setAgents] = useState<PendingAgent[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<SelectedRegions>({});
  const [busyAgentId, setBusyAgentId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const regionOptions = useMemo(
    () =>
      regions.map((region) => ({
        id: region.id,
        label: [region.name, region.district, region.city]
          .filter(Boolean)
          .join(" - ")
      })),
    [regions]
  );

  const loadData = useCallback(
    async (accessToken: string) => {
      setError("");
      const [regionResponse, agentResponse] = await Promise.all([
        apiGet<RegionsResponse>("/admin/regions", { token: accessToken }),
        apiGet<PendingAgentsResponse>("/admin/agents/pending", {
          token: accessToken
        })
      ]);

      setRegions(regionResponse.data);
      setAgents(agentResponse.data);
      setSelectedRegions((current) => {
        const next: SelectedRegions = {};

        agentResponse.data.forEach((agent) => {
          next[agent.id] =
            current[agent.id] ?? String(agent.regions[0]?.id ?? "");
        });

        return next;
      });
    },
    []
  );

  useEffect(() => {
    const accessToken = localStorage.getItem("selapAccessToken");
    setToken(accessToken);

    if (!accessToken) {
      setError("Please sign in as Admin to review Sales Agent accounts.");
      setIsLoading(false);
      return;
    }

    loadData(accessToken)
      .catch((caughtError) => {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load pending agents."
        );
      })
      .finally(() => setIsLoading(false));
  }, [loadData]);

  async function approveAgent(agent: PendingAgent) {
    const regionId = Number(selectedRegions[agent.id]);

    if (!token || !Number.isInteger(regionId) || regionId <= 0) {
      setError("Select an area before approving this Sales Agent.");
      return;
    }

    setBusyAgentId(agent.id);
    setError("");
    setNotice("");

    try {
      await apiPost(`/admin/agents/${agent.id}/approve`, {
        body: { regionIds: [regionId] },
        token
      });
      setAgents((current) => current.filter((item) => item.id !== agent.id));
      setNotice(`${agent.name} is now ACTIVE and assigned to an area.`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to approve this Sales Agent."
      );
    } finally {
      setBusyAgentId(null);
    }
  }

  async function rejectAgent(agent: PendingAgent) {
    if (!token) {
      setError("Please sign in as Admin to reject accounts.");
      return;
    }

    const reason = window.prompt(
      `Reject ${agent.name}? You can enter a short reason.`
    );

    if (reason === null) {
      return;
    }

    setBusyAgentId(agent.id);
    setError("");
    setNotice("");

    try {
      await apiPost(`/admin/agents/${agent.id}/reject`, {
        body: { reason },
        token
      });
      setAgents((current) => current.filter((item) => item.id !== agent.id));
      setNotice(`${agent.name} was rejected and removed from pending review.`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to reject this Sales Agent."
      );
    } finally {
      setBusyAgentId(null);
    }
  }

  return (
    <main className="catalogMockPage approvalMockPage">
      <div className="catalogMockShell">
        <RoleNavigation />

        <header className="approvalHeader">
          <h1>Admin Account Approval Dashboard</h1>
          <p>
            Admin must assign an area before approving a pending Sales Agent.
          </p>
        </header>

        {notice ? <p className="approvalNotice">{notice}</p> : null}
        {error ? <p className="approvalError">{error}</p> : null}

        <section className="approvalPanel">
          <div className="approvalTable">
            <div className="approvalTableHead">
              <span>Agent Name</span>
              <span>Phone</span>
              <span>Status</span>
              <span>Area Assignment</span>
              <span>Actions</span>
            </div>

            {isLoading ? (
              <p className="approvalEmpty">Loading pending agents...</p>
            ) : null}

            {!isLoading && agents.length === 0 ? (
              <p className="approvalEmpty">No pending Sales Agent accounts.</p>
            ) : null}

            {!isLoading
              ? agents.map((agent) => {
                  const isBusy = busyAgentId === agent.id;
                  const hasSelectedRegion = Boolean(selectedRegions[agent.id]);

                  return (
                    <div className="approvalRow" key={agent.id}>
                      <div className="agentIdentity">
                        <strong>{agent.name}</strong>
                        <span>{agent.email}</span>
                      </div>
                      <span className="agentPhone">{agent.phone}</span>
                      <span className="pendingStatusPill">PENDING</span>
                      <select
                        aria-label={`Assign area for ${agent.name}`}
                        disabled={isBusy || regionOptions.length === 0}
                        onChange={(event) =>
                          setSelectedRegions((current) => ({
                            ...current,
                            [agent.id]: event.target.value
                          }))
                        }
                        value={selectedRegions[agent.id] ?? ""}
                      >
                        <option value="">Select area...</option>
                        {regionOptions.map((region) => (
                          <option key={region.id} value={region.id}>
                            {region.label}
                          </option>
                        ))}
                      </select>
                      <div className="approvalActions">
                        <button
                          className={
                            hasSelectedRegion ? "approveButton" : "mutedButton"
                          }
                          disabled={isBusy || !hasSelectedRegion}
                          onClick={() => approveAgent(agent)}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="rejectButton"
                          disabled={isBusy}
                          onClick={() => rejectAgent(agent)}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              : null}
          </div>
        </section>

        <p className="approvalSavedState">
          Approved rows animate out after ACTIVE status and area assignment are
          saved.
        </p>
      </div>
    </main>
  );
}
