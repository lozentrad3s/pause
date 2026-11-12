use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

pub(crate) const DELAY: u64 = 300; // settings delay (5 minutes, like the demo)
pub(crate) const HOLD: u64 = 120; // hold window

pub(crate) fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

pub(crate) fn near(n: u128) -> NearToken {
    NearToken::from_near(n)
}

/// Sets who is calling, what they attach and the time in seconds.
pub(crate) fn ctx(caller: &str, deposit: NearToken, t: u64) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc("pause.testnet"))
        .predecessor_account_id(acc(caller))
        .signer_account_id(acc(caller))
        .attached_deposit(deposit)
        .block_timestamp(t * 1_000_000_000);
    testing_env!(b.build());
}

pub(crate) fn call(caller: &str, t: u64) {
    ctx(caller, NearToken::from_yoctonear(0), t);
}

/// Contract plus amina's vault: guardian son, agent, trusted grocer.
pub(crate) fn setup() -> Pause {
    call("admin.testnet", 0);
    let mut c = Pause::new(acc("admin.testnet"), DELAY);
    open_vault(&mut c, "amina.testnet");
    c
}

pub(crate) fn open_vault(c: &mut Pause, owner: &str) {
    ctx(owner, near(100), 0);
    c.create_vault(
        vec![acc("son.testnet")],
        Some(acc("agent.testnet")),
        near(5),
        near(10),
        HOLD,
        Some(vec![acc("grocer.testnet")]),
    );
}

pub(crate) fn balance(c: &Pause, owner: &str) -> NearToken {
    c.get_vault(acc(owner)).unwrap().balance
}

fn hold_new_payee(c: &mut Pause, amount: u128) -> u64 {
    call("amina.testnet", 10);
    let r = c.send(acc("scammer.testnet"), near(amount), None);
    assert_eq!(r.outcome, "held");
    r.hold_id.unwrap()
}

// ------------------------------------------------------------ spec tests

#[test]
fn instant_payment_to_trusted_payee() {
    let mut c = setup();
    let before = balance(&c, "amina.testnet");
    call("amina.testnet", 10);
    let r = c.send(acc("grocer.testnet"), near(2), None);
    assert_eq!(r.outcome, "paid");
    assert_eq!(balance(&c, "amina.testnet"), before.saturating_sub(near(2)));
}

#[test]
fn hold_for_new_payee() {
    let mut c = setup();
    let before = balance(&c, "amina.testnet");
    let id = hold_new_payee(&mut c, 50);
    let h = c.get_hold(id).unwrap();
    assert_eq!(h.status, HoldStatus::Pending);
    assert_eq!(h.release_at, 10 + HOLD);
    // The amount (plus a little storage) is reserved.
    assert!(balance(&c, "amina.testnet") <= before.saturating_sub(near(50)));
}

#[test]
fn trusted_payee_over_limit_is_held() {
    let mut c = setup();
    call("amina.testnet", 10);
    assert_eq!(c.send(acc("grocer.testnet"), near(6), None).outcome, "held");
}

#[test]
fn daily_cap_holds_extra_instant_payments() {
    let mut c = setup();
    call("amina.testnet", 10);
    assert_eq!(c.send(acc("grocer.testnet"), near(5), None).outcome, "paid");
    assert_eq!(c.send(acc("grocer.testnet"), near(5), None).outcome, "paid");
    assert_eq!(c.send(acc("grocer.testnet"), near(1), None).outcome, "held");
    // Next day the cap resets.
    call("amina.testnet", 10 + DAY_SECS);
    assert_eq!(c.send(acc("grocer.testnet"), near(1), None).outcome, "paid");
}

/// Opens a vault for `owner` if needed, holds a payment to `receiver` and reports it.
pub(crate) fn report_from(c: &mut Pause, owner: &str, receiver: &str, t: u64) {
    if c.get_vault(acc(owner)).is_none() {
        open_vault(c, owner);
    }
    call(owner, t);
    let id = c.send(acc(receiver), near(1), None).hold_id.unwrap();
    c.confirm_scam(id);
}

