import React from 'react';

// 메시지 본문의 가벼운 서식 지원: **굵게**, `코드`, URL 자동 링크
// (외부 마크다운 라이브러리 없이 정규식으로 안전하게 처리합니다.)
// 말풍선 배경색은 사용자가 고를 수 있으므로, 글자색은 항상 말풍선의
// 글자색(currentColor)을 그대로 물려받아 어떤 색에서도 묻히지 않게 합니다.

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  // 1) 굵게 / 코드 분리
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  tokens.forEach((token, index) => {
    const key = `${keyPrefix}-t${index}`;
    if (!token) return;
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      nodes.push(
        <strong key={key} className="font-bold">
          {token.slice(2, -2)}
        </strong>
      );
      return;
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      nodes.push(
        <code
          key={key}
          className="nx-inline-chip px-1 py-0.5 rounded text-[11px] font-mono"
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
          className="underline underline-offset-2 font-semibold"
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
  /** 하위 호환용: 색은 말풍선에서 물려받으므로 더 이상 분기하지 않습니다. */
  isMine?: boolean;
}

export const RichText: React.FC<RichTextProps> = ({ text }) => (
  <>{renderInline(String(text || ''), 'rt')}</>
);
