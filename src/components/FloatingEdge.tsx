import React, { useCallback } from 'react';
import { useStore, getStraightPath, EdgeProps, Node } from '@xyflow/react';
import { getEdgeParams } from '../utils';

function FloatingEdge({
  id,
  source,
  target,
  markerEnd,
  style,
  animated,
}: EdgeProps) {
  const sourceNode = useStore(useCallback((store) => store.nodeLookup.get(source), [source])) as Node | undefined;
  const targetNode = useStore(useCallback((store) => store.nodeLookup.get(target), [target])) as Node | undefined;

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);

  const [edgePath] = getStraightPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
  });

  return (
    <>
      <path
        id={id}
        className={`react-flow__edge-path ${animated ? 'react-flow__edge-path--animated' : ''}`}
        d={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
    </>
  );
}

export default React.memo(FloatingEdge);
