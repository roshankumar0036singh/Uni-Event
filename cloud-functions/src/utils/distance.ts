import { getDistance } from "geolib";

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  return getDistance(
    {
      latitude: lat1,
      longitude: lon1,
    },
    {
      latitude: lat2,
      longitude: lon2,
    }
  );
}