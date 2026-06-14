import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { NewsItem } from "./base.js";

const MAX_MESSAGES_PER_POLL = 40;

export interface ImapConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  folder?: string;
  tls?: boolean;
}

export interface RawEmail {
  subject: string;
  sender: string;
  messageId: string;
  publishedAt: Date | null;
  body: string;
}

export function parseImapConfig(json: string): ImapConfig {
  try {
    return JSON.parse(json || "{}") as ImapConfig;
  } catch {
    return {};
  }
}

/**
 * Poll the most recent messages from an IMAP folder. Designed for a monitoring inbox you
 * route alerts into — broker/PMS notices, exchange mailers, BSE/NSE filing emails, paid
 * research newsletters, Google-Alert digests. Read-only; never modifies the mailbox.
 */
export async function fetchImap(_sourceId: number, configJson: string): Promise<RawEmail[]> {
  const cfg = parseImapConfig(configJson);
  const host = cfg.host;
  const port = cfg.port ?? 993;
  const username = cfg.username;
  const password = cfg.password;
  const folder = cfg.folder ?? "INBOX";
  if (!host || !username || !password) return [];

  const client = new ImapFlow({
    host,
    port,
    secure: cfg.tls !== false, // default TLS on
    auth: { user: username, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const mailbox = client.mailbox;
      if (!mailbox || typeof mailbox === "boolean") return [];
      const total = mailbox.exists;
      if (!total || total === 0) return [];
      const start = Math.max(1, total - MAX_MESSAGES_PER_POLL + 1);
      const range = `${start}:${total}`;

      const messages: RawEmail[] = [];
      for await (const msg of client.fetch(range, { uid: true, source: true })) {
        if (!msg.source) continue;
        try {
          const parsed = await simpleParser(msg.source);
          const subject = (parsed.subject ?? "").trim() || "(no subject)";
          const from = parsed.from?.text ?? parsed.from?.value?.[0]?.address ?? "";
          const mid =
            (parsed.messageId ?? "").replace(/^<|>$/g, "") || `${host}:${folder}:${msg.uid}`;
          const date = parsed.date ?? null;
          const text = (parsed.text ?? "").trim().slice(0, 8000);
          messages.push({
            subject,
            sender: from,
            messageId: mid,
            publishedAt: date,
            body:
              text ||
              (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ").slice(0, 8000) : ""),
          });
        } catch {
          // skip malformed message
        }
      }
      return messages.reverse(); // newest first
    } finally {
      lock.release();
    }
  } catch (e) {
    console.warn(`[custom_imap] failed:`, (e as Error).message);
    return [];
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
  }
}

export function emailToNewsItem(sourceId: number, msg: RawEmail): NewsItem | null {
  if (!msg.messageId) return null;
  return {
    source: `custom_imap_${sourceId}`,
    externalId: msg.messageId,
    title: msg.subject,
    url: `mailto:?subject=${encodeURIComponent(msg.subject)}`,
    description: msg.body.slice(0, 1000),
    author: msg.sender,
    publishedAt: msg.publishedAt,
  };
}

/** Quick connect/login check for the "test connection" affordance in the UI. */
export async function testImap(configJson: string): Promise<{ ok: boolean; error?: string; messages?: number }> {
  const cfg = parseImapConfig(configJson);
  if (!cfg.host || !cfg.username || !cfg.password) {
    return { ok: false, error: "host, username and password are required" };
  }
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port ?? 993,
    secure: cfg.tls !== false,
    auth: { user: cfg.username, pass: cfg.password },
    logger: false,
  });
  try {
    await client.connect();
    const lock = await client.getMailboxLock(cfg.folder ?? "INBOX");
    try {
      const mb = client.mailbox;
      const messages = mb && typeof mb !== "boolean" ? mb.exists : 0;
      return { ok: true, messages };
    } finally {
      lock.release();
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}
