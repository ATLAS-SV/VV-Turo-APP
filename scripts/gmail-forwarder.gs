/**
 * VV inc. — Turo email forwarder (Google Apps Script).
 *
 * Runs inside the Gmail account that receives Turo emails and sends new ones to the server
 * every 5 minutes. Free, no Google Cloud project, and it doesn't expire after 7 days.
 *
 * Setup (once), signed in to that Gmail account:
 *   1. Go to https://script.google.com → New project → paste this whole file → Save.
 *   2. Project Settings (gear) → Script properties → add:
 *        VV_INTAKE_URL     https://<project-ref>.supabase.co/functions/v1/inbound-email
 *        VV_INTAKE_SECRET  <the INTAKE_SECRET you set on Supabase>
 *   3. Pick "setup" in the function menu → Run → allow access when Google asks.
 *      (It installs the 5-minute timer and sends the last 60 days of Turo emails once.)
 * When you move to the dedicated email address, repeat these steps in that account.
 */

const TURO_QUERY = 'from:(turo.com)';
const BATCH = 25;

function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('forwardNewTuroEmails').timeBased().everyMinutes(5).create();
  backfill(60);
}

/** Send Turo emails from the last `days` days (safe to repeat: the server ignores ones it has seen). */
function backfill(days) {
  sendSince_(Date.now() - days * 86400000);
}

/** Runs every 5 minutes. */
function forwardNewTuroEmails() {
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('LAST_SENT_MS') || Date.now() - 2 * 86400000);
  sendSince_(last - 10 * 60000); // small overlap; duplicates are ignored by the server
}

function sendSince_(sinceMs) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('VV_INTAKE_URL');
  const secret = props.getProperty('VV_INTAKE_SECRET');
  if (!url || !secret) throw new Error('Set VV_INTAKE_URL and VV_INTAKE_SECRET in Script properties first.');

  const afterSec = Math.floor(sinceMs / 1000);
  let newest = sinceMs;
  let batch = [];
  let start = 0;
  for (;;) {
    const threads = GmailApp.search(TURO_QUERY + ' after:' + afterSec, start, 100);
    if (!threads.length) break;
    threads.forEach((thread) => {
      thread.getMessages().forEach((m) => {
        const at = m.getDate().getTime();
        if (at < sinceMs) return;
        newest = Math.max(newest, at);
        batch.push({ messageId: m.getId(), receivedAt: m.getDate().toISOString(), subject: m.getSubject(), body: m.getPlainBody() });
        if (batch.length >= BATCH) {
          post_(url, secret, batch);
          batch = [];
        }
      });
    });
    start += threads.length;
  }
  if (batch.length) post_(url, secret, batch);
  props.setProperty('LAST_SENT_MS', String(newest));
}

function post_(url, secret, emails) {
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-intake-secret': secret },
    payload: JSON.stringify({ emails: emails }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('Server said ' + res.getResponseCode() + ': ' + res.getContentText());
}
