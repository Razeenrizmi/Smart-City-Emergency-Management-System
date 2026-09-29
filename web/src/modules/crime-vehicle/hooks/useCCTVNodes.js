import { useState, useEffect, useCallback, useRef } from 'react';
import { cctvService, DEFAULT_DETECTION_CONFIG } from '../services/cctvService';

export default function useCCTVNodes() {
  const [nodes, setNodes] = useState([]);
  const [runtimeStatus, setRuntimeStatus] = useState({});
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detectionConfig, setDetectionConfig] = useState({ ...DEFAULT_DETECTION_CONFIG });
  const initPushRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await cctvService.getDetectionConfig();
      if (!cancelled) setDetectionConfig(cfg);
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshNodes = useCallback(async () => {
    setLoading(true);
    const list = await cctvService.getNodes();
    setNodes(list);
    setRuntimeStatus((prev) => {
      const next = {};
      list.forEach((n) => {
        next[n.nodeId] = prev[n.nodeId] || 'OFFLINE';
      });
      return next;
    });
    setActiveNodeId((prev) => prev ?? (list[0]?.nodeId ?? null));
    setLoading(false);
    return list;
  }, []);

  useEffect(() => {
    (async () => {
      const list = await refreshNodes();
      // Browser camera streams do not survive a page reload, so every node
      // starts OFFLINE locally and that truth is pushed to the backend.
      if (!initPushRef.current) {
        initPushRef.current = true;
        list.forEach((n) => {
          cctvService.setNodeStatus(n.nodeId, 'OFFLINE');
        });
      }
    })();
  }, [refreshNodes]);

  const reportNodeStatus = useCallback((nodeId, status) => {
    setRuntimeStatus((prev) => {
      if (prev[nodeId] === status) return prev;
      cctvService.setNodeStatus(nodeId, status);
      return { ...prev, [nodeId]: status };
    });
  }, []);

  const startNodeSession = useCallback(async (nodeId) => {
    const session = await cctvService.startNodeSession(nodeId);
    if (session?.sessionId) {
      setRuntimeStatus((prev) => ({ ...prev, [nodeId]: 'ONLINE' }));
      cctvService.setNodeStatus(nodeId, 'ONLINE');
      return session.sessionId;
    }
    return null;
  }, []);

  const stopNode = useCallback(async (nodeId) => {
    setRuntimeStatus((prev) => ({ ...prev, [nodeId]: 'OFFLINE' }));
    await cctvService.stopNode(nodeId);
  }, []);

  const activeNode = nodes.find((n) => n.nodeId === activeNodeId) || nodes[0] || null;

  const nodesWithStatus = nodes.map((n) => ({
    ...n,
    status: runtimeStatus[n.nodeId] || n.status || 'OFFLINE'
  }));

  const onlineCount = nodesWithStatus.filter(
    (n) => n.status === 'ONLINE' || n.status === 'ANALYZING'
  ).length;

  return {
    nodes: nodesWithStatus,
    activeNode,
    activeNodeId: activeNode ? activeNode.nodeId : null,
    setActiveNodeId,
    onlineCount,
    loading,
    detectionConfig,
    refreshNodes,
    reportNodeStatus,
    startNodeSession,
    stopNode
  };
}
