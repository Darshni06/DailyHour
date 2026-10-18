import { Icon, Modal, useToast } from "./ui.jsx";
import { copyText, nativeShare, waLink } from "../lib/share.js";

export default function ShareModal({ title, text, phone, cc, url, busy, error, onClose, children }) {
  const toast = useToast();
  const canNative = typeof navigator !== "undefined" && !!navigator.share;
  return (
    <Modal title={title} onClose={onClose}>
      {error && <p className="err">{error}</p>}
      {busy && <p className="muted">Preparing the link</p>}
      {url && (
        <div className="linkbox">
          <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Shareable link" />
          <button className="btn small" onClick={async () => { await copyText(url); toast("Link copied"); }}>Copy link</button>
        </div>
      )}
      <pre className="preview">{text}</pre>
      <div className="actions">
        <a className={`btn ${busy ? "disabled" : ""}`} href={waLink(phone, text, cc)} target="_blank" rel="noreferrer">
          <Icon name="chat" />WhatsApp
        </a>
        {canNative && (
          <button className="btn ghost" onClick={() => nativeShare({ title, text, url })}>
            <Icon name="share" />Share
          </button>
        )}
        <button className="btn ghost" onClick={async () => { await copyText(text); toast("Copied"); }}>
          <Icon name="copy" />Copy text
        </button>
        <button className="btn ghost" onClick={() => window.print()}>
          <Icon name="print" />Print or save PDF
        </button>
      </div>
      {children}
    </Modal>
  );
}
