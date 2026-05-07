import type { Vehicle } from '../types';

export function isTesla(vehicle: Vehicle): boolean {
  return vehicle.make.toLowerCase() === 'tesla';
}
