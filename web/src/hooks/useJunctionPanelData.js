import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

// Polls the real backend for junction density + pending proposals. Polling
// (rather than SignalR/WebSockets) was chosen since the underlying data
// only changes every 30s (the telemetry simulator's own interval) — a
// lighter-weight fit for that cadence, worth a line in the ADR.
const POLL_MS = 5000;

export function useJunctionPanelData() {
  const [intersections, setIntersections] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    try {
      const [intersectionsData, proposalsData] = await Promise.all([
        api.getIntersections(),
        api.getPendingProposals(),
      ]);
      if (!mountedRef.current) return;
      setIntersections(intersectionsData);
      setProposals(proposalsData);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Deferred a tick so the first fetch's setState doesn't run
    // synchronously inside the effect body itself.
    const kickoffId = setTimeout(refetch, 0);
    const pollId = setInterval(refetch, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearTimeout(kickoffId);
      clearInterval(pollId);
    };
  }, [refetch]);

  const approveProposal = useCallback(
    async (id) => {
      await api.approveProposal(id);
      await refetch();
    },
    [refetch],
  );

  const rejectProposal = useCallback(
    async (id) => {
      await api.rejectProposal(id);
      await refetch();
    },
    [refetch],
  );

  const deleteIntersection = useCallback(
    async (id) => {
      await api.deleteIntersection(id);
      await refetch();
    },
    [refetch],
  );

  return { intersections, proposals, loading, error, approveProposal, rejectProposal, deleteIntersection };
}
