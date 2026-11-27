import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * 채팅 영역 전용 에러 경계.
 * 예전 버전에서 저장된 메시지·투표 데이터가 일부 깨져 있어도
 * 화면 전체가 하얗게 멈추지 않고, 이 영역만 안내로 바꿔줍니다.
 */
export class ChatErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: String(error?.message || '알 수 없는 오류') };
  }

  componentDidCatch(error: Error) {
    console.error('[워크챗] 채팅 화면 오류:', error);
  }

  private handleReload = () => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center bg-[#FDFBF7] text-[#2C2520]">
        <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] text-[#B45309] flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-bold">채팅 화면을 표시하지 못했습니다</h2>
        <p className="text-xs text-[#7A6A5C] max-w-xs leading-relaxed">
          저장된 메시지나 투표 데이터 일부를 읽는 중 문제가 생겼습니다. 다시 불러오면 대화는 그대로 남아 있습니다.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#3E2723] text-white text-xs font-bold hover:bg-[#2C2520]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          다시 불러오기
        </button>
      </div>
    );
  }
}
