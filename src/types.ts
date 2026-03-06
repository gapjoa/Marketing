export type NodeStatus = 'not_started' | 'in_progress' | 'to_verify' | 'published';

export interface Tag {
  id: string;
  word: string;
  email: string;
}

export interface NeuronData {
  [key: string]: unknown;
  label: string;
  description: string;
  status: NodeStatus;
  resourceLink: string;
  connectionsCount?: number;
  customColor?: string;
  customSize?: number;
  tags?: string[]; // Array of Tag IDs
  validatedTags?: string[]; // Array of Tag IDs that are validated
  rejectedTags?: string[]; // Array of Tag IDs that are rejected
}

export const StatusColors: Record<NodeStatus, string> = {
  not_started: '#ff0055', // Neon Pink
  in_progress: '#00f0ff', // Neon Cyan
  to_verify: '#ffaa00',   // Neon Orange
  published: '#00ff66',   // Neon Green
};

export const StatusLabels: Record<NodeStatus, string> = {
  not_started: 'Pas commencé',
  in_progress: 'En cours',
  to_verify: 'À vérifier',
  published: 'Fait / Publié',
};