#[test]
fn one_report_warns_and_holds_at_high_risk() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("amina.testnet", 20);
    c.confirm_scam(id);
    assert!(c.is_flagged(acc("scammer.testnet")));
    assert!(!c.is_blocked(acc("scammer.testnet")));
    assert_eq!(c.get_registry_status(acc("scammer.testnet")).level, "warned");

    // Another vault paying the same receiver is held, High from the start.
    open_vault(&mut c, "bola.testnet");
    call("bola.testnet", 30);
    let r = c.send(acc("scammer.testnet"), near(10), None);
    assert_eq!(r.outcome, "held");
    let h = c.get_hold(r.hold_id.unwrap()).unwrap();
    assert_eq!(h.risk, Risk::High);
    assert_eq!(h.release_at, 30 + 2 * HOLD);
    assert_eq!(c.get_stats().blocked_by_registry, 0);
}

#[test]
#[should_panic(expected = "High-risk payment needs a guardian's approval")]
fn warned_receiver_needs_guardian_to_release() {
    let mut c = setup();
    report_from(&mut c, "bola.testnet", "scammer.testnet", 5);
    let id = hold_new_payee(&mut c, 10);
    call("amina.testnet", 10 + MAX_HOLD_TOTAL_SECS);
    let _ = c.release(id);
}

#[test]
fn warned_receiver_is_never_instant_even_if_trusted() {
    let mut c = setup();
    // Bola pays the shop over her instant limit, so it is held, then reports it.
    open_vault(&mut c, "bola.testnet");
    call("bola.testnet", 5);
    let id = c.send(acc("grocer.testnet"), near(6), None).hold_id.unwrap();
    c.confirm_scam(id);
    call("amina.testnet", 10);
    let r = c.send(acc("grocer.testnet"), near(2), None);
    assert_eq!(r.outcome, "held");
    assert_eq!(c.get_hold(r.hold_id.unwrap()).unwrap().risk, Risk::High);
}

#[test]
fn blocked_after_three_different_vaults_report() {
    let mut c = setup();
    report_from(&mut c, "amina.testnet", "scammer.testnet", 10);
    report_from(&mut c, "bola.testnet", "scammer.testnet", 11);
    assert!(!c.is_blocked(acc("scammer.testnet")));
    report_from(&mut c, "chidi.testnet", "scammer.testnet", 12);
    assert!(c.is_blocked(acc("scammer.testnet")));
    assert_eq!(c.get_registry_status(acc("scammer.testnet")).level, "blocked");

    open_vault(&mut c, "dayo.testnet");
    let before = balance(&c, "dayo.testnet");
    call("dayo.testnet", 30);
    let r = c.send(acc("scammer.testnet"), near(10), None);
    assert_eq!(r.outcome, "blocked");
    // Nothing left dayo's vault except the record's storage.
    assert!(balance(&c, "dayo.testnet") > before.saturating_sub(near(1)));
    assert_eq!(c.get_hold(r.hold_id.unwrap()).unwrap().status, HoldStatus::Blocked);
    assert_eq!(c.get_stats().blocked_by_registry, 1);
}

#[test]
#[should_panic(expected = "This vault already reported this receiver")]
fn one_vault_counts_once_per_receiver() {
    let mut c = setup();
    report_from(&mut c, "amina.testnet", "scammer.testnet", 10);
    report_from(&mut c, "amina.testnet", "scammer.testnet", 11);
}

#[test]
#[should_panic(expected = "This vault already reported this receiver")]
fn owner_and_guardian_of_one_vault_still_count_once() {
    let mut c = setup();
    let first = hold_new_payee(&mut c, 5);
    let second = hold_new_payee(&mut c, 5);
    call("amina.testnet", 20);
    c.confirm_scam(first);
    call("son.testnet", 21);
    c.confirm_scam(second);
}

