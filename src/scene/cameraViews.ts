export type CameraViewMode = 'overview' | 'queue' | 'seating' | 'entrance' | 'cruise';

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function getCameraPose(mode: Exclude<CameraViewMode, 'cruise'>, width: number, depth: number): CameraPose {
  const cx = width / 2;
  const cz = depth / 2;

  switch (mode) {
    case 'queue':
      return {
        position: [cx + 3, 12.5, -5.5],
        target: [7.2, 0.1, cz],
      };

    case 'seating':
      return {
        position: [width + 2, 13.5, -3.2],
        target: [width * 0.72, 0.1, depth * 0.45],
      };

    case 'entrance':
      return {
        position: [cx, 10.5, -13],
        target: [cx, 0.1, 2.2],
      };

    case 'overview':
    default:
      return {
        position: [cx, 22, -12],
        target: [cx, 0, cz],
      };
  }
}

export function getIntroPose(width: number, depth: number): CameraPose {
  return {
    position: [width / 2 - 10, 9.5, -34],
    target: [width / 2, 0, depth / 2],
  };
}
