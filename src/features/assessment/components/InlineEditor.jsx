import React, { useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAutoSave } from '../../../hooks/useAutoSave.js';
import { markSectionEdited, setDraftContent } from '../assessmentStore.js';
import RichEditor from './RichEditor.jsx';
import SkillAcquisitionsEditor from './SkillAcquisitionsEditor.jsx';
import SkillAcquisitionsReviewView from './SkillAcquisitionsReviewView.jsx';
import MaladaptiveBehaviorsReviewView from './MaladaptiveBehaviorsReviewView.jsx';
import MaladaptiveBehaviorsEditor from './MaladaptiveBehaviorsEditor.jsx';

// ─── Placeholder regex ────────────────────────────────────────────────────────
const PLACEHOLDER_RE = /\[BCBA to complete:[^\]]*\]/g;

// ─── Markdown view components ─────────────────────────────────────────────────
const VIEW_COMPONENTS = {
  p: ({ children }) => (
    <p className="mb-3 text-[14px] leading-relaxed text-slate-700"
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-slate-800">{children}</strong>
  ),
  hr: () => (
    <hr className="my-4 border-stone-200" />
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-slate-800 mt-5 mb-2"
      style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-1.5"
      style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 pl-4 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 pl-4 space-y-1 list-decimal">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-[13px] text-slate-700 leading-relaxed"
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {children}
    </li>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-[12px] border-collapse"
        style={{ border: '1px solid #B2D8D3' }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: '#E8F5F3' }}>{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody>{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="md-table-row" style={{ borderBottom: '1px solid #B2D8D3' }}>{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold"
      style={{ color: '#2D7D6F', borderRight: '1px solid #B2D8D3', wordBreak: 'break-word', whiteSpace: 'normal' }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-slate-700 align-top"
      style={{ borderRight: '1px solid #B2D8D3', wordBreak: 'break-word', whiteSpace: 'normal' }}>
      {children}
    </td>
  ),
};

// ─── Render content with placeholder highlights ───────────────────────────────
function renderWithPlaceholders(text) {
  if (!text) return null;
  const parts = [];
  let last = 0;
  let match;
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(
        <ReactMarkdown key={last} remarkPlugins={[remarkGfm]} components={VIEW_COMPONENTS}>
          {text.slice(last, match.index)}
        </ReactMarkdown>
      );
    }
    parts.push(
      <span key={match.index} className="placeholder-block">{match[0]}</span>
    );
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(
      <ReactMarkdown key={last} remarkPlugins={[remarkGfm]} components={VIEW_COMPONENTS}>
        {text.slice(last)}
      </ReactMarkdown>
    );
  }

  return parts.length > 0 ? parts : (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={VIEW_COMPONENTS}>
      {text}
    </ReactMarkdown>
  );
}

// ─── InlineEditor ─────────────────────────────────────────────────────────────

export default function InlineEditor({ clientId, sectionKey, section, session, setClients, onNavigate }) {
  const [editing,   setEditing]   = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const anchorRef = useRef(null); // points to the section card (set via callback ref from parent)
  const editorRef = useRef(null);

  const content = section?.draftContent ?? '';

  const handleChange = useCallback((newContent) => {
    if (!hasEdited) {
      markSectionEdited(setClients, clientId, sectionKey);
      setHasEdited(true);
    }
    setDraftContent(setClients, clientId, sectionKey, newContent, 'edited', section?.aiOriginalContent);
  }, [hasEdited, clientId, sectionKey, setClients, section?.aiOriginalContent]);

  const { saveState } = useAutoSave(content, handleChange, 800);

  const isSkillAcquisitions = sectionKey === 'skill_acquisitions';
  const isMaladaptive       = sectionKey === 'behavior_targets';

  // Close editor and scroll the section card back into view at the top of the scroll pane
  const handleClose = useCallback(() => {
    // Capture the card element before the state change collapses the editor
    const card = editorRef.current?.closest('[data-section-card]');
    const scrollPane = card?.closest('[data-review-scroll]');

    setEditing(false);

    // After React re-renders (editor gone, read view restored), pin the card's top
    // to where the scroll pane's top is so the user sees exactly this section.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (card && scrollPane) {
          const cardTop    = card.getBoundingClientRect().top;
          const paneTop    = scrollPane.getBoundingClientRect().top;
          scrollPane.scrollTop += cardTop - paneTop - 16; // 16px breathing room
        } else {
          card?.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      });
    });
  }, []);

  if (!content && !editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="flex items-center justify-center py-8 border-2 border-dashed border-stone-200 rounded-xl cursor-pointer hover:border-teal-300 hover:bg-teal-50/30 transition-all group">
        <span className="text-sm text-slate-400 group-hover:text-teal-600 transition-colors">
          Click to add content
        </span>
      </div>
    );
  }

  // Skill acquisitions: custom view + editor (not markdown-based)
  if (isSkillAcquisitions) {
    if (editing) {
      return (
        <div ref={editorRef}>
          <SkillAcquisitionsEditor
            session={session}
            clientId={clientId}
            setClients={setClients}
            onClose={handleClose}
          />
        </div>
      );
    }
    return (
      <div className="group relative">
        <button
          onClick={() => setEditing(true)}
          title="Edit section"
          className="absolute top-0 right-0 flex items-center justify-center w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-teal-50"
          style={{ color: '#0D9488' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 013.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
          </svg>
        </button>
        <SkillAcquisitionsReviewView session={session} draftContent={content} />
      </div>
    );
  }

  // Maladaptive Behaviors: structured card editor (same pattern as Skill Acquisitions)
  if (isMaladaptive) {
    if (editing) {
      return (
        <div ref={editorRef}>
          <MaladaptiveBehaviorsEditor
            session={session}
            clientId={clientId}
            setClients={setClients}
            onClose={handleClose}
          />
        </div>
      );
    }
    return (
      <div className="group relative">
        <button
          onClick={() => setEditing(true)}
          title="Edit behaviors"
          className="absolute top-0 right-0 flex items-center justify-center w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-teal-50"
          style={{ color: '#0D9488' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 013.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
          </svg>
        </button>
        <MaladaptiveBehaviorsReviewView session={session} draftContent={content} />
      </div>
    );
  }

  if (editing) {
    return (
      <div ref={editorRef}>
        <RichEditor
          content={content}
          onChange={handleChange}
          onClose={handleClose}
          saveState={saveState}
        />
      </div>
    );
  }

  // View mode
  return (
    <div className="group relative">
      {/* Edit pencil — top-right of the blurb */}
      <button
        onClick={() => setEditing(true)}
        title="Edit section"
        className="absolute top-0 right-0 flex items-center justify-center w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-teal-50"
        style={{ color: '#0D9488' }}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 013.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
        </svg>
      </button>
      <div className="prose-content pr-8">
        {renderWithPlaceholders(content)}
      </div>
    </div>
  );
}
