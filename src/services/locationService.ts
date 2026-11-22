// ==========================================
// 위치 서비스: 브라우저 GPS(navigator.geolocation) + OpenStreetMap Nominatim 검색/역지오코딩
// 서버·API 키 없이 정적 웹사이트에서 동작합니다.
// ==========================================

export interface GeoPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface DeviceLocation extends GeoPlace {
  accuracy: number;
  timestamp: number;
}

export type GeoErrorCode = 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown';

export class GeoError extends Error {
  code: GeoErrorCode;
  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'GeoError';
  }
}

export const describeGeoError = (error: unknown): string => {
  const code = error instanceof GeoError ? error.code : (error as any)?.code;
  switch (code) {
    case 'unsupported':
      return '이 브라우저에서는 위치 기능을 사용할 수 없습니다. 장소를 직접 검색해 주세요.';
    case 'denied':
      return '위치 권한이 거부되었습니다. 브라우저 주소창의 위치 권한을 "허용"으로 바꾸면 현재 위치가 자동으로 표시됩니다.';
    case 'unavailable':
      return '위치 정보를 받을 수 없습니다. GPS가 켜져 있는지 확인하거나 장소를 직접 검색해 주세요.';
    case 'timeout':
      return '위치 확인 시간이 초과되었습니다. 다시 시도하거나 장소를 직접 검색해 주세요.';
    default:
      return '위치를 확인하지 못했습니다. 장소를 직접 검색해 주세요.';
  }
};

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 30000,
};

/** 현재 위치를 1회 요청합니다. 권한이 이미 허용돼 있으면 프롬프트 없이 즉시 반환됩니다. */
export const getCurrentPosition = (options: PositionOptions = GPS_OPTIONS): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new GeoError('unsupported', 'geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        const map: Record<number, GeoErrorCode> = {
          1: 'denied',
          2: 'unavailable',
          3: 'timeout',
        };
        reject(new GeoError(map[err.code] || 'unknown', err.message || 'geolocation failed'));
      },
      options
    );
  });

/** 위치 권한 상태를 확인합니다 (지원 브라우저에서만). */
export const getPermissionState = async (): Promise<PermissionState | 'unknown'> => {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return status.state;
  } catch {
    return 'unknown';
  }
};

const nominatimFetch = async (path: string): Promise<any> => {
  const res = await fetch(`https://nominatim.openstreetmap.org${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`주소 서비스 오류 (HTTP ${res.status})`);
  return res.json();
};

/** 좌표 → 장소 이름/주소 (역지오코딩) */
export const reverseGeocode = async (lat: number, lng: number): Promise<{ name: string; address: string }> => {
  try {
    const data = await nominatimFetch(
      `/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=ko`
    );
    const name: string =
      data?.name ||
      data?.address?.building ||
      data?.address?.road ||
      data?.address?.suburb ||
      data?.address?.city ||
      '';
    const address = String(data?.display_name || '');
    return {
      name: name || '현재 위치',
      address: address || `위도 ${lat.toFixed(5)}, 경도 ${lng.toFixed(5)}`,
    };
  } catch {
    return {
      name: '현재 위치',
      address: `위도 ${lat.toFixed(5)}, 경도 ${lng.toFixed(5)}`,
    };
  }
};

/** 현재 위치 + 주소를 한 번에 가져옵니다. */
export const getCurrentLocation = async (options?: PositionOptions): Promise<DeviceLocation> => {
  const position = await getCurrentPosition(options);
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const accuracy = Math.round(position.coords.accuracy || 0);
  const { name, address } = await reverseGeocode(lat, lng);
  return {
    name,
    address,
    lat,
    lng,
    accuracy,
    timestamp: position.timestamp || Date.now(),
  };
};

/** 장소/주소 검색 */
export const searchPlaces = async (query: string, limit = 8): Promise<GeoPlace[]> => {
  const clean = query.trim();
  if (!clean) return [];
  const data = await nominatimFetch(
    `/search?format=jsonv2&q=${encodeURIComponent(clean)}&limit=${limit}&addressdetails=1&accept-language=ko`
  );
  if (!Array.isArray(data)) return [];
  return data.map((item: any) => {
    const parts = String(item.display_name || '').split(',');
    return {
      name: String(item.name || parts[0] || clean).trim(),
      address: String(item.display_name || ''),
      lat: Number(item.lat),
      lng: Number(item.lon),
    };
  });
};

/** 지도 임베드 URL (키 없이 동작하는 방식) */
export const buildMapEmbedUrl = (lat: number, lng: number, provider: 'google' | 'osm' = 'google'): string => {
  if (provider === 'google') {
    return `https://maps.google.com/maps?q=${lat},${lng}&z=16&hl=ko&output=embed`;
  }
  const d = 0.006;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
};

export const buildGoogleMapsLink = (lat: number, lng: number): string =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
