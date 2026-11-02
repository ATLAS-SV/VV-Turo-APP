export interface CarMapProps {
  selectedCarId: string | null;
  onSelectCar: (carId: string) => void;
}
