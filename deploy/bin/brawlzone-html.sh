#!/usr/bin/env bash
# Shared HTML email chrome. Sourced, not executed.
#
# Tables and inline styles only: email clients strip <style> blocks, and
# flexbox/grid are unreliable across Gmail, Outlook and Apple Mail. No external
# images or fonts -- most clients block them by default, and the box should not
# depend on anything it cannot serve itself.
BG=#f1f5f9; CARD=#ffffff; INK=#0f172a; MUTED=#64748b; LINE=#e2e8f0
OK=#16a34a; BAD=#dc2626; WARN=#d97706; ACCENT=#4f46e5

esc() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

html_open() { # title, subtitle, accent-colour
  cat <<EOF
<!doctype html><html><body style="margin:0;padding:0;background:$BG;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:$BG;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:$CARD;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;border:1px solid $LINE;">
  <tr><td style="background:$3;padding:20px 24px;">
    <div style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">$1</div>
    <div style="color:rgba(255,255,255,.82);font-size:13px;margin-top:4px;">$2</div>
  </td></tr>
EOF
}

html_section() { # heading
  cat <<EOF
  <tr><td style="padding:20px 24px 8px 24px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:$MUTED;">$1</div>
  </td></tr>
EOF
}

html_rows_open() { printf '  <tr><td style="padding:0 24px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="font-size:14px;color:%s;">\n' "$INK"; }
html_row() { # label, value, colour
  printf '    <tr><td style="padding:7px 0;border-bottom:1px solid %s;color:%s;">%s</td><td align="right" style="padding:7px 0;border-bottom:1px solid %s;color:%s;font-weight:600;">%s</td></tr>\n' \
    "$LINE" "$MUTED" "$1" "$LINE" "${3:-$INK}" "$2"
}
html_rows_close() { printf '  </table></td></tr>\n'; }

html_pre() { # preformatted block from stdin
  printf '  <tr><td style="padding:8px 24px 4px 24px;"><pre style="margin:0;padding:12px;background:#0b1220;color:#cbd5e1;border-radius:8px;font-size:12px;line-height:1.5;overflow-x:auto;white-space:pre-wrap;word-break:break-word;">'
  esc
  printf '</pre></td></tr>\n'
}

html_close() { # footer note
  cat <<EOF
  <tr><td style="padding:18px 24px 22px 24px;">
    <div style="font-size:12px;color:$MUTED;border-top:1px solid $LINE;padding-top:14px;">$1</div>
  </td></tr>
</table>
</td></tr></table></body></html>
EOF
}
