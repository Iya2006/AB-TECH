import nodemailer from 'nodemailer'
import type { Env } from './env'

export interface Mail {
  to: string
  subject: string
  text: string
  html: string
}

export interface Mailer {
  enabled: boolean
  /** Vrai si l'e-mail est parti. Sans SMTP : rien n'est envoyé (en développement, le message s'affiche dans la console). */
  send(mail: Mail): Promise<boolean>
}

export function createMailer(env: Env): Mailer {
  if (!env.SMTP_URL) {
    return {
      enabled: false,
      async send(mail) {
        if (env.NODE_ENV !== 'production') console.info(`\n[e-mail non envoyé : SMTP_URL absent] À ${mail.to} — ${mail.subject}\n${mail.text}\n`)
        return false
      },
    }
  }
  const transport = nodemailer.createTransport(env.SMTP_URL)
  const from = env.MAIL_FROM ?? decodeURIComponent(new URL(env.SMTP_URL).username)
  return {
    enabled: true,
    async send(mail) {
      await transport.sendMail({ from, ...mail })
      return true
    },
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** E-mail de réinitialisation : un bouton, la durée de validité, et rien d'autre (jamais de mot de passe). */
export function resetMail({ to, name, brand, url, minutes }: { to: string; name: string; brand: string; url: string; minutes: number }): Mail {
  const hello = name ? `Bonjour ${name.split(' ')[0]},` : 'Bonjour,'
  const validity = minutes >= 120 ? `${Math.round(minutes / 60)} heures` : `${minutes} minutes`
  const text = [
    hello,
    '',
    `Vous avez demandé à réinitialiser le mot de passe de votre compte ${brand}.`,
    `Ouvrez ce lien pour en choisir un nouveau (valable ${validity}, une seule fois) :`,
    url,
    '',
    'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.',
    '',
    brand,
  ].join('\n')
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f7fb;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0b1020">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:#0a1124;padding:22px 28px;color:#ffffff;font-weight:800;font-size:18px;letter-spacing:-0.02em">${escape(brand)}</td></tr>
<tr><td style="padding:32px 28px 8px;font-size:15px;line-height:1.6">
<p style="margin:0 0 14px">${escape(hello)}</p>
<p style="margin:0 0 22px">Vous avez demandé à réinitialiser le mot de passe de votre compte. Ce lien est valable <strong>${validity}</strong> et ne fonctionne qu’une seule fois.</p>
<p style="margin:0 0 26px"><a href="${escape(url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px">Choisir un nouveau mot de passe</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#5b6478">Si le bouton ne s’ouvre pas, copiez cette adresse dans votre navigateur :<br><span style="word-break:break-all;color:#2563eb">${escape(url)}</span></p>
</td></tr>
<tr><td style="padding:18px 28px 28px;font-size:12.5px;color:#7a8396">Vous n’êtes pas à l’origine de cette demande ? Ignorez cet e-mail : votre mot de passe reste inchangé.</td></tr>
</table></td></tr></table></body></html>`
  return { to, subject: `${brand} · Réinitialisation de votre mot de passe`, text, html }
}
