import React, { useState, useEffect, useRef } from 'react';

/**
 * Minimal Markdown renderer for answer text with word-by-word streaming animation.
 *
 * The model emits Markdown, but the answer was being printed raw, so readers saw
 * literal "**(A) Direct answer**" with the asterisks showing. This covers the
 * subset actually produced: headings, bold, italics, inline code, bullet and
 * numbered lists, and horizontal rules.
 *
 * Written locally rather than pulling in a Markdown library on purpose: it adds
 * no dependency to fetch at build time, which keeps a rebuild on demo day from
 * depending on the network.
 */

// Splits a line into bold / italic / code / plain runs.
const renderInline = (text, keyPrefix) => {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith('**')) {
      parts.push(
        <strong key={key} className="font-semibold text-slate-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <code
          key={key}
          className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[0.9em] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};

export const FormattedAnswer = ({ content = '', animate = false, onComplete }) => {
  const [displayedText, setDisplayedText] = useState(animate ? '' : content);
  const [isTyping, setIsTyping] = useState(animate);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!animate) {
      setDisplayedText(content);
      setIsTyping(false);
      return;
    }

    // Tokenize by word / whitespace boundaries
    const words = String(content).split(/(\s+)/);
    let index = 0;
    setIsTyping(true);

    // Stream words progressively: 2 tokens every 18ms for crisp, natural typing cadence
    const interval = setInterval(() => {
      index += 2;
      if (index >= words.length) {
        setDisplayedText(content);
        setIsTyping(false);
        clearInterval(interval);
        if (onComplete) onComplete();
      } else {
        setDisplayedText(words.slice(0, index).join(''));
      }
    }, 18);

    return () => clearInterval(interval);
  }, [content, animate]);

  // Keep view scrolled to latest text as words appear
  useEffect(() => {
    if (isTyping && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [displayedText, isTyping]);

  // Allow user to click to immediately reveal full text
  const handleSkip = () => {
    if (isTyping) {
      setDisplayedText(content);
      setIsTyping(false);
      if (onComplete) onComplete();
    }
  };

  const lines = String(displayedText).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let list = null; // { ordered: bool, items: string[] }

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag
        key={`list-${blocks.length}`}
        className={`my-2 space-y-1.5 pl-5 ${list.ordered ? 'list-decimal' : 'list-disc'} marker:text-emerald-600/60 dark:marker:text-emerald-400/50`}
      >
        {list.items.map((item, idx) => (
          <li key={idx} className="pl-1 leading-relaxed">
            {renderInline(item, `l${blocks.length}-${idx}`)}
          </li>
        ))}
      </Tag>
    );
    list = null;
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    // Horizontal rule
    if (/^(---+|___+|\*\*\*+)$/.test(trimmed)) {
      flushList();
      blocks.push(<hr key={`hr-${idx}`} className="my-4 border-slate-200/70 dark:border-white/[0.08]" />);
      return;
    }

    // Headings
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const size = level <= 2 ? 'text-[15.5px]' : 'text-[14.5px]';
      blocks.push(
        <p key={`h-${idx}`} className={`mb-1.5 mt-4 font-semibold text-slate-900 first:mt-0 dark:text-white ${size}`}>
          {renderInline(heading[2], `h${idx}`)}
        </p>
      );
      return;
    }

    // Numbered list item
    const ordered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (ordered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[2]);
      return;
    }

    // Bullet list item
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      return;
    }

    // Paragraph
    flushList();
    blocks.push(
      <p key={`p-${idx}`} className="mb-2 leading-relaxed last:mb-0">
        {renderInline(trimmed, `p${idx}`)}
      </p>
    );
  });

  return (
    <div
      ref={containerRef}
      onClick={handleSkip}
      className={`text-[14px] text-slate-700 dark:text-slate-300 ${isTyping ? 'cursor-pointer' : ''}`}
      title={isTyping ? 'Click to show all' : undefined}
    >
      {blocks}
      {isTyping && (
        <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-emerald-600 align-middle dark:bg-emerald-400" />
      )}
    </div>
  );
};
