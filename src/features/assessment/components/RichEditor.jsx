import React, { useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

// ─── Markdown ↔ HTML helpers ──────────────────────────────────────────────────

function mdToHtml(md) {
  if (!md) return '';

  let html = md
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    // Bullet lists — collect sequences
    .replace(/^- (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Paragraphs: split on double newlines, wrap non-block elements
  const blocks = html.split(/\n{2,}/);
  html = blocks
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (/^<(h[1-6]|ul|ol|hr|blockquote)/.test(block)) return block;
      // Preserve single newlines inside a paragraph as <br>
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  return html;
}

function htmlToMd(html) {
  if (!html) return '';

  let md = html
    // Headings
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1')
    // Bold
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    // Italic
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    // Horizontal rules
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    // List items
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1')
    // Remove list wrappers
    .replace(/<\/?[uo]l[^>]*>/gi, '')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Paragraphs → double newline
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    // Collapse excessive blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return md;
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolbarBtn({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`flex items-center justify-center w-7 h-7 rounded-md text-sm transition-all duration-100 ${
        active
          ? 'bg-teal-100 text-teal-700 font-bold'
          : 'text-slate-500 hover:bg-stone-100 hover:text-slate-800'
      }`}>
      {children}
    </button>
  );
}

// ─── RichEditor ───────────────────────────────────────────────────────────────

export default function RichEditor({ content, onChange, onClose, saveState }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable extensions we don't need
        codeBlock: false,
        code: false,
        blockquote: false,
      }),
    ],
    content: mdToHtml(content),
    editorProps: {
      attributes: {
        class: [
          'outline-none min-h-[220px] px-4 py-3',
          'text-[14px] leading-relaxed text-slate-800',
        ].join(' '),
        style: 'font-family: Georgia, "Times New Roman", serif; line-height: 1.8;',
      },
    },
    onUpdate({ editor }) {
      const md = htmlToMd(editor.getHTML());
      onChange(md);
    },
  });

  // Sync external content changes (shouldn't normally fire while editing)
  useEffect(() => {
    return () => { editor?.destroy(); };
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-0 rounded-xl overflow-hidden border border-teal-300 focus-within:ring-2 focus-within:ring-teal-100 bg-white"
      style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-stone-100 bg-stone-50 flex-wrap">

        {/* Text style */}
        <ToolbarBtn
          title="Bold (⌘B)"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </ToolbarBtn>
        <ToolbarBtn
          title="Italic (⌘I)"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em>I</em>
        </ToolbarBtn>

        <div className="w-px h-4 bg-stone-200 mx-1" />

        {/* Headings */}
        <ToolbarBtn
          title="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <span className="text-[11px] font-bold">H2</span>
        </ToolbarBtn>
        <ToolbarBtn
          title="Heading 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <span className="text-[11px] font-bold">H3</span>
        </ToolbarBtn>

        <div className="w-px h-4 bg-stone-200 mx-1" />

        {/* Lists */}
        <ToolbarBtn
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            <circle cx="1.5" cy="6" r="1" fill="currentColor" stroke="none"/>
            <circle cx="1.5" cy="12" r="1" fill="currentColor" stroke="none"/>
            <circle cx="1.5" cy="18" r="1" fill="currentColor" stroke="none"/>
          </svg>
        </ToolbarBtn>
        <ToolbarBtn
          title="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6h11M10 12h11M10 18h11M4 6v.01M4 12v.01M4 18v.01"/>
          </svg>
        </ToolbarBtn>

        <div className="w-px h-4 bg-stone-200 mx-1" />

        {/* Divider */}
        <ToolbarBtn
          title="Horizontal rule"
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14"/>
          </svg>
        </ToolbarBtn>

        {/* Spacer + save state */}
        <div className="flex-1" />
        <span className={`text-[10px] transition-opacity duration-300 mr-1 ${
          !saveState || saveState === 'idle' ? 'opacity-0' : 'opacity-100'
        } ${saveState === 'saved' ? 'text-teal-600' : 'text-slate-400'}`}
          style={{ fontFamily: 'DM Mono, monospace' }}>
          {saveState === 'saving' ? 'saving…' : saveState === 'saved' ? '✓ Saved' : ''}
        </span>
      </div>

      {/* Editor canvas */}
      <EditorContent editor={editor} />

      {/* Footer */}
      <div className="flex items-center justify-end px-3 py-2 border-t border-stone-100 bg-stone-50">
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-[13px] font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
          style={{ background: '#0D9488' }}>
          Save &amp; Close
        </button>
      </div>
    </div>
  );
}
