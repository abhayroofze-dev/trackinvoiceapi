import { useCallback, useEffect, useRef } from "react";

// Lightweight rich-text editor (contentEditable + document.execCommand), so the
// project needs no extra npm package. Supports: paragraph / headings, bold,
// italic, underline, bullet + numbered lists, alignment, links, images and
// undo / redo. Output is plain HTML; the backend sanitizes it again on save.
//
// Uncontrolled on purpose: the DOM is the source of truth while typing, and
// `value` is only written into it when it differs and the editor isn't focused
// (e.g. when a Terms template is applied) - this keeps the caret from jumping.

const MAX_IMAGE_WIDTH = 1200;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => {
      // shrink big photos so the proposal stays light
      const img = new Image();
      img.onerror = () => resolve(reader.result);
      img.onload = () => {
        if (img.width <= MAX_IMAGE_WIDTH || file.type === "image/svg+xml" || file.type === "image/gif") {
          resolve(reader.result);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = MAX_IMAGE_WIDTH;
        canvas.height = Math.round((img.height * MAX_IMAGE_WIDTH) / img.width);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function ToolButton({ title, onClick, children, active }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      // mouse-down would steal focus and lose the text selection
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 ${
        active ? "bg-slate-200" : ""
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-slate-200" />;

function RichTextEditor({ value, onChange, placeholder = "Start typing…", minHeight = 120 }) {
  const ref = useRef(null);
  const fileRef = useRef(null);

  // Write the value into the DOM only when it really differs and the user isn't typing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== (value || "") && document.activeElement !== el) {
      el.innerHTML = value || "";
    }
  }, [value]);

  const emit = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const exec = (command, arg = null) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const handleBlock = (e) => {
    const tag = e.target.value;
    exec("formatBlock", tag);
    e.target.value = "P";
  };

  const handleLink = () => {
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    exec("createLink", /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}`);
  };

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 8 * 1024 * 1024) {
      window.alert("Please choose an image smaller than 8 MB.");
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      exec("insertImage", url);
    } catch (err) {
      window.alert(err.message);
    }
  };

  const handlePaste = (e) => {
    // paste as clean text/HTML-free to avoid bringing foreign styles from Word / web pages
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (html || text) {
      e.preventDefault();
      document.execCommand("insertText", false, text);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <select
          defaultValue="P"
          onChange={handleBlock}
          aria-label="Text style"
          className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-600 outline-none"
        >
          <option value="P">Normal</option>
          <option value="H1">Heading 1</option>
          <option value="H2">Heading 2</option>
          <option value="H3">Heading 3</option>
        </select>
        <Divider />
        <ToolButton title="Bold" onClick={() => exec("bold")}><b>B</b></ToolButton>
        <ToolButton title="Italic" onClick={() => exec("italic")}><i>I</i></ToolButton>
        <ToolButton title="Underline" onClick={() => exec("underline")}><u>U</u></ToolButton>
        <Divider />
        <ToolButton title="Bullet list" onClick={() => exec("insertUnorderedList")}>• List</ToolButton>
        <ToolButton title="Numbered list" onClick={() => exec("insertOrderedList")}>1. List</ToolButton>
        <Divider />
        <ToolButton title="Align left" onClick={() => exec("justifyLeft")}>⇤</ToolButton>
        <ToolButton title="Align center" onClick={() => exec("justifyCenter")}>↔</ToolButton>
        <ToolButton title="Align right" onClick={() => exec("justifyRight")}>⇥</ToolButton>
        <ToolButton title="Justify" onClick={() => exec("justifyFull")}>☰</ToolButton>
        <Divider />
        <ToolButton title="Insert link" onClick={handleLink}>Link</ToolButton>
        <ToolButton title="Insert image" onClick={() => fileRef.current?.click()}>Image</ToolButton>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
        <Divider />
        <ToolButton title="Undo" onClick={() => exec("undo")}>↶</ToolButton>
        <ToolButton title="Redo" onClick={() => exec("redo")}>↷</ToolButton>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={handlePaste}
        style={{ minHeight }}
        className="proposal-rich proposal-editor px-3 py-2.5 text-sm text-slate-800 outline-none"
      />
    </div>
  );
}

export default RichTextEditor;
