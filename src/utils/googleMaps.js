let mapsPromise = null;

function apiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
}

export function hasGoogleMapsKey() {
  return Boolean(apiKey());
}

export async function loadGoogleMaps() {
  if (window.google?.maps?.places) {
    return window.google.maps;
  }
  const key = apiKey();
  if (!key) {
    throw new Error('Google Maps API key is missing');
  }
  if (!mapsPromise) {
    mapsPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-maps]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.google.maps), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMaps = 'true';
      script.onload = () => resolve(window.google.maps);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return mapsPromise;
}

export async function getPlacePredictions(input) {
  if (!input || input.trim().length < 3) {
    return [];
  }
  const maps = await loadGoogleMaps();
  const service = new maps.places.AutocompleteService();
  return new Promise((resolve) => {
    service.getPlacePredictions({ input }, (predictions, status) => {
      if (status !== maps.places.PlacesServiceStatus.OK || !predictions) {
        resolve([]);
        return;
      }
      resolve(predictions);
    });
  });
}

export async function getDrivingDistanceKm(originPlaceId, destinationPlaceId) {
  const maps = await loadGoogleMaps();
  const service = new maps.DistanceMatrixService();
  return new Promise((resolve, reject) => {
    service.getDistanceMatrix(
      {
        origins: [{ placeId: originPlaceId }],
        destinations: [{ placeId: destinationPlaceId }],
        travelMode: maps.TravelMode.DRIVING,
        unitSystem: maps.UnitSystem.METRIC,
      },
      (response, status) => {
        if (status !== 'OK') {
          reject(new Error('Could not compute distance'));
          return;
        }
        const element = response?.rows?.[0]?.elements?.[0];
        if (!element || element.status !== 'OK') {
          reject(new Error('No route found'));
          return;
        }
        resolve(Number((element.distance.value / 1000).toFixed(2)));
      },
    );
  });
}
