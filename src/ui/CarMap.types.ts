export interface CarMapProps {
  selectedCarId: string | null;
  onSelectCar: (carId: string) => void;
  /** Only these cars are drawn (the Map tab's search, filter and checkboxes decide). */
  visibleCarIds: string[];
  /** Bump to re-fit the map to the visible cars. */
  fitNonce: number;
}

/** Dot colors on the map: purple car, orange when unlocked, grey when parked away, gold when selected. */
export const DOT = { car: '#3B1F7A', unlocked: '#D97706', away: '#8A8F99', selected: '#D4AF37' };
