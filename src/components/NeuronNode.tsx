import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NeuronData, StatusColors } from '../types';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function NeuronNode({ data, selected }: NodeProps<any>) {
  const neuronData = data as NeuronData;
  const baseColor = StatusColors[neuronData.status] || StatusColors.not_started;
  const color = neuronData.customColor || baseColor;
  const connectionsCount = neuronData.connectionsCount || 0;
  const calculatedSize = 128 + connectionsCount * 20;
  const size = neuronData.customSize || calculatedSize;
  
  // Calculate font size based on the node size (base size is 128px)
  // Base font size is 0.75rem (text-xs). We scale it proportionally.
  const scaleFactor = size / 128;
  const fontSize = `${Math.max(0.6, 0.75 * scaleFactor)}rem`;

  return (
    <div
      className={cn(
        "group relative flex items-center justify-center rounded-full transition-[box-shadow,border-color,transform] duration-300",
        "bg-white/95 dark:bg-slate-900/95",
        selected ? "ring-4 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950 scale-105" : "hover:scale-105"
      )}
      style={{ 
        borderColor: color,
        borderWidth: `${Math.max(3, size / 25)}px`,
        borderStyle: 'solid',
        boxShadow: selected ? `0 0 25px ${color}80` : `0 0 10px ${color}40`,
        width: `${size}px`,
        height: `${size}px`
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-4 h-4 !bg-slate-800 dark:!bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity border-none"
        style={{ zIndex: 1, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      />
      <Handle
        type="source"
        position={Position.Top}
        className="w-4 h-4 !bg-slate-800 dark:!bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity border-none"
        style={{ zIndex: 2, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      />
      
      <div className="flex flex-col items-center justify-center p-4 text-center w-full h-full rounded-full overflow-hidden pointer-events-none">
        <span 
          className="font-semibold leading-tight text-slate-800 dark:text-slate-100 line-clamp-4 font-display"
          style={{ fontSize }}
        >
          {neuronData.label || 'Nouveau Neurone'}
        </span>
      </div>
    </div>
  );
}

export default React.memo(NeuronNode);
