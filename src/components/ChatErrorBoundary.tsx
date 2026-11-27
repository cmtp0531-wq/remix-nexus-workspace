import React from 'react';
import { AlertTriangle, RotateCcw, Send } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** 렌더 오류가 났을 때 메시지 데이터를 정리해 다시 그리게 합니다. */
  onRecover?: () => void;
  /** 이 값이 바뀌면 자동으로 다시 그립니다(스페이스 이동·데이터 복구). */
  resetKey?: string;
  /** 최악의 경우에도 채팅을 계속 쓸 수 있도록 최소 입력창을 함께 보여줍니다. */
  onSendFallback?: (text: string) => void;
}

interface State {
  hasError: boolean;
  message: string;
  recovered: boolean;
}

// 같은 화면에서 복구를 무한히 반복하지 않도록 세션 단위로 시도 횟수를 셉니다.
let recoverAttempts = 0;

/**
 * 채팅 영역 전용 에러 경계.
 * - 예전 버전에서 저장된 메시지·투표 데이터가 일부 깨져 있어도 화면 전체가 하얗게 멈추지 않습니다.
 * - 처음 오류가 나면 메시지 데이터를 자동으로 정리해 한 번 스스로 복구하고,
 *   그래도 안 되면 안내와 함께 '그래도 보낼 수 있는' 최소 입력창을 남깁니다.
 */
export class ChatErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '', recovered: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, message: String(error?.message || '알 수 없는 오류') };
  }

  componentDidCatch(error: Error) {
    console.error('[워크챗] 채팅 화면 오류:', error);
    if (!this.state.recovered && this.props.onRecover && recoverAttempts < 3) {
      recoverAttempts += 1;
      this.setState({ recovered: true }, () => {
        try {
          this.props.onRecover?.();
        } catch (recoverError) {
          console.warn('[워크챗] 자동 복구에 실패했습니다:', recoverError);
        }
      });
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: '' });
    }
  }

  private handleReload = () => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex-1 flex flex-col bg-[#FDFBF7] text-[#2C2520] min-h-0">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center overflow-y-auto">
          <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] text-[#B45309] flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-bold">채팅 화면 일부를 표시하지 못했습니다</h2>
          <p className="text-xs text-[#7A6A5C] max-w-xs leading-relaxed">
            저장된 메시지나 투표 데이터 일부를 읽는 중 문제가 생겼습니다. 대화는 그대로 남아 있고,
            아래 입력창으로는 계속 메시지를 보낼 수 있습니다.
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
        {this.props.onSendFallback && (
          <form
            className="p-3 border-t border-[#EBE5DA] flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const input = form.elements.namedItem('emergency') as HTMLTextAreaElement | null;
              const value = input?.value?.trim();
              if (!value) return;
              this.props.onSendFallback?.(value);
              if (input) input.value = '';
            }}
          >
            <textarea
              name="emergency"
              rows={1}
              placeholder="메시지 입력... (Enter 전송)"
              aria-label="비상 메시지 입력"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  (event.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
              className="flex-1 bg-transparent text-xs text-[#2C2520] placeholder-[#A89A8E] focus:outline-none resize-none leading-relaxed px-2 py-2 rounded-xl border border-[#EBE5DA]"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-[#3E2723] text-white text-xs font-bold hover:bg-[#2C2520] flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              전송
            </button>
          </form>
        )}
      </div>
    );
  }
}
