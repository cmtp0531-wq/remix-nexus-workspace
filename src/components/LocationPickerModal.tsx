import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MapPin,
  Navigation,
  X,
  Check,
  Search,
  ExternalLink,
  RefreshCw,
  Compass,
  Loader2,
  LocateFixed,
  AlertCircle,
} from 'lucide-react';
import { LocationAttachment } from '../types';
import {
  buildGoogleMapsLink,
  buildMapEmbedUrl,
  describeGeoError,
  getCurrentLocation,
  searchPlaces,
} from '../services/locationService';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShareLocation: (loc: LocationAttachment) => void;
}

interface SearchResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onShareLocation,
}) => {
  const [selected, setSelected] = useState<LocationAttachment | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [statusNote, setStatusNote] = useState('현재 위치를 확인하는 중…');
  const [source, setSource] = useState<'gps' | 'search' | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [mapProvider, setMapProvider] = useState<'google' | 'osm'>('google');
  const requestedRef = useRef(false);

  /** GPS 자동 수신 (모달이 열리면 사용자가 버튼을 누르지 않아도 바로 요청) */
  const locateNow = useCallback(async (isAuto = false) => {
    setIsLocating(true);
    if (!isAuto) setLocationError('');
    try {
      const loc = await getCurrentLocation();
      setSelected({
        type: 'location',
        name: loc.name,
        address: loc.address,
        lat: loc.lat,
        lng: loc.lng,
        accuracyMeters: loc.accuracy,
      });
      setSource('gps');
      setStatusNote(
        loc.accuracy > 0
          ? `✓ GPS 현재 위치 수신 완료 (오차 ±${loc.accuracy}m)`
          : '✓ GPS 현재 위치 수신 완료'
      );
      setLocationError('');
    } catch (error) {
      setLocationError(describeGeoError(error));
      setStatusNote('위치 권한을 허용하면 현재 위치가 자동으로 표시됩니다');
    } finally {
      setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      requestedRef.current = false;
      return;
    }
    if (requestedRef.current) return;
    requestedRef.current = true;
    void locateNow(true);
  }, [isOpen, locateNow]);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setIsSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const found = await searchPlaces(query);
      setResults(found);
      if (found.length === 0) {
        setSearchError('검색 결과가 없습니다. 다른 검색어로 시도해 주세요.');
      }
    } catch (error: any) {
      setSearchError(String(error?.message || '장소 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setIsSearching(false);
    }
  };

  const handlePick = (place: SearchResult) => {
    setSelected({
      type: 'location',
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      accuracyMeters: 5,
    });
    setSource('search');
    setStatusNote(`✓ 검색한 장소 선택: ${place.name}`);
  };

  const handleConfirm = () => {
    if (!selected) return;
    onShareLocation(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl bg-white border border-[#EBE5DA] p-5 sm:p-6 cafe-shadow-lg text-[#2C2520] space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#EBE5DA]">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#FFF5F5] text-[#EA4335] border border-[#FED7D7]">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#2C2520]">현재 위치 공유</h3>
                <span className="px-2 py-0.5 rounded-full bg-[#E6F4EA] text-[#137333] text-[10px] font-bold">
                  {source === 'gps' ? 'GPS' : source === 'search' ? '검색 위치' : '위치 확인 중'}
                </span>
              </div>
              <p className="text-[11px] text-[#7A6A5C]">
                위치 권한을 허용하면 현재 위치가 자동으로 표시되고, 대화방에 지도로 공유할 수 있습니다
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#7A6A5C] hover:bg-[#F4EFE6] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* GPS status */}
        <div className="flex items-start gap-2 text-[11px] rounded-xl border border-[#EBE5DA] bg-[#FDFBF7] px-3 py-2">
          {isLocating ? (
            <Loader2 className="w-4 h-4 text-[#C18C5D] animate-spin flex-shrink-0 mt-0.5" />
          ) : locationError ? (
            <AlertCircle className="w-4 h-4 text-[#B45309] flex-shrink-0 mt-0.5" />
          ) : (
            <LocateFixed className="w-4 h-4 text-[#15803D] flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[#5C5046]">{statusNote}</div>
            {locationError && <div className="text-[#8C6B3F] mt-0.5 leading-relaxed">{locationError}</div>}
          </div>
          <button
            type="button"
            onClick={() => void locateNow(false)}
            disabled={isLocating}
            className="px-2 py-1 rounded-lg bg-white border border-[#EBE5DA] text-[10px] font-bold text-[#5C5046] hover:bg-[#F4EFE6] cursor-pointer disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
            다시 확인
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 text-[#A89A8E] absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="장소나 주소 검색 (예: 강남역, 판교역, 성수동 카페)"
              className="w-full pl-9 pr-3 py-2 bg-[#FDFBF7] border border-[#EBE5DA] rounded-xl text-xs text-[#2C2520] focus:outline-none focus:border-[#EA4335]"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-[#EA4335] hover:bg-[#D93025] text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
          >
            {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>검색</span>
          </button>
        </form>

        {searchError && (
          <div className="text-[11px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-3 py-2">
            {searchError}
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-xl border border-[#EBE5DA] divide-y divide-[#F4EFE6]">
            {results.map((place) => (
              <button
                key={`${place.lat},${place.lng},${place.name}`}
                type="button"
                onClick={() => handlePick(place)}
                className="w-full text-left px-3 py-2 hover:bg-[#FAF7F2] cursor-pointer"
              >
                <div className="text-xs font-semibold text-[#2C2520] truncate">{place.name}</div>
                <div className="text-[10px] text-[#8C7A6B] truncate">{place.address}</div>
              </button>
            ))}
          </div>
        )}

        {/* Selected location */}
        {selected ? (
          <div className="p-3.5 rounded-xl bg-[#FDFBF7] border border-[#EBE5DA] flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#15803D] animate-pulse flex-shrink-0" />
                <div className="text-xs font-bold text-[#2C2520] truncate">{selected.name}</div>
              </div>
              <a
                href={buildGoogleMapsLink(selected.lat, selected.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#1A73E8] font-bold hover:underline flex items-center gap-1 flex-shrink-0"
              >
                <span>지도에서 열기</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="text-xs text-[#5C5046] flex items-center gap-1.5 bg-white p-2 rounded-lg border border-[#EBE5DA]">
              <Compass className="w-3.5 h-3.5 text-[#C18C5D] flex-shrink-0" />
              <span className="truncate">{selected.address}</span>
            </div>

            <div className="text-[10px] text-[#A89A8E] flex items-center justify-between font-mono">
              <span>
                좌표: {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
              </span>
              {typeof selected.accuracyMeters === 'number' && selected.accuracyMeters > 0 && (
                <span className="text-[#15803D] font-bold">오차 ±{selected.accuracyMeters}m</span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-[#FDFBF7] border border-dashed border-[#EBE5DA] text-center text-xs text-[#8C7A6B]">
            아직 위치가 없습니다. 위치 권한을 허용하거나 위에서 장소를 검색해 주세요.
          </div>
        )}

        {/* Map */}
        {selected && (
          <div className="relative w-full h-56 rounded-xl overflow-hidden border border-[#EBE5DA] shadow-xs bg-[#F4EFE6]">
            <iframe
              title="위치 지도"
              src={buildMapEmbedUrl(selected.lat, selected.lng, mapProvider)}
              className="w-full h-full border-none"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-xs px-2 py-1 rounded-lg text-[10px] font-bold text-[#2C2520] border border-[#EBE5DA] shadow-xs">
              <button
                type="button"
                onClick={() => setMapProvider(mapProvider === 'google' ? 'osm' : 'google')}
                className="text-[#1A73E8] hover:underline cursor-pointer"
              >
                {mapProvider === 'google' ? 'Google 지도' : 'OpenStreetMap'}
              </button>
            </div>
            <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-mono text-[#2C2520] border border-[#EBE5DA] shadow-xs">
              📍 {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-[#EBE5DA] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#F4EFE6] hover:bg-[#EBE5DA] text-xs font-semibold text-[#5C5046] cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selected}
            className="px-4 py-2 rounded-xl bg-[#EA4335] hover:bg-[#D93025] text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>이 위치로 채팅방에 공유하기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
