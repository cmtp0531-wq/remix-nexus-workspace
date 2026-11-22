import React from 'react';

// 메시지 본문의 가벼운 서식 지원: **굵게**, `코드`, URL 자동 링크
// (외부 마크다운 라이브러리 없이 정규식으로 안전하게 처리합니다.)

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

const renderInline = (text: string, keyPrefix: string, isMine: boolean): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  // 1) 굵게 / 코드 분리
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  tokens.forEach((token, index) => {
    const key = `${keyPrefix}-t${index}`;
    if (!token) return;
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      nodes.push(
        <strong key={key} className={isMine ? 'font-bold text-white' : 'font-bold text-[#1F1A16]'}>
          {token.slice(2, -2)}
        </strong>
      );
      return;
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      nodes.push(
        <code
          key={key}
          className={`px-1 py-0.5 rounded text-[11px] font-mono ${
            isMine ? 'bg-white/20 text-white' : 'bg-[#F1EBE2] text-[#3E2723]'
          }`}
        >
          {token.slice(1, -1)}
        </code>
      );
      return;
    }
    // 2) URL 링크
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    URL_PATTERN.lastIndex = 0;
    while ((match = URL_PATTERN.exec(token)) !== null) {
      const [url] = match;
      if (match.index > lastIndex) {
        nodes.push(<React.Fragment key={`${key}-p${lastIndex}`}>{token.slice(lastIndex, match.index)}</React.Fragment>);
      }
      nodes.push(
        <a
          key={`${key}-a${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline underline-offset-2 ${isMine ? 'text-white' : 'text-[#1A73E8]'}`}
        >
          {url}
        </a>
      );
      lastIndex = match.index + url.length;
    }
    if (lastIndex < token.length) {
      nodes.push(<React.Fragment key={`${key}-p${lastIndex}`}>{token.slice(lastIndex)}</React.Fragment>);
    }
  });
  return nodes;
};

interface RichTextProps {
  text: string;
  isMine?: boolean;
}

export const RichText: React.FC<RichTextProps> = ({ text, isMine = false }) => (
  <>{renderInline(String(text || ''), 'rt', isMine)}</>
);
