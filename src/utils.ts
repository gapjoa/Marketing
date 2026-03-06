import { Node } from '@xyflow/react';

export function getNodeCenter(node: Node) {
  const size = (node.data?.customSize as number) || (128 + ((node.data?.connectionsCount as number) || 0) * 20);
  const width = node.measured?.width || size;
  const height = node.measured?.height || size;
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

export function getEdgeParams(source: Node, target: Node) {
  const sourceCenter = getNodeCenter(source);
  const targetCenter = getNodeCenter(target);

  const sourceSize = (source.data?.customSize as number) || (128 + ((source.data?.connectionsCount as number) || 0) * 20);
  const targetSize = (target.data?.customSize as number) || (128 + ((target.data?.connectionsCount as number) || 0) * 20);

  const sourceRadius = (source.measured?.width || sourceSize) / 2;
  const targetRadius = (target.measured?.width || targetSize) / 2;

  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    return { 
      sx: sourceCenter.x, 
      sy: sourceCenter.y, 
      tx: targetCenter.x, 
      ty: targetCenter.y, 
      dx: 0, 
      dy: 0 
    };
  }

  const nx = dx / distance;
  const ny = dy / distance;

  const sx = sourceCenter.x + nx * sourceRadius;
  const sy = sourceCenter.y + ny * sourceRadius;

  const tx = targetCenter.x - nx * targetRadius;
  const ty = targetCenter.y - ny * targetRadius;

  return { sx, sy, tx, ty, dx, dy };
}
