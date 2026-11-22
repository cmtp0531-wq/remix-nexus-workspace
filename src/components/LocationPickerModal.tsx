import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  X,
  Check,
  Search,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Radio,
  Compass,
  Layers
} from 'lucide-react';
import { LocationAttachment } from '../types';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShareLocation: (loc: LocationAttachment) => void;
}

const PRESET_PLACES = [
  { name: '강남역 협업 라운지', address: '서울특별시 강남구 강남대로 396', lat: 37.4979, lng: 127.0276 },
  { name: '판교 테크노밸리 이노베이션 랩', address: '경기도 성남시 분당구 판교역로 146', lat: 37.3948, lng: 127.1114 },
  { name: '성수동 카페거리 미팅룸', address: '서울특별시 성동구 연무장길 36', lat: 37.5446, lng: 127.0560 },
  { name: '여의도 금융센터 비즈니스 허브', address: '서울특별시 영등포구 여의대로 108', lat: 37.5255, lng: 126.9257 },
  { name: '광화문 세종대로 코워킹 스페이스', address: '서울특별시 종로구 세종대로 172', lat: 37.5724, lng: 126.9769 },
  { name: '홍대입구 크리에이티브 스튜디오', address: '서울특별시 마포구 양화로 160', lat: 37.5563, lng: 126.9237 },
];

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onShareLocation,
}) => {
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [trackingSource, setTrackingSource] = useState<'gps' | 'network' | 'preset' | 'search'>('preset');
  const [statusNote, setStatusNote] = useState<string>('Google 지도 연동 준비 완료');

  const [selectedLocation, setSelectedLocation] = useState<LocationAttachment>({
    type: 'location',
    name: '강남역 협업 라운지',
    address: '서울특별시 강남구 강남대로 396 (강남역 2번 출구 앞)',
    lat: 37.4979,
    lng: 127.0276,
    accuracyMeters: 5,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ name: string; address: string; lat: number; lng: number }>>([]);
  const [mapType, setMapType] = useState<'google' | 'osm'>('google');

  // Request GPS non-blockingly on open
  useEffect(() => {
    if (isOpen) {
      tryGetGpsNonBlocking();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Non-blocking GPS attempt
  const tryGetGpsNonBlocking = () => {
    if (!('geolocation' in navigator)) return;
    setIsLoadingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 10);
        setSelectedLocation((prev) => ({
          ...prev,
          name: '내 실시간 GPS 위치',
          address: `현재 사용자 좌표 (위도 ${lat.toFixed(4)}, 경도 ${lng.toFixed(4)})`,
          lat,
          lng,
          accuracyMeters: accuracy,
        }));
        setTrackingSource('gps');
        setStatusNote(`✓ 실시간 GPS 수신 성공 (오차범위 ±${accuracy}m)`);
        setIsLoadingGps(false);
      },
      (err) => {
        setIsLoadingGps(false);
        // keep current preset safely
      },
      { timeout: 3000, enableHighAccuracy: false }
    );
  };

  // Search address / place
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=5`,
        { headers: { 'Accept-Language': 'ko,en' } }
      );
      if (res.ok) {
        const list = await res.json();
        const parsed = list.map((item: any) => ({
          name: item.display_name.split(',')[0] || searchQuery,
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
        setSearchResults(parsed);
        if (parsed.length > 0) {
          const first = parsed[0];
          setSelectedLocation({
            type: 'location',
            name: first.name,
            address: first.address,
            lat: first.lat,
            lng: first.lng,
            accuracyMeters: 5,
          });
          setTrackingSource('search');
          setStatusNote(`✓ 검색 위치 선택: ${first.name}`);
        }
      }
    } catch (e) {
      console.warn('Search query error', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    onShareLocation(selectedLocation);
    onClose();
  };

  // Embed map URL (Google Maps or OpenStreetMap)
  const googleMapEmbedUrl = `https://maps.google.com/maps?q=${selectedLocation.lat},${selectedLocation.lng}&z=15&output=embed`;
  const osmMapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${selectedLocation.lng - 0.008}%2C${selectedLocation.lat - 0.005}%2C${selectedLocation.lng + 0.008}%2C${selectedLocation.lat + 0.005}&layer=mapnik&marker=${selectedLocation.lat}%2C${selectedLocation.lng}`;

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
                <h3 className="text-sm font-bold text-[#2C2520]">Google 지도 실시간 위치 공유</h3>
                <span className="px-2 py-0.5 rounded-full bg-[#E6F4EA] text-[#137333] text-[10px] font-bold">
                  {trackingSource === 'gps' ? '실시간 GPS' : '위치 선택됨'}
                </span>
              </div>
              <p className="text-[11px] text-[#7A6A5C]">
                지도를 검색하거나 선택하여 대화방 멤버들에게 대화형 지도로 공유하세요
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#7A6A5C] hover:bg-[#F4EFE6] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 text-[#A89A8E] absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="장소나 주소 검색 (예: 강남역, 판교 테크노밸리, 성수동 카페...)"
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

        {/* Selected Location Card */}
        <div className="p-3.5 rounded-xl bg-[#FDFBF7] border border-[#EBE5DA] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#15803D] animate-pulse" />
              <div className="text-xs font-bold text-[#2C2520]">
                {selectedLocation.name}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${selectedLocation.lat},${selectedLocation.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#1A73E8] font-bold hover:underline flex items-center gap-1"
              >
                <span>Google Maps에서 열기</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={tryGetGpsNonBlocking}
                className="px-2 py-1 rounded-lg bg-white border border-[#EBE5DA] text-[10px] font-bold text-[#5C5046] hover:bg-[#F4EFE6] cursor-pointer"
              >
                GPS 수신
              </button>
            </div>
          </div>

          <div className="text-xs text-[#5C5046] flex items-center gap-1.5 bg-white p-2 rounded-lg border border-[#EBE5DA]">
            <Compass className="w-3.5 h-3.5 text-[#C18C5D] flex-shrink-0" />
            <span className="truncate">{selectedLocation.address}</span>
          </div>

          <div className="text-[10px] text-[#A89A8E] flex items-center justify-between font-mono">
            <span>좌표: {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}</span>
            <span className="text-[#15803D] font-bold">{statusNote}</span>
          </div>
        </div>

        {/* Interactive Map Iframe View */}
        <div className="relative w-full h-56 rounded-xl overflow-hidden border border-[#EBE5DA] shadow-xs bg-[#F4EFE6]">
          <iframe
            title="Google Map View"
            src={mapType === 'google' ? googleMapEmbedUrl : osmMapEmbedUrl}
            className="w-full h-full border-none"
            loading="lazy"
          />

          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-xs px-2 py-1 rounded-lg text-[10px] font-bold text-[#2C2520] border border-[#EBE5DA] shadow-xs flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMapType(mapType === 'google' ? 'osm' : 'google')}
              className="text-[#1A73E8] hover:underline"
            >
              {mapType === 'google' ? 'Google 지도' : 'OpenStreetMap'}
            </button>
          </div>

          <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-mono text-[#2C2520] border border-[#EBE5DA] shadow-xs">
            📍 {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
          </div>
        </div>

        {/* Quick Co-working / Meeting Place Presets */}
        <div>
          <label className="text-[11px] font-bold text-[#5C5046] block mb-1.5">
            주요 협업 거점 빠른 선택 (1클릭):
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {PRESET_PLACES.map((p) => {
              const isSelected = selectedLocation.name === p.name;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setSelectedLocation({
                      type: 'location',
                      name: p.name,
                      address: p.address,
                      lat: p.lat,
                      lng: p.lng,
                      accuracyMeters: 5,
                    });
                    setTrackingSource('preset');
                    setStatusNote(`✓ 거점 선택: ${p.name}`);
                  }}
                  className={`p-2 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#E6DCD0] border-[#C18C5D] text-[#3E2723] font-bold shadow-xs'
                      : 'bg-[#FDFBF7] hover:bg-[#F4EFE6] border-[#EBE5DA] text-[#4A3E34]'
                  }`}
                >
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-[10px] text-[#A89A8E] truncate">{p.address}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
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
            className="px-4 py-2 rounded-xl bg-[#EA4335] hover:bg-[#D93025] text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>이 위치로 채팅방에 공유하기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
