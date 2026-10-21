import { emailDateStyle, emailLineStyle, emailRowStyle, gmailListStyle, widgetMessageStyle } from "../styles";

export type Email = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  threadId: string;
};

type GmailInboxProps = {
  emails: Email[];
  // the card's address: each mail opens in THIS Gmail account (null = a connection older than multi-account)
  account: string | null;
};

// web Gmail. authuser: opens THIS address, even when the browser is signed in to several Google accounts (without it, Gmail opens the browser's 1st account, maybe not the one of this card)
const GMAIL_WEB = "https://mail.google.com/mail/";
export const gmailUrl = (account: string | null, threadId?: string) => {
  const user = account ? `?authuser=${encodeURIComponent(account)}` : "";
  // #all/<id>: the conversation, found even if it was archived since. #inbox: the mailbox
  const place = threadId ? `#all/${encodeURIComponent(threadId)}` : "#inbox";
  return `${GMAIL_WEB}${user}${place}`;
};

export default function GmailInbox({ emails, account }: GmailInboxProps) {
  if (emails.length === 0) {
    return <p style={widgetMessageStyle}>Your inbox is empty.</p>;
  }

  return (
    <ul style={gmailListStyle}>
      {emails.map((mail) => {
        const isUnread = mail.unread;
        const shortDate = new Date(mail.date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        });

        return (
          <li key={mail.id}>
            {/* a link, not a div: it opens a page, and Tab + Enter work with nothing to add.
                noreferrer: the new tab does not learn the dashboard's address, and cannot act on its tab */}
            <a href={gmailUrl(account, mail.threadId)} target="_blank" rel="noreferrer" className="gmail-row" style={emailRowStyle}>
              <div style={{ ...emailLineStyle, fontWeight: isUnread ? 700 : 400 }}>{mail.from}</div>
              <div style={emailDateStyle}>{shortDate}</div>
              <div style={{ ...emailLineStyle, gridColumn: "1 / -1" }}>
                <span style={{ fontWeight: isUnread ? 700 : 400 }}>{mail.subject}</span>
                <span> — </span>
                <span style={{ color: "#6b7280" }}>{mail.snippet}</span>
              </div>
              {/* said to screen readers only: a new tab is no surprise */}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

