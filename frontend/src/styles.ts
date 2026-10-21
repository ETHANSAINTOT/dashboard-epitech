import type { CSSProperties } from "react";

export const pageStyle: CSSProperties = { minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#e8f5e9", fontFamily: "Arial, sans-serif", padding: "20px", boxSizing: "border-box" };
export const cardStyle: CSSProperties = { width: "100%", maxWidth: "460px", backgroundColor: "#fff", padding: "40px 35px", borderRadius: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" };
export const titleStyle: CSSProperties = { margin: "0 0 8px", fontSize: "32px", color: "#1b5e20", textAlign: "center" };
export const subtitleStyle: CSSProperties = { margin: "0 0 30px", color: "#666", fontSize: "16px", textAlign: "center" };
export const fieldStyle: CSSProperties = { marginBottom: "18px", display: "flex", flexDirection: "column" };
export const labelStyle: CSSProperties = { marginBottom: "6px", fontSize: "14px", color: "#333", fontWeight: "bold" };
export const inputStyle: CSSProperties = { padding: "12px 14px", border: "1px solid #ddd", borderRadius: "10px", fontSize: "15px", fontFamily: "inherit" };
export const errorStyle: CSSProperties = { marginTop: "6px", fontSize: "13px", color: "#c62828" };
export const hintStyle: CSSProperties = { margin: "0 0 25px", fontSize: "13px", color: "#777", lineHeight: 1.5 };
// signup "I accept the Terms of Service": a box big enough to tick, the link in the dashboard's green
export const termsBlockStyle: CSSProperties = { marginBottom: "22px" };
export const termsRowStyle: CSSProperties = { display: "flex", alignItems: "flex-start", gap: "10px" };
export const termsCheckboxStyle: CSSProperties = { width: "20px", height: "20px", margin: "1px 0 0", flexShrink: 0, accentColor: "#2e7d32", cursor: "pointer" };
export const termsLabelStyle: CSSProperties = { fontSize: "14px", color: "#333", lineHeight: 1.5, cursor: "pointer" };
export const termsLinkStyle: CSSProperties = { color: "#2e7d32", fontWeight: "bold" };
export const primaryButtonStyle: CSSProperties = { width: "100%", padding: "14px", border: "none", borderRadius: "10px", backgroundColor: "#43a047", color: "#fff", fontSize: "16px", fontWeight: "bold", cursor: "pointer" };
export const linkButtonStyle: CSSProperties = { width: "100%", marginTop: "15px", padding: "10px", border: "none", background: "none", color: "#2e7d32", fontSize: "14px", cursor: "pointer", fontFamily: "inherit" };
export const successStyle: CSSProperties = { marginTop: "18px", padding: "12px", borderRadius: "10px", backgroundColor: "#e8f5e9", color: "#1b5e20", fontSize: "14px", textAlign: "center" };
export const dangerButtonStyle: CSSProperties = { width: "100%", padding: "14px", border: "none", borderRadius: "10px", backgroundColor: "#c62828", color: "#fff", fontSize: "16px", fontWeight: "bold", cursor: "pointer" };
export const dividerStyle: CSSProperties = { height: "1px", backgroundColor: "#e0e0e0", margin: "35px 0 25px" };
// dashboard page + header: their padding, font sizes and layout are in index.css (.dashboard-page, .dashboard-header...), they change on a phone
export const dashboardPageStyle: CSSProperties = { minHeight: "100vh", backgroundColor: "#e8f5e9", fontFamily: "Arial, sans-serif", boxSizing: "border-box" };
export const welcomeStyle: CSSProperties = { margin: 0, justifySelf: "start", color: "#1b5e20", fontWeight: "bold" };
const pillButtonStyle: CSSProperties = { margin: 0, backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "none", cursor: "pointer", fontFamily: "inherit" };
export const dashboardPillStyle: CSSProperties = { ...pillButtonStyle, borderRadius: "18px", fontWeight: "bold", color: "#2e7d32" };
// right of the header: placed by .dashboard-header-actions (index.css), not by itself anymore
export const signOutButtonStyle: CSSProperties = { ...pillButtonStyle, fontWeight: "bold", color: "#1b5e20", border: "2px solid #43a047", boxShadow: "0 6px 18px rgba(27, 94, 32, 0.25)" };
// "Legal notice" next to it: the very same look. a link (it opens a page), so no underline
export const legalLinkHeaderStyle: CSSProperties = { ...signOutButtonStyle, textDecoration: "none" };
export const widgetAreaStyle: CSSProperties = { minHeight: "50vh", marginTop: "30px" };
export const deleteZoneStyle: CSSProperties = { display: "flex", justifyContent: "center", marginTop: "40px" };
export const deleteAccountButtonStyle: CSSProperties = { padding: "12px 28px", border: "none", borderRadius: "12px", backgroundColor: "#c62828", color: "#fff", fontSize: "15px", fontWeight: "bold", cursor: "pointer", fontFamily: "inherit" };
export const overlayStyle: CSSProperties = { position: "fixed", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 100 };
// maxHeight + scroll: on a low screen (phone turned sideways) the buttons stay reachable
export const modalStyle: CSSProperties = { position: "relative", width: "100%", maxWidth: "440px", maxHeight: "calc(100vh - 40px)", overflowY: "auto", boxSizing: "border-box", backgroundColor: "#fff", borderRadius: "20px", padding: "30px", boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)" };
export const modalTitleStyle: CSSProperties = { margin: "0 0 12px", fontSize: "20px", color: "#333", paddingRight: "30px" };
export const closeButtonStyle: CSSProperties = { position: "absolute", top: "14px", right: "14px", width: "30px", height: "30px", border: "none", borderRadius: "8px", backgroundColor: "transparent", color: "#666", fontSize: "22px", lineHeight: 1, cursor: "pointer", fontFamily: "inherit" };
export const widgetCardStyle: CSSProperties = { backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 4px 14px rgba(0,0,0,0.06)", overflow: "hidden", border: "1px solid #e0e0e0" };
export const widgetHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "14px 16px", borderBottom: "1px solid #eee", backgroundColor: "#f9fbf9" };
export const widgetTitleStyle: CSSProperties = { margin: 0, flex: 1, fontSize: "16px", fontWeight: "bold", color: "#1b5e20", display: "flex", alignItems: "center", gap: "8px" };
export const widgetButtonStyle: CSSProperties = { padding: "8px 16px", border: "1px solid #c8e6c9", borderRadius: "8px", backgroundColor: "#fff", color: "#2e7d32", fontSize: "14px", fontWeight: "bold", cursor: "pointer", fontFamily: "inherit" };
export const widgetMessageStyle: CSSProperties = { padding: "24px 16px", color: "#777", fontSize: "14px", textAlign: "center" };
// the mail list: a real list for screen readers ("list, 5 items"), without bullets
export const gmailListStyle: CSSProperties = { margin: 0, padding: 0, listStyle: "none" };
export const emailRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr auto", columnGap: "10px", rowGap: "2px", padding: "10px 16px", borderBottom: "1px solid #f3f3f3", fontSize: "13px" };
export const emailLineStyle: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };
export const emailDateStyle: CSSProperties = { color: "#777", fontSize: "12px", whiteSpace: "nowrap" };
export const sidebarTitleStyle: CSSProperties = { margin: 0, fontSize: "18px", color: "#1b5e20", fontWeight: "bold" };
// flex and wrapping are in index.css (.widget-title): a long title is never cut, the buttons go under it
export const frameTitleStyle: CSSProperties = { margin: 0, minWidth: 0, fontSize: "16px", fontWeight: "bold", color: "#1b5e20" };
export const frameActionsStyle: CSSProperties = { display: "flex", alignItems: "center", gap: "6px" };
export const frameActionButtonStyle: CSSProperties = { padding: "4px 10px", fontSize: "12px", fontWeight: "bold", border: "1px solid #c8e6c9", borderRadius: "8px", backgroundColor: "#fff", color: "#2e7d32", cursor: "pointer", fontFamily: "inherit" };
export const gmailAccountStyle: CSSProperties = { margin: 0, padding: "8px 16px", fontSize: "12px", color: "#666", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
// settings panel at the top of a card body (gmail refresh), same look as the clock's "Change city" panel
export const settingsPanelStyle: CSSProperties = { padding: "14px 16px", borderBottom: "1px solid #eee", backgroundColor: "#fbfcfb" };
export const settingsHintStyle: CSSProperties = { margin: "0 0 12px", fontSize: "12px", color: "#666", lineHeight: 1.4 };
export const settingsActionsStyle: CSSProperties = { display: "flex", gap: "8px" };
// the add window's buttons: bigger than the card ones (easier to hit, on a phone too). the main one filled,
// #2e7d32 and not #43a047: white text on it stays above 4.5:1 contrast
export const formActionsStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "6px" };
export const formButtonStyle: CSSProperties = { padding: "10px 18px", border: "1px solid #c8e6c9", borderRadius: "10px", backgroundColor: "#fff", color: "#2e7d32", fontSize: "14px", fontWeight: "bold", cursor: "pointer", fontFamily: "inherit" };
export const formPrimaryButtonStyle: CSSProperties = { ...formButtonStyle, border: "1px solid #2e7d32", backgroundColor: "#2e7d32", color: "#fff" };
// Cancel: red like the other "leave / remove" buttons. white on #c62828 is above 4.5:1 too
export const formCancelButtonStyle: CSSProperties = { ...formButtonStyle, border: "1px solid #c62828", backgroundColor: "#c62828", color: "#fff" };
// clock widget. dark green on light green: above 4.5:1 contrast
export const clockBodyStyle: CSSProperties = { padding: "24px 20px", textAlign: "center" };
export const clockTimeStyle: CSSProperties = { margin: 0, fontSize: "40px", fontWeight: "bold", color: "#1b5e20", letterSpacing: "1px", fontFamily: "monospace" };
export const clockDateStyle: CSSProperties = { margin: "6px 0 0", fontSize: "15px", color: "#444" };
export const clockBadgesStyle: CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px", margin: "14px 0 0", padding: 0, listStyle: "none" };
export const clockBadgeStyle: CSSProperties = { padding: "4px 10px", borderRadius: "20px", backgroundColor: "#e8f5e9", color: "#1b5e20", fontSize: "12px", fontWeight: "bold" };
// translate widget
export const translateBodyStyle: CSSProperties = { padding: "14px 16px" };
export const translateLanguagesStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", gap: "8px", alignItems: "end", marginBottom: "12px" };
export const translateFieldStyle: CSSProperties = { display: "grid", gap: "4px", minWidth: 0, fontSize: "12px", color: "#555" };
export const translateSelectStyle: CSSProperties = { width: "100%", minWidth: 0, padding: "7px 8px", border: "1px solid #ccc", borderRadius: "6px", backgroundColor: "#fff", font: "inherit" };
export const translateSwapStyle: CSSProperties = { width: "34px", height: "34px", border: "1px solid #c8e6c9", borderRadius: "8px", backgroundColor: "#fff", color: "#2e7d32", fontSize: "18px", cursor: "pointer" };
export const translateTextareaStyle: CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", padding: "9px 10px", border: "1px solid #ccc", borderRadius: "6px", font: "inherit", resize: "none" };
export const translateMetaStyle: CSSProperties = { display: "flex", justifyContent: "space-between", margin: "5px 0 10px", fontSize: "11px", color: "#777" };
// fixed max height + scroll: a long translation must not grow the card over its neighbours
export const translateResultStyle: CSSProperties = { minHeight: "58px", maxHeight: "110px", overflowY: "auto", padding: "9px 10px", border: "1px solid #eee", borderRadius: "6px", backgroundColor: "#fafafa", fontSize: "13px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" };
// weather widget. deep sky blue: white text stays above 4.5:1 contrast, and the white icons (clouds, wind...) show
export const weatherBodyStyle: CSSProperties = { padding: "16px", background: "linear-gradient(135deg, #14507a 0%, #2a78b0 100%)", color: "#fff", textAlign: "center" };
export const weatherMainStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" };
export const weatherIconStyle: CSSProperties = { width: "64px", height: "64px" };
export const weatherTempStyle: CSSProperties = { margin: 0, fontSize: "40px", fontWeight: 500, lineHeight: 1 };
export const weatherLabelStyle: CSSProperties = { margin: "6px 0 0", fontSize: "15px" };
export const weatherDetailsStyle: CSSProperties = { display: "flex", justifyContent: "space-around", gap: "8px", marginTop: "14px", fontSize: "14px" };
export const weatherDetailStyle: CSSProperties = { display: "flex", alignItems: "center", gap: "6px" };
export const weatherSmallIconStyle: CSSProperties = { width: "20px", height: "20px", objectFit: "contain" };
export const weatherFooterStyle: CSSProperties = { margin: "12px 0 0", fontSize: "11px", opacity: 0.9 };
export const weatherLinkStyle: CSSProperties = { color: "inherit" };
// forecast widget: inside the blue weather body, one row per day (date | sky | min - max | chance of rain)
export const forecastCaptionStyle: CSSProperties = { margin: "0 0 6px", fontSize: "13px", fontWeight: "bold", textAlign: "left" };
export const forecastListStyle: CSSProperties = { margin: 0, padding: 0, listStyle: "none", textAlign: "left" };
export const forecastDayStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 36px minmax(0, 1fr) 80px", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.25)", fontSize: "14px" };
export const forecastIconStyle: CSSProperties = { width: "36px", height: "36px" };
export const forecastTempStyle: CSSProperties = { fontWeight: "bold", whiteSpace: "nowrap" };
export const forecastRainStyle: CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
// square icon button of a card header (duplicate), same size as the remove one
export const frameIconButtonStyle: CSSProperties = { width: "28px", height: "28px", padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #c8e6c9", borderRadius: "8px", backgroundColor: "#fff", color: "#2e7d32", cursor: "pointer" };
export const frameRemoveButtonStyle: CSSProperties = { width: "28px", height: "28px", padding: 0, border: "1px solid #f8bbd0", borderRadius: "8px", backgroundColor: "#fff", color: "#c62828", fontSize: "18px", lineHeight: 1, cursor: "pointer", fontFamily: "inherit" };
// layout in index.css (.sidebar-item): on a phone the "+ Add" button goes under the name
export const sidebarItemStyle: CSSProperties = { padding: "10px", backgroundColor: "#f4faf4", borderRadius: "10px" };
export const sidebarItemLabelStyle: CSSProperties = {margin: 0, fontSize: "16px", color: "#1b5e20", fontWeight: "bold"};
export const sidebarItemDescStyle: CSSProperties = {margin: 0, fontSize: "12px", color: "#666"};
// "Active Widgets" title, and the dashed box shown while there is no widget
export const canvasTitleStyle: CSSProperties = { margin: 0, fontSize: "20px", color: "#1b5e20" };
export const emptyCanvasStyle: CSSProperties = { textAlign: "center", padding: "60px 20px", marginTop: "20px", backgroundColor: "#fff", borderRadius: "16px", border: "1px dashed #c8e6c9" };
export const emptyCanvasTextStyle: CSSProperties = { margin: 0, fontSize: "18px", color: "#444" };
// rss widget. #666 and darker on white: the small grey texts stay above 4.5:1 contrast
export const rssListStyle: CSSProperties = { margin: 0, padding: 0, listStyle: "none" };
export const rssItemStyle: CSSProperties = { padding: "10px 16px", borderBottom: "1px solid #f3f3f3" };
export const rssTitleStyle: CSSProperties = { color: "#1b5e20", fontSize: "14px", fontWeight: "bold", lineHeight: 1.3, textDecoration: "none" };
// cut after 2 lines with "...": a long description must not make the card huge
export const rssDescriptionStyle: CSSProperties = { margin: "4px 0", fontSize: "13px", color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };
export const rssDateStyle: CSSProperties = { fontSize: "12px", color: "#666" };
export const rssFooterStyle: CSSProperties = { margin: 0, padding: "8px 16px", fontSize: "11px", color: "#666" };
// free games widget
export const freeGameItemStyle: CSSProperties = { display: "flex", gap: "10px", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #f3f3f3" };
export const freeGameThumbStyle: CSSProperties = { width: "60px", height: "28px", objectFit: "cover", borderRadius: "4px", flexShrink: 0 };
export const freeGameLinkStyle: CSSProperties = { textDecoration: "none" };
export const freeGameTitleStyle: CSSProperties = { color: "#1b5e20", fontSize: "14px", fontWeight: "bold", lineHeight: 1.3 };
export const freeGameMetaStyle: CSSProperties = { margin: "2px 0 0", fontSize: "12px", color: "#666" };
// "Only 2 of the 5 games...": under the list, small but above 4.5:1 contrast
export const freeGameNoteStyle: CSSProperties = { margin: 0, padding: "10px 16px 0", fontSize: "12px", color: "#555", lineHeight: 1.4 };
export const freeGameNoteLinkStyle: CSSProperties = { color: "#2e7d32", fontWeight: "bold" };
// "Open Gmail" at the bottom of the card: a link that looks like a button, full width
export const gmailOpenStyle: CSSProperties = { display: "block", margin: "12px 16px 14px", padding: "10px", border: "1px solid #c8e6c9", borderRadius: "10px", color: "#2e7d32", fontSize: "14px", fontWeight: "bold", textAlign: "center", textDecoration: "none" };
// "Legal notice": a white rectangle under the home card, as wide (490px). #2e7d32 text on white: above 4.5:1 contrast
export const legalLinkStyle: CSSProperties = { display: "block", width: "100%", maxWidth: "490px", boxSizing: "border-box", padding: "14px", borderRadius: "16px", backgroundColor: "#fff", color: "#2e7d32", fontSize: "16px", fontWeight: "bold", textAlign: "center", textDecoration: "none" };