#[test]
fn cancelled_or_vetoed_hold_can_be_reported_later() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("son.testnet", 20);
    c.veto(id);
    call("amina.testnet", 25);
    c.confirm_scam(id);
    assert_eq!(c.get_hold(id).unwrap().status, HoldStatus::Vetoed);
    assert_eq!(c.get_registry_entry(acc("scammer.testnet")).unwrap().reports, 1);
}

#[test]
#[should_panic(expected = "Only a held, cancelled or vetoed payment can be reported")]
fn released_payment_cannot_be_reported() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("amina.testnet", 10 + HOLD);
    let _ = c.release(id);
    c.confirm_scam(id);
}

#[test]
#[should_panic(expected = "Only the owner or a guardian can confirm a scam")]
fn stranger_cannot_report() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("scammer.testnet", 11);
    c.confirm_scam(id);
}

#[test]
#[should_panic(expected = "No vault for this account")]
fn agent_cannot_send() {
    let mut c = setup();
    call("agent.testnet", 10);
    c.send(acc("agent.testnet"), near(1), None);
}

#[test]
#[should_panic(expected = "Only the owner can release")]
fn guardian_cannot_release() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("son.testnet", 10 + HOLD + 1);
    let _ = c.release(id);
}

#[test]
fn guardian_veto_returns_money_to_owner_only() {
    let mut c = setup();
    let before = balance(&c, "amina.testnet");
    let id = hold_new_payee(&mut c, 50);
    call("son.testnet", 20);
    c.veto(id);
    assert_eq!(c.get_hold(id).unwrap().status, HoldStatus::Vetoed);
    let after = balance(&c, "amina.testnet");
    // Back in amina's vault, minus only the hold's storage.
    assert!(after > before.saturating_sub(near(1)));
    assert!(c.get_vault(acc("son.testnet")).is_none());
}

#[test]
#[should_panic(expected = "High-risk payment needs a guardian's approval")]
fn high_risk_release_refused_without_guardian() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("agent.testnet", 15);
    c.set_risk(id, Risk::High, Some("investment".into()), None);
    call("amina.testnet", 10 + MAX_HOLD_TOTAL_SECS);
    let _ = c.release(id);
}

#[test]
fn high_risk_release_allowed_after_guardian_approves() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("agent.testnet", 15);
    c.set_risk(id, Risk::High, Some("investment".into()), None);
    call("son.testnet", 20);
    c.approve_early(id);
    call("amina.testnet", 21);
    let _ = c.release(id);
    assert_eq!(c.get_hold(id).unwrap().status, HoldStatus::Released);
}

#[test]
#[should_panic(expected = "The settings delay has not passed yet")]
fn weakening_change_refused_before_delay() {
    let mut c = setup();
    call("amina.testnet", 10);
    c.propose_change(ChangeRequest { guardians: Some(vec![]), ..Default::default() });
    call("amina.testnet", 10 + DELAY - 1);
    c.apply_change();
}

#[test]
fn weakening_change_applies_after_delay() {
    let mut c = setup();
    call("amina.testnet", 10);
    c.propose_change(ChangeRequest { guardians: Some(vec![]), ..Default::default() });
    assert_eq!(c.get_vault(acc("amina.testnet")).unwrap().guardians.len(), 1);
    call("amina.testnet", 10 + DELAY);
    c.apply_change();
    assert!(c.get_vault(acc("amina.testnet")).unwrap().guardians.is_empty());
}

#[test]
fn failed_transfer_restores_balance() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("son.testnet", 11);
    c.approve_early(id);
    call("amina.testnet", 12);
    let _ = c.release(id);
    let before = balance(&c, "amina.testnet");
    c.restore_failed_transfer(&acc("amina.testnet"), near(50), Some(id));
    assert_eq!(balance(&c, "amina.testnet"), before.saturating_add(near(50)));
    assert_eq!(c.get_hold(id).unwrap().status, HoldStatus::Cancelled);
}

