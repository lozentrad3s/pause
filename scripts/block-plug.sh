#!/usr/bin/env bash
# Three different vaults report drinks-plug, so the registry hard-blocks it.
set -u
P=pause-demo.testnet; C=pause.pause-demo.testnet; PLUG=drinks-plug.$P
TUNDE=$(grep ^GROUP_KEY_TUNDE= .env | cut -d= -f2)

signer() { # account -> signing args
  if [ "$1" = "tunde.$P" ]; then echo "sign-with-plaintext-private-key $TUNDE"; else echo "sign-with-legacy-keychain"; fi
}
call() { # account method json deposit
  near contract call-function as-transaction $C "$2" json-args "$3" prepaid-gas '60 Tgas' attached-deposit "${4:-0 NEAR}" \
    sign-as "$1" network-config testnet $(signer "$1") send 2>&1
}

# Tunde needs a vault of his own.
call tunde.$P create_vault '{"guardians":["chi.'$P'"],"agent":"agent.'$P'","instant_limit":"10000000000000000000000","daily_instant_cap":"10000000000000000000000","hold_secs":120,"trusted_payees":[]}' '0.3 NEAR' | grep -oE '"event":"[a-z_]+"|panicked[^"]*' | head -1

for owner in amina.$P bola.$P tunde.$P; do
  out=$(call $owner send '{"receiver":"'$PLUG'","amount":"20000000000000000000000","memo":"drinks deposit"}')
  id=$(echo "$out" | grep -oE '"hold_id":[0-9]+' | head -1 | cut -d: -f2)
  if [ -z "$id" ]; then echo "$owner: no hold ($(echo "$out" | grep -oE 'panicked[^"]*|"outcome": "[a-z]+"' | head -1))"; continue; fi
  echo "$owner: hold $id -> $(call $owner confirm_scam '{"hold_id":'$id'}' | grep -oE '"level":"[a-z]+"|panicked[^"]*' | head -1)"
done
near contract call-function as-read-only $C get_registry_status json-args '{"receiver":"'$PLUG'"}' network-config testnet now 2>&1 | grep -E '"level"|"reports"'
