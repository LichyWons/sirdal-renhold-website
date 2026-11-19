// Wariant B — automatisk svar til kunden.
//
// Save as: netlify/functions/submission-created.mjs
//
// This is a Netlify *event* function: the name is the trigger. Netlify runs
// it automatically every time a Netlify Form receives a submission — there
// is no webhook to configure and nothing on the page calls it.
//
// That split is deliberate. Netlify Forms already covers two of the four
// things § 1.2 d) of the contract asks for:
//
//   • gromadzenie leadów    → submissions are stored in the Netlify panel
//                             and export to CSV
//   • powiadomienie         → Netlify emails the client on each submission
//                             (Forms → Settings → Form notifications)
//   • antyspam              → built-in honeypot + optional spam filtering
//
// The one thing Netlify cannot do is send a confirmation to the *customer*.
// That is all this function does.
//
// ---------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------
// 1. Netlify → Site configuration → Environment variables:
//      RESEND_API_KEY   — from resend.com (free tier: 100 e-mails/day)
//      MAIL_FROM        — see the note on sender domains below
//      MAIL_REPLY_TO    — post@sirdalrenhold.no
// 2. Netlify → Forms → Form notifications → add an email notification to
//    the client's address. That is the "powiadomienie" half; it is a panel
//    setting, not code.
//
// ---------------------------------------------------------------------
// Sender domain — read before launch
// ---------------------------------------------------------------------
// Sending as @sirdalrenhold.no requires SPF and DKIM records on that
// domain, which needs the DNS access we do not have yet. Until then set
// MAIL_FROM to a sender on Resend's own verified domain and leave
// MAIL_REPLY_TO pointing at the client — replies still reach her, the mail
// just does not originate from her domain. Switch MAIL_FROM over once DNS
// is available; nothing else in this file changes.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export default async (req) => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  const replyTo = process.env.MAIL_REPLY_TO;

  if (!key || !from) {
    console.error('[auto-svar] missing RESEND_API_KEY or MAIL_FROM');
    return new Response('misconfigured', { status: 500 });
  }

  let data;
  try {
    const body = await req.json();
    // Netlify wraps the fields in `payload.data`.
    data = body?.payload?.data ?? body?.data ?? {};
  } catch (err) {
    console.error('[auto-svar] could not parse submission', err);
    return new Response('bad payload', { status: 400 });
  }

  const email = String(data.email ?? '').trim();
  const name = String(data.name ?? '').trim();

  // No address, nothing to confirm. Not an error — the client still gets
  // her notification and the lead is still stored.
  if (!isPlausibleEmail(email)) {
    console.log('[auto-svar] submission without a usable e-mail, skipping');
    return new Response('skipped', { status: 200 });
  }

  const summary = buildSummary(data);

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: 'Vi har mottatt forespørselen din – Sirdal Renhold AS',
        text: plainText(name, summary),
      }),
    });

    if (!res.ok) {
      // Log the status but not the body — provider errors can echo the key.
      console.error('[auto-svar] provider returned', res.status);
      return new Response('send failed', { status: 502 });
    }
  } catch (err) {
    console.error('[auto-svar] send threw', err);
    return new Response('send failed', { status: 502 });
  }

  return new Response('ok', { status: 200 });
};

// Deliberately loose. Strict e-mail regexes reject valid addresses; the
// real check is whether the provider accepts it.
function isPlausibleEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Echoes back what the customer chose in the wizard, so the confirmation
// is a record of the enquiry rather than a bare receipt. Only fields the
// forms actually send are listed; anything else is ignored.
function buildSummary(data) {
  const lines = [];
  const add = (label, value) => {
    const v = String(value ?? '').trim();
    if (v) lines.push(`${label}: ${v}`);
  };

  add('Tjeneste', data.tjeneste);
  add('Areal', data.areal ? `${data.areal} m²` : '');
  add('Vindusvask', data.vindusvask);
  add('Tillegg', data.tillegg);
  add('Prisanslag', data.anslag);
  add('Melding', data.message);

  return lines;
}

function plainText(name, summary) {
  const greeting = name ? `Hei ${name},` : 'Hei,';

  const block = summary.length
    ? `\n\nDette er hva vi har registrert:\n\n${summary.join('\n')}\n`
    : '\n';

  return `${greeting}

takk for forespørselen din. Vi har mottatt den og tar kontakt så snart som mulig, vanligvis innen én virkedag.${block}
Et prisanslag fra prisberegneren er veiledende og ikke et bindende tilbud. Endelig pris bekreftes etter befaring.

Haster det, er du velkommen til å ringe oss på 462 15 212.

Med vennlig hilsen
Sirdal Renhold AS
org.nr 934 822 706
https://sirdalrenhold.no
`;
}
