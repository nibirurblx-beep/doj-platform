"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useCallback } from "react";

/**
 * Rich text editor built on Tiptap.
 * Emits HTML through onChange; the server sanitises before storing.
 */
export function RichTextEditor({
  initialHtml,
  onChange,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["https", "http", "mailto"],
      }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[320px] rounded-b border border-t-0 border-grey-300 bg-white px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (https://…)", previous ?? "https://");
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div className="min-h-[360px] animate-pulse rounded border border-grey-300 bg-grey-100" />
    );
  }

  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-sm ${
      active
        ? "bg-navy-900 text-white"
        : "text-grey-700 hover:bg-grey-100"
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 rounded-t border border-grey-300 bg-grey-050 px-2 py-1.5">
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))} title="Heading 1">H1</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))} title="Heading 2">H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive("heading", { level: 3 }))} title="Heading 3">H3</button>
        <span className="mx-1 h-5 w-px bg-grey-300" />
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))} title="Bold"><strong>B</strong></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))} title="Italic"><em>I</em></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive("strike"))} title="Strikethrough"><s>S</s></button>
        <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} className={btn(editor.isActive("code"))} title="Inline code">{"<>"}</button>
        <span className="mx-1 h-5 w-px bg-grey-300" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))} title="Bullet list">• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))} title="Numbered list">1. List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))} title="Quote">&ldquo;Quote&rdquo;</button>
        <span className="mx-1 h-5 w-px bg-grey-300" />
        <button type="button" onClick={setLink} className={btn(editor.isActive("link"))} title="Add or edit link">Link</button>
        <button type="button" onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive("link")} className="rounded px-2 py-1 text-sm text-grey-700 hover:bg-grey-100 disabled:opacity-40" title="Remove link">Unlink</button>
        <span className="mx-1 h-5 w-px bg-grey-300" />
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="rounded px-2 py-1 text-sm text-grey-700 hover:bg-grey-100" title="Divider">—</button>
        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="ml-auto rounded px-2 py-1 text-sm text-grey-700 hover:bg-grey-100 disabled:opacity-40" title="Undo">↺</button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="rounded px-2 py-1 text-sm text-grey-700 hover:bg-grey-100 disabled:opacity-40" title="Redo">↻</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