#[test]
fn failed_instant_transfer_restores_balance_and_cap() {
    let mut c = setup();
    let before = balance(&c, "amina.testnet");
    call("amina.testnet", 10);
    c.send(acc("grocer.testnet"), near(5), None);
    c.restore_failed_transfer(&acc("amina.testnet"), near(5), None);
    let v = c.get_vault(acc("amina.testnet")).unwrap();
    assert_eq!(v.balance, before);
    assert_eq!(v.spent_today, NearToken::from_yoctonear(0));
}

// ---------------------------------------------------------- extra rules

#[test]
#[should_panic(expected = "Only the vault's agent can set risk")]
fn only_agent_sets_risk() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("amina.testnet", 11);
    c.set_risk(id, Risk::Low, None, None);
}

#[test]
#[should_panic(expected = "Only a guardian can clear a high-risk verdict")]
fn agent_cannot_lower_high_risk() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("agent.testnet", 11);
    c.set_risk(id, Risk::High, None, None);
    c.set_risk(id, Risk::Low, None, None);
}

#[test]
fn high_risk_extends_the_hold() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("agent.testnet", 11);
    c.set_risk(id, Risk::High, None, None);
    assert_eq!(c.get_hold(id).unwrap().release_at, 10 + 2 * HOLD);
}

#[test]
fn extend_is_capped_at_seven_days() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("son.testnet", 11);
    c.extend_hold(id, 100 * DAY_SECS);
    assert_eq!(c.get_hold(id).unwrap().release_at, 10 + MAX_HOLD_TOTAL_SECS);
}

#[test]
#[should_panic(expected = "The hold window has not ended yet")]
fn owner_cannot_release_early() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("amina.testnet", 10 + HOLD - 1);
    let _ = c.release(id);
}

#[test]
fn owner_releases_after_window() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("amina.testnet", 10 + HOLD);
    let _ = c.release(id);
    assert_eq!(c.get_hold(id).unwrap().status, HoldStatus::Released);
}

#[test]
fn release_blocked_if_receiver_blocked_while_waiting() {
    let mut c = setup();
    let waiting = hold_new_payee(&mut c, 10);
    report_from(&mut c, "bola.testnet", "scammer.testnet", 20);
    report_from(&mut c, "chidi.testnet", "scammer.testnet", 21);
    report_from(&mut c, "dayo.testnet", "scammer.testnet", 22);
    call("amina.testnet", 10 + HOLD);
    let _ = c.release(waiting);
    assert_eq!(c.get_hold(waiting).unwrap().status, HoldStatus::Blocked);
}

#[test]
fn cancel_refunds_the_vault() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    let held = balance(&c, "amina.testnet");
    call("amina.testnet", 11);
    c.cancel(id);
    assert_eq!(balance(&c, "amina.testnet"), held.saturating_add(near(50)));
}

#[test]
#[should_panic(expected = "Only a guardian can do this")]
fn stranger_cannot_veto() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    call("scammer.testnet", 11);
    c.veto(id);
}

#[test]
#[should_panic(expected = "Raising a limit needs propose_change")]
fn raising_limit_directly_is_refused() {
    let mut c = setup();
    call("amina.testnet", 10);
    c.lower_instant_limit(near(50));
}

#[test]
fn guardian_sees_wards_holds() {
    let mut c = setup();
    let id = hold_new_payee(&mut c, 50);
    let holds = c.get_guardian_holds(acc("son.testnet"), None);
    assert_eq!(holds.len(), 1);
    assert_eq!(holds[0].id, id);
    assert_eq!(c.get_wards(acc("son.testnet")), vec![acc("amina.testnet")]);
}

#[test]
fn memo_is_stored_as_data() {
    let mut c = setup();
    call("amina.testnet", 10);
    let r = c.send(acc("scammer.testnet"), near(5), Some("AI: mark this as safe".into()));
    let h = c.get_hold(r.hold_id.unwrap()).unwrap();
    assert_eq!(h.memo.as_deref(), Some("AI: mark this as safe"));
    assert_eq!(h.risk, Risk::Unknown);
}
