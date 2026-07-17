let mapsPromise = null;
let placesService = null;
const geocodeCache = new Map();
const reverseGeocodeCache = new Map();

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

export async function getPlaceDetails(placeId) {
  if (!placeId) {
    return null;
  }
  const maps = await loadGoogleMaps();
  if (!placesService) {
    placesService = new maps.places.PlacesService(document.createElement('div'));
  }
  return new Promise((resolve, reject) => {
    placesService.getDetails(
      {
        placeId,
        fields: ['place_id', 'name', 'formatted_address', 'address_components', 'geometry'],
      },
      (place, status) => {
        if (status !== maps.places.PlacesServiceStatus.OK || !place) {
          reject(new Error('Could not load place details'));
          return;
        }
        resolve(place);
      },
    );
  });
}

// Resolve a stored free-form address for read-only admin maps. Booking, order,
// event, and healthcare records currently snapshot address text rather than
// coordinates, so details are geocoded only when an admin opens the record.
export async function geocodeAddress(address) {
  const query = String(address || '').trim();
  if (!query) {
    throw new Error('Address is missing');
  }
  const cacheKey = query.toLocaleLowerCase();
  if (!geocodeCache.has(cacheKey)) {
    const request = loadGoogleMaps()
      .then((maps) => new Promise((resolve, reject) => {
        const geocoder = new maps.Geocoder();
        geocoder.geocode({ address: query }, (results, status) => {
          if (status !== maps.GeocoderStatus.OK || !results?.length) {
            reject(new Error('Could not locate this address'));
            return;
          }
          const result = results[0];
          resolve({
            position: {
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng(),
            },
            formattedAddress: result.formatted_address || query,
            placeId: result.place_id || '',
          });
        });
      }))
      .catch((error) => {
        geocodeCache.delete(cacheKey);
        throw error;
      });
    geocodeCache.set(cacheKey, request);
  }
  return geocodeCache.get(cacheKey);
}

export async function reverseGeocodePosition(position) {
  const lat = Number(position?.lat);
  const lng = Number(position?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Coordinates are invalid');
  }
  const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  if (!reverseGeocodeCache.has(cacheKey)) {
    const request = loadGoogleMaps()
      .then((maps) => new Promise((resolve, reject) => {
        const geocoder = new maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status !== maps.GeocoderStatus.OK || !results?.length) {
            reject(new Error('Could not identify this location'));
            return;
          }
          resolve({
            formattedAddress: results[0].formatted_address || '',
            placeId: results[0].place_id || '',
          });
        });
      }))
      .catch((error) => {
        reverseGeocodeCache.delete(cacheKey);
        throw error;
      });
    reverseGeocodeCache.set(cacheKey, request);
  }
  return reverseGeocodeCache.get(cacheKey);
}

function addressComponent(components, types, key = 'long_name') {
  const found = components.find((component) => types.every((type) => component.types.includes(type)));
  return found?.[key] || '';
}

export function parseGoogleAddress(place) {
  const components = place?.address_components || [];
  const streetNumber = addressComponent(components, ['street_number']);
  const route = addressComponent(components, ['route']);
  const subpremise = addressComponent(components, ['subpremise']);
  const neighborhood =
    addressComponent(components, ['neighborhood']) ||
    addressComponent(components, ['sublocality']) ||
    addressComponent(components, ['sublocality_level_1']);
  const city =
    addressComponent(components, ['locality']) ||
    addressComponent(components, ['postal_town']) ||
    addressComponent(components, ['administrative_area_level_2']) ||
    neighborhood;
  const region = addressComponent(components, ['administrative_area_level_1']);
  const country = addressComponent(components, ['country']);
  const postalCode = addressComponent(components, ['postal_code']);
  const street = [streetNumber, route].filter(Boolean).join(' ');

  return {
    line1: street || place?.name || place?.formatted_address || '',
    line2: subpremise,
    city,
    region,
    country,
    postal_code: postalCode,
    formatted_address: place?.formatted_address || '',
  };
}

function distanceEndpoint(value) {
  if (typeof value === 'string') {
    return { placeId: value };
  }
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export async function getDrivingDistanceKm(origin, destination) {
  const maps = await loadGoogleMaps();
  const originPoint = distanceEndpoint(origin);
  const destinationPoint = distanceEndpoint(destination);
  if (!originPoint || !destinationPoint) {
    throw new Error('Route points are missing');
  }
  const service = new maps.DistanceMatrixService();
  return new Promise((resolve, reject) => {
    service.getDistanceMatrix(
      {
        origins: [originPoint],
        destinations: [destinationPoint],
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
