import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Panel,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import * as d3 from 'd3-force';
import * as XLSX from 'xlsx';
import NeuronNode from './NeuronNode';
import NodeSidebar from './NodeSidebar';
import FloatingEdge from './FloatingEdge';
import { NeuronData, NodeStatus, Tag, StatusLabels } from '../types';
import { PlusCircle, Users, Activity, BrainCircuit, Moon, Sun, Mail, Download, Undo2, Redo2 } from 'lucide-react';
import TeamManager from './TeamManager';

const nodeTypes: NodeTypes = {
  neuron: NeuronNode,
};

const edgeTypes = {
  floating: FloatingEdge,
};

const initialNodes: Node<NeuronData>[] = [];
const initialEdges: Edge[] = [];

export default function MarketingMap() {
  const [nodes, setNodes] = useState<Node<NeuronData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState(1);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false);
  const [clipboard, setClipboard] = useState<{ nodes: Node<NeuronData>[], edges: Edge[] } | null>(null);
  const [undoStack, setUndoStack] = useState<{ nodes: Node<NeuronData>[]; edges: Edge[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ nodes: Node<NeuronData>[]; edges: Edge[] }[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const lastSocketEmitRef = useRef<number>(0);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Use refs to avoid dependency cycles in socket listeners
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const saveHistory = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-49), { nodes: nodesRef.current, edges: edgesRef.current }]);
    setRedoStack([]);
  }, []);

  const applyHistory = useCallback((isUndo: boolean) => {
    const setSource = isUndo ? setUndoStack : setRedoStack;
    const setTarget = isUndo ? setRedoStack : setUndoStack;
    
    setSource((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const state = newStack.pop()!;
      
      setTarget((t) => [...t, { nodes: nodesRef.current, edges: edgesRef.current }]);
      setNodes(state.nodes);
      setEdges(state.edges);
      socket?.emit('graph:sync', state);
      
      return newStack;
    });
  }, [socket]);

  const handleUndo = useCallback(() => applyHistory(true), [applyHistory]);
  const handleRedo = useCallback(() => applyHistory(false), [applyHistory]);

  // Keyboard shortcuts for Copy/Paste/Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isMac = navigator.platform?.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (cmdOrCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if (cmdOrCtrl && e.key === 'c') {
        const selectedNodes = nodesRef.current.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
          const edgesToCopy = edgesRef.current.filter(edge => 
            selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
          );
          setClipboard({ nodes: selectedNodes, edges: edgesToCopy });
        }
      } else if (cmdOrCtrl && e.key === 'v') {
        if (clipboard && clipboard.nodes.length > 0) {
          saveHistory();
          const idMap = new Map<string, string>();
          const newNodes = clipboard.nodes.map(node => {
            const newId = uuidv4();
            idMap.set(node.id, newId);
            return {
              ...node,
              id: newId,
              position: { x: node.position.x + 50, y: node.position.y + 50 },
              selected: true,
            };
          });

          const newEdges = clipboard.edges.map(edge => ({
            ...edge,
            id: uuidv4(),
            source: idMap.get(edge.source) || edge.source,
            target: idMap.get(edge.target) || edge.target,
            selected: true,
          }));

          setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
          setEdges(eds => eds.map(e => ({ ...e, selected: false })).concat(newEdges));

          newNodes.forEach(n => socket?.emit('node:add', n));
          newEdges.forEach(e => socket?.emit('edge:add', e));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clipboard, socket, handleUndo, handleRedo, saveHistory]);

  useEffect(() => {
    // Simulation is completely disabled so nodes do not move at all automatically.
    // We keep a dummy simulation object so the rest of the code doesn't break.
    simulationRef.current = d3.forceSimulation()
      .force('charge', null)
      .force('link', null)
      .force('x', null)
      .force('y', null)
      .force('collide', null)
      .on('tick', null)
      .on('end', null);

    return () => {
      simulationRef.current?.stop();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  useEffect(() => {
    // Do nothing when nodes or edges change, since physics are disabled.
  }, [nodes.length, edges.length]);

  useEffect(() => {
    // Connect to WebSocket server
    const newSocket = io((import.meta as any).env.VITE_APP_URL || window.location.origin, {
      transports: ['websocket', 'polling'],
    });

    setSocket(newSocket);

    const onAdd = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>) => 
      (item: T) => setter(prev => prev.some(i => i.id === item.id) ? prev : [...prev, item]);
    const onDel = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>) => 
      (id: string) => setter(prev => prev.filter(i => i.id !== id));

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));
    newSocket.on('users:count', setActiveUsers);
    
    newSocket.on('init', (data: { nodes: Node<NeuronData>[]; edges: Edge[]; tags: Tag[] }) => {
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setTags(data.tags || []);
    });

    newSocket.on('nodes:change', (changes: NodeChange[]) => {
      setNodes(nds => applyNodeChanges(changes, nds));
      if (simulationRef.current) {
        // Physics are disabled, so we don't need to update simulation positions
      }
    });
    newSocket.on('edges:change', (changes: EdgeChange[]) => setEdges(eds => applyEdgeChanges(changes, eds)));

    newSocket.on('node:add', onAdd(setNodes));
    newSocket.on('node:update', (updatedNode: Node<NeuronData>) => 
      setNodes(nds => nds.map(n => n.id === updatedNode.id ? updatedNode : n))
    );
    newSocket.on('node:delete', (nodeId: string) => {
      onDel(setNodes)(nodeId);
      setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    });

    newSocket.on('edge:add', onAdd(setEdges));
    newSocket.on('edge:delete', onDel(setEdges));
    newSocket.on('tag:add', onAdd(setTags));
    newSocket.on('tag:delete', onDel(setTags));

    newSocket.on('graph:sync', (state: { nodes: Node<NeuronData>[]; edges: Edge[] }) => {
      setNodes(state.nodes || []);
      setEdges(state.edges || []);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const isDraggingRef = useRef(false);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Check if this is the end of a drag to save history
      const hasDragEnd = changes.some(c => c.type === 'position' && c.dragging === false);
      if (hasDragEnd) {
        saveHistory();
      }

      setNodes((nds) => applyNodeChanges(changes, nds));
      
      const now = Date.now();
      const isDragging = changes.some(c => c.type === 'position' && c.dragging);
      
      if (!isDragging || hasDragEnd || now - lastSocketEmitRef.current > 100) {
        socket?.emit('nodes:change', changes);
        lastSocketEmitRef.current = now;
      }

      // Physics are disabled, so we don't need to update simulation positions
    },
    [socket, saveHistory]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      socket?.emit('edges:change', changes);
    },
    [socket]
  );

  const emitAndSave = useCallback((action: () => void) => { saveHistory(); action(); }, [saveHistory]);

  const onConnect = useCallback((params: Connection | Edge) => emitAndSave(() => {
    const edge = { ...params, id: uuidv4() };
    setEdges(eds => addEdge(edge, eds));
    socket?.emit('edge:add', edge);
  }), [socket, emitAndSave]);

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => emitAndSave(() => {
    edgesToDelete.forEach(edge => socket?.emit('edge:delete', edge.id));
  }), [socket, emitAndSave]);

  const onNodesDelete = useCallback((nodesToDelete: Node[]) => emitAndSave(() => {
    nodesToDelete.forEach(node => socket?.emit('node:delete', node.id));
  }), [socket, emitAndSave]);

  const addNeuron = useCallback(() => emitAndSave(() => {
    const newNode: Node<NeuronData> = {
      id: uuidv4(),
      type: 'neuron',
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      data: { label: 'Nouveau Neurone', description: '', status: 'not_started', resourceLink: '' },
    };
    setNodes(nds => [...nds, newNode]);
    socket?.emit('node:add', newNode);
  }), [socket, emitAndSave]);

  const handleExportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nodes.map(node => ({
      'ID': node.id,
      'Nom du Neurone': node.data.label,
      'Statut': StatusLabels[node.data.status as NodeStatus] || node.data.status,
      'Description': node.data.description,
      'Lien Ressource': node.data.resourceLink,
      'Connecté à': edges.filter(e => e.source === node.id || e.target === node.id)
        .map(e => nodes.find(n => n.id === (e.source === node.id ? e.target : e.source))?.data.label || 'Inconnu')
        .join(', ')
    }))), "Neurones");
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(edges.map(edge => ({
      'Source': nodes.find(n => n.id === edge.source)?.data.label || edge.source,
      'Cible': nodes.find(n => n.id === edge.target)?.data.label || edge.target,
    }))), "Liaisons");

    XLSX.writeFile(wb, "Marketing_Neural_Plan.xlsx");
  }, [nodes, edges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleUpdateNode = useCallback(
    (id: string, data: Partial<NeuronData>) => {
      saveHistory();
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const updatedNode = {
              ...node,
              data: { ...node.data, ...data },
            };
            socket?.emit('node:update', updatedNode);
            return updatedNode;
          }
          return node;
        })
      );

      if (data.customSize !== undefined && simulationRef.current) {
        const simNode = simulationRef.current.nodes().find(n => n.id === id);
        if (simNode) {
          simNode.customSize = data.customSize;
          simulationRef.current.alpha(0.3).restart();
        }
      }
    },
    [socket]
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      socket?.emit('node:delete', id);
    },
    [socket]
  );

  const handleDuplicateNode = useCallback((nodeToDuplicate: Node<NeuronData>) => {
    const newNode = {
      ...nodeToDuplicate,
      id: uuidv4(),
      position: { x: nodeToDuplicate.position.x + 50, y: nodeToDuplicate.position.y + 50 },
      selected: true,
    };
    
    setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNode));
    socket?.emit('node:add', newNode);
    setSelectedNodeId(newNode.id);
  }, [socket]);

  const nodesWithConnections = React.useMemo(() => {
    const counts = new Map<string, number>();
    edges.forEach(e => {
      counts.set(e.source, (counts.get(e.source) || 0) + 1);
      counts.set(e.target, (counts.get(e.target) || 0) + 1);
    });
    
    let changed = false;
    const nextNodes = nodes.map(node => {
      const connectionsCount = counts.get(node.id) || 0;
      if (node.data.connectionsCount === connectionsCount) return node;
      
      changed = true;
      return {
        ...node,
        data: {
          ...node.data,
          connectionsCount
        }
      };
    });
    
    return changed ? nextNodes : nodes;
  }, [nodes, edges]);

  const handleAddTag = useCallback((tag: Tag) => {
    setTags((tgs) => [...tgs, tag]);
    socket?.emit('tag:add', tag);
  }, [socket]);

  const handleDeleteTag = useCallback((id: string) => {
    setTags((tgs) => tgs.filter((t) => t.id !== id));
    socket?.emit('tag:delete', id);
  }, [socket]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="w-full h-screen bg-slate-50 dark:bg-slate-950 relative font-sans transition-colors duration-300">
      <ReactFlow
        nodes={nodesWithConnections}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodesDelete={onNodesDelete}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.05}
        maxZoom={3}
        className="bg-slate-50 dark:bg-slate-950 transition-colors duration-300"
        defaultEdgeOptions={{
          type: 'floating',
          animated: false,
          style: { stroke: isDarkMode ? '#475569' : '#9ca3af', strokeWidth: 2 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color={isDarkMode ? "#334155" : "#e5e7eb"} />
        <Controls className="glass-panel rounded-lg overflow-hidden !border-none" />

        <Panel position="top-left" className="glass-panel p-4 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 font-display tracking-tight">
                <BrainCircuit className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                Marketing Neural Plan
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Planification collaborative en temps réel</p>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
              title={isDarkMode ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 mr-2">
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Annuler (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Rétablir (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setIsTeamManagerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors text-sm font-medium"
            >
              <Mail className="w-4 h-4" />
              Gérer l'équipe
            </button>

            <button
              onClick={addNeuron}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl transition-colors shadow-lg shadow-indigo-500/30 text-sm font-medium"
            >
              <PlusCircle className="w-4 h-4" />
              Ajouter un Neurone
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-xl transition-colors shadow-lg shadow-emerald-500/30 text-sm font-medium"
              title="Exporter en Excel"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
            
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
              <Activity className={`w-4 h-4 ${isConnected ? 'text-emerald-500' : 'text-rose-500'}`} />
              {isConnected ? 'Connecté' : 'Déconnecté'}
            </div>
            
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700" title="Utilisateurs connectés">
              <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              {activeUsers}
            </div>
            
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700" title="Nombre de neurones">
              <BrainCircuit className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <span className="font-medium">{nodes.length}</span>
            </div>
          </div>
        </Panel>

        <Panel position="bottom-left" className="glass-panel p-3 rounded-xl">
          <div className="flex flex-col gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ff0055] shadow-[0_0_8px_#ff005580]"></div> Pas commencé</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff80]"></div> En cours</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ffaa00] shadow-[0_0_8px_#ffaa0080]"></div> À vérifier</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#00ff66] shadow-[0_0_8px_#00ff6680]"></div> Fait / Publié</div>
          </div>
        </Panel>
      </ReactFlow>

      {selectedNodeId && (
        <NodeSidebar
          node={selectedNode}
          tags={tags}
          onClose={() => setSelectedNodeId(null)}
          onUpdate={handleUpdateNode}
          onDelete={handleDeleteNode}
          onDuplicate={handleDuplicateNode}
        />
      )}

      {isTeamManagerOpen && (
        <TeamManager
          tags={tags}
          onAddTag={handleAddTag}
          onDeleteTag={handleDeleteTag}
          onClose={() => setIsTeamManagerOpen(false)}
        />
      )}
    </div>
  );
}
