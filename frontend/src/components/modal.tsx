import { useEffect, useRef, type ReactNode } from "react";
import { closeButtonStyle, modalStyle, modalTitleStyle, overlayStyle } from "../styles";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function Modal({ title, onClose, children }: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  // keyboard users: the focus goes into the window (its 1st field), and back to the button that opened it on close
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    boxRef.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    // preventScroll: after an add, the page must stay on the new card, not jump back to the sidebar
    return () => opener?.focus({ preventScroll: true });
  }, []);

  // the page behind does not scroll while the window is open. cleanup not optional: else it stays stuck after the 1st close
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    // only the × (or the form's own Cancel) closes it: no Escape, no click on the dark background.
    // a text selection started in a field and released outside the box made a click on the background and closed it
    <div style={overlayStyle} role="presentation">
      <div ref={boxRef} style={modalStyle} role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close">×</button>
        <h2 style={modalTitleStyle}>{title}</h2>
        {children}
      </div>
    </div>
  );
}