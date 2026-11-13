#!/usr/bin/env bash
# One-time testnet setup for Pause Groups. Creates the pot agent (with a key
# limited to propose_line and pay_line), four demo members, three vendors and
# drinks-plug, then has three different vaults report drinks-plug so it is
# hard-blocked in the scam registry. Keys go into .env, never to the terminal.
set -u
P=${PARENT:-pause-demo.testnet}
C=${PAUSE_CONTRACT:-pause.pause-demo.testnet}
ENV=${ENV_FILE:-.env}
TMP=$(mktemp)

setenv() { # name value
  grep -v "^$1=" "$ENV" > "$ENV.tmp" 2>/dev/null; mv "$ENV.tmp" "$ENV"; echo "$1=$2" >> "$ENV"
}

secret_from() { grep "SECRET KEYPAIR" "$1" | grep -oE 'ed25519:[1-9A-Za-z]+' | head -1; }

new_account() { # prefix amount envname
  local id="$1.$P"
  if near account view-account-summary "$id" network-config testnet now >/dev/null 2>&1; then
    echo "exists  $id"; return
  fi
  near account create-account fund-myself "$id" "$2 NEAR" autogenerate-new-keypair print-to-terminal \
    sign-as "$P" network-config testnet sign-with-legacy-keychain send > "$TMP" 2>&1
  local k; k=$(secret_from "$TMP")
  if [ -n "$k" ]; then echo "created $id"; [ -n "${3:-}" ] && setenv "$3" "$k"; else echo "FAILED  $id"; grep -iE "error" "$TMP" | head -3; fi
}

new_account potagent 0.5
new_account ada 1.2 GROUP_KEY_ADA
new_account tunde 1.2 GROUP_KEY_TUNDE
new_account musa 1.2 GROUP_KEY_MUSA
new_account chi 1.2 GROUP_KEY_CHI
new_account hall-owner 0.1 VENDOR_KEY_HALL
new_account mama-nkechi 0.1 VENDOR_KEY_MAMA
new_account cool-drinks 0.1 VENDOR_KEY_DRINKS
new_account drinks-plug 0.1

# The pot agent signs with a key that can call only propose_line and pay_line.
near account add-key "potagent.$P" grant-function-call-access --allowance '0.5 NEAR' \
  --contract-account-id "$C" --function-names 'propose_line, pay_line' \
  autogenerate-new-keypair print-to-terminal network-config testnet sign-with-legacy-keychain send > "$TMP" 2>&1
K=$(secret_from "$TMP")
if [ -n "$K" ]; then setenv POT_AGENT_ACCOUNT "potagent.$P"; setenv POT_AGENT_KEY "$K"; echo "pot agent key limited to propose_line, pay_line"; else echo "FAILED pot agent key"; fi
rm -f "$TMP"
echo "done"
