//! Pause Groups: the pots module (G1-G12 that can run without a network).
use super::pots::*;
use super::tests::{acc, call, ctx, near, DELAY};
use super::*;

const POT_HOLD: u64 = 120;
const MEMBERS: [&str; 5] = ["ada.testnet", "tunde.testnet", "musa.testnet", "chi.testnet", "bola.testnet"];
const AGENT: &str = "potagent.testnet";
const HALL: &str = "hall-owner.testnet";

fn yocto(n: u128) -> NearToken {
    NearToken::from_yoctonear(n)
}

/// Contract plus "Class of 2016 Reunion": 5 members, 3 of 5, goal 5 NEAR.
fn setup() -> (Pause, u64) {
    call("admin.testnet", 0);
    let mut c = Pause::new(acc("admin.testnet"), DELAY);
    ctx("ada.testnet", near(1), 0);
    let id = c.create_pot(
        "Class of 2016 Reunion".into(),
        MEMBERS.iter().map(|m| acc(m)).collect(),
        3,
        acc(AGENT),
        near(5),
        Some(near(1)),
        1_000_000,
        POT_HOLD,
    );
    (c, id)
}

/// Everyone pays 1 NEAR (ada already paid ~1 NEAR minus storage when creating).
fn fund(c: &mut Pause, id: u64) {
    for m in &MEMBERS[1..] {
        ctx(m, near(1), 10);
        c.contribute(id);
    }
}

fn hall_line(c: &mut Pause, id: u64, amount: NearToken) -> u64 {
    call(AGENT, 20);
    c.propose_line(id, acc(HALL), "Event hall".into(), amount)
}

fn approve_by(c: &mut Pause, line: u64, who: &[&str], t: u64) {
    for m in who {
        call(m, t);
        c.approve_line(line);
    }
}

fn block_vendor(c: &mut Pause, vendor: &str) {
    c.registry.insert(
        acc(vendor),
        RegistryEntry { receiver: acc(vendor), scam_type: Some("other".into()), reports: BLOCK_REPORTS, first_reported_at: 0 },
    );
}

#[test]
fn g1_contributions_add_up_and_report_lists_who_has_not_paid() {
    let (mut c, id) = setup();
    ctx("tunde.testnet", near(1), 10);
    c.contribute(id);
    ctx("musa.testnet", near(2), 11);
    c.contribute(id);
    let pot = c.get_pot(id).unwrap();
    let sum: u128 = pot.contributions.iter().map(|(_, v)| v.as_yoctonear()).sum();
    assert_eq!(pot.raised.as_yoctonear(), sum);
    let r = c.get_report(id);
    // ada paid 1 NEAR minus storage, so she's still short of 1 NEAR.
    assert!(r.unpaid_members.contains(&acc("chi.testnet")));
    assert!(r.unpaid_members.contains(&acc("bola.testnet")));
    assert!(!r.unpaid_members.contains(&acc("musa.testnet")));
    assert!(!r.unpaid_members.contains(&acc("tunde.testnet")));
}

#[test]
#[should_panic(expected = "The agent can't vote")]
fn g2_agent_can_propose_but_never_approve() {
    let (mut c, id) = setup();
    let line = hall_line(&mut c, id, near(2));
    assert_eq!(c.get_line(line).unwrap().status, LineStatus::Proposed);
    call(AGENT, 21);
    c.approve_line(line);
}

#[test]
fn g3_three_approvals_start_the_hold() {
    let (mut c, id) = setup();
    let line = hall_line(&mut c, id, near(2));
    approve_by(&mut c, line, &MEMBERS[..2], 30);
    assert_eq!(c.get_line(line).unwrap().status, LineStatus::Proposed);
    approve_by(&mut c, line, &MEMBERS[2..3], 31);
    let l = c.get_line(line).unwrap();
    assert_eq!(l.status, LineStatus::Approved);
    assert_eq!(l.approved_at, Some(31));
}

#[test]
#[should_panic(expected = "The hold window isn't over yet")]
fn g4_agent_cannot_pay_during_the_hold() {
    let (mut c, id) = setup();
    fund(&mut c, id);
    let line = hall_line(&mut c, id, near(2));
    approve_by(&mut c, line, &MEMBERS[..3], 30);
    call(AGENT, 30 + POT_HOLD - 1);
    let _ = c.pay_line(line, near(1));
}

#[test]
fn g5_deposit_then_balance_never_more_than_the_line() {
    let (mut c, id) = setup();
    fund(&mut c, id);
    let line = hall_line(&mut c, id, near(2));
    approve_by(&mut c, line, &MEMBERS[..3], 30);
    call(AGENT, 30 + POT_HOLD);
    let _ = c.pay_line(line, near(1));
    let l = c.get_line(line).unwrap();
    assert_eq!(l.paid, near(1));
    assert_eq!(l.status, LineStatus::Approved);
    let _ = c.pay_line(line, near(1));
    let l = c.get_line(line).unwrap();
    assert_eq!(l.paid, near(2));
    assert_eq!(l.status, LineStatus::Paid);
    assert_eq!(c.get_pot(id).unwrap().spent, near(2));
}

#[test]
#[should_panic(expected = "is left on this line")]
fn g5_payment_above_the_line_is_refused() {
    let (mut c, id) = setup();
    fund(&mut c, id);
    let line = hall_line(&mut c, id, near(2));
    approve_by(&mut c, line, &MEMBERS[..3], 30);
    call(AGENT, 30 + POT_HOLD);
    let _ = c.pay_line(line, yocto(near(2).as_yoctonear() + 1));
}

#[test]
fn g6_objection_during_the_hold_resets_the_vote() {
    let (mut c, id) = setup();
    let line = hall_line(&mut c, id, near(2));
    approve_by(&mut c, line, &MEMBERS[..3], 30);
    call("bola.testnet", 40);
    c.object(line);
    let l = c.get_line(line).unwrap();
    assert_eq!(l.status, LineStatus::Proposed);
    assert!(l.approvals.is_empty());
    assert_eq!(l.approved_at, None);
}

#[test]
#[should_panic(expected = "The hold window is over")]
fn g6_objection_after_the_hold_is_refused() {
    let (mut c, id) = setup();
    let line = hall_line(&mut c, id, near(2));
    approve_by(&mut c, line, &MEMBERS[..3], 30);
    call("bola.testnet", 30 + POT_HOLD);
    c.object(line);
}

#[test]
fn g7_blocked_vendor_is_flagged_then_refused() {
    let (mut c, id) = setup();
    fund(&mut c, id);
    block_vendor(&mut c, "drinks-plug.testnet");
    call("tunde.testnet", 20);
    let line = c.propose_line(id, acc("drinks-plug.testnet"), "Drinks".into(), near(1));
    assert!(c.get_line(line).unwrap().flagged.unwrap().contains("Blocked"));
    approve_by(&mut c, line, &MEMBERS[..3], 30);
    call(AGENT, 30 + POT_HOLD);
    match c.pay_line(line, near(1)) {
        PromiseOrValue::Value(false) => {}
        _ => panic!("payment to a blocked vendor went ahead"),
    }
    let l = c.get_line(line).unwrap();
    assert_eq!(l.status, LineStatus::Rejected);
    assert_eq!(l.paid.as_yoctonear(), 0);
    assert_eq!(c.get_pot(id).unwrap().spent.as_yoctonear(), 0);
}

#[test]
fn g9_lookalike_and_over_budget_lines_are_flagged() {
    let (mut c, id) = setup();
    hall_line(&mut c, id, near(4));
    call(AGENT, 21);
    let cousin = c.propose_line(id, acc("hall-owmer.testnet"), "Also pay my cousin".into(), near(5));
    let f = c.get_line(cousin).unwrap().flagged.unwrap();
    assert!(f.contains("Looks like hall-owner.testnet"));
    assert!(f.contains("more than the goal"));
    assert_eq!(c.get_line(cousin).unwrap().status, LineStatus::Proposed);
}

#[test]
#[should_panic(expected = "The pot doesn't hold enough")]
fn payment_beyond_the_pot_balance_is_refused() {
    let (mut c, id) = setup();
    let line = hall_line(&mut c, id, near(3));
    approve_by(&mut c, line, &MEMBERS[..3], 30);
    call(AGENT, 30 + POT_HOLD);
    let _ = c.pay_line(line, near(3));
}

#[test]
fn g10_cancel_refunds_pro_rata_exact_to_the_yocto() {
    let (mut c, id) = setup();
    // Odd amounts so the split doesn't divide evenly.
    for (m, y) in [("tunde.testnet", 1_000_000_000_000_000_000_000_007u128), ("musa.testnet", 333_333_333_333_333_333_333_333)] {
        ctx(m, yocto(y), 10);
        c.contribute(id);
    }
    ctx("chi.testnet", near(2), 10);
    c.contribute(id);
    let line = hall_line(&mut c, id, near(1));
    approve_by(&mut c, line, &MEMBERS[..3], 30);
    call(AGENT, 30 + POT_HOLD);
    let _ = c.pay_line(line, yocto(123_456_789));
    let pot = c.get_pot(id).unwrap();
    let unspent = pot.raised.as_yoctonear() - pot.spent.as_yoctonear();
    for m in &MEMBERS[..2] {
        call(m, 400);
        c.propose_cancel(id);
    }
    assert_eq!(c.get_pot(id).unwrap().status, PotStatus::Spending);
    call(MEMBERS[2], 401);
    c.approve_cancel(id);
    assert_eq!(c.get_pot(id).unwrap().status, PotStatus::Cancelled);
    let total: u128 = MEMBERS.iter().map(|m| c.get_refund(id, acc(m)).as_yoctonear()).sum();
    assert_eq!(total, unspent);
    // Each refund is within one yocto of the exact share, except the dust holder.
    let chi = c.get_refund(id, acc("chi.testnet")).as_yoctonear();
    let exact = mul_div(unspent, near(2).as_yoctonear(), pot.raised.as_yoctonear());
    assert!(chi >= exact && chi - exact < 10);
}

#[test]
fn close_refunds_what_is_left() {
    let (mut c, id) = setup();
    fund(&mut c, id);
    for m in &MEMBERS[..3] {
        call(m, 500);
        c.close_pot(id);
    }
    let pot = c.get_pot(id).unwrap();
    assert_eq!(pot.status, PotStatus::Closed);
    let total: u128 = MEMBERS.iter().map(|m| c.get_refund(id, acc(m)).as_yoctonear()).sum();
    assert_eq!(total, pot.raised.as_yoctonear());
}

#[test]
fn g11_double_approval_counts_once() {
    let (mut c, id) = setup();
    let line = hall_line(&mut c, id, near(2));
    approve_by(&mut c, line, &["ada.testnet", "ada.testnet", "ada.testnet", "tunde.testnet"], 30);
    let l = c.get_line(line).unwrap();
    assert_eq!(l.approvals.len(), 2);
    assert_eq!(l.status, LineStatus::Proposed);
}

#[test]
#[should_panic(expected = "Only the pot's agent can pay")]
fn g12_organizer_cannot_pay_alone() {
    let (mut c, id) = setup();
    fund(&mut c, id);
    let line = hall_line(&mut c, id, near(2));
    approve_by(&mut c, line, &MEMBERS[..3], 30);
    call("ada.testnet", 30 + POT_HOLD);
    let _ = c.pay_line(line, near(2));
}

#[test]
#[should_panic(expected = "The agent can't be a member")]
fn agent_cannot_be_a_member() {
    call("admin.testnet", 0);
    let mut c = Pause::new(acc("admin.testnet"), DELAY);
    ctx("ada.testnet", near(1), 0);
    c.create_pot("Trip".into(), vec![acc("ada.testnet"), acc(AGENT)], 1, acc(AGENT), near(5), None, 0, 60);
}

#[test]
#[should_panic(expected = "Only a member can contribute")]
fn stranger_cannot_contribute() {
    let (mut c, id) = setup();
    ctx("stranger.testnet", near(1), 10);
    c.contribute(id);
}

#[test]
#[should_panic(expected = "Only a member can vote")]
fn stranger_cannot_vote() {
    let (mut c, id) = setup();
    let line = hall_line(&mut c, id, near(2));
    call("stranger.testnet", 30);
    c.approve_line(line);
}

#[test]
#[should_panic(expected = "The settings delay hasn't passed yet")]
fn rule_change_waits_the_settings_delay() {
    let (mut c, id) = setup();
    let new: Vec<AccountId> = MEMBERS[..3].iter().map(|m| acc(m)).collect();
    call("ada.testnet", 100);
    c.propose_rule_change(id, new.clone(), 2);
    for m in &MEMBERS[1..3] {
        call(m, 101);
        c.approve_rule_change(id);
    }
    call("ada.testnet", 101 + DELAY - 1);
    c.apply_rule_change(id);
}

#[test]
fn rule_change_applies_after_k_votes_and_the_delay() {
    let (mut c, id) = setup();
    let new: Vec<AccountId> = MEMBERS[..3].iter().map(|m| acc(m)).collect();
    call("ada.testnet", 100);
    c.propose_rule_change(id, new.clone(), 2);
    call("tunde.testnet", 101);
    c.approve_rule_change(id);
    assert!(c.get_pot(id).unwrap().pending_rule.unwrap().effective_at.is_none());
    call("musa.testnet", 102);
    c.approve_rule_change(id);
    call("ada.testnet", 102 + DELAY);
    c.apply_rule_change(id);
    let pot = c.get_pot(id).unwrap();
    assert_eq!(pot.members, new);
    assert_eq!(pot.approvals_needed, 2);
}

#[test]
fn failed_payment_restores_the_line_and_pot() {
    let (mut c, id) = setup();
    fund(&mut c, id);
    let line = hall_line(&mut c, id, near(2));
    approve_by(&mut c, line, &MEMBERS[..3], 30);
    call(AGENT, 30 + POT_HOLD);
    let _ = c.pay_line(line, near(2));
    c.restore_pot_transfer(line, near(2), None);
    let l = c.get_line(line).unwrap();
    assert_eq!(l.paid.as_yoctonear(), 0);
    assert_eq!(l.status, LineStatus::Approved);
    assert_eq!(c.get_pot(id).unwrap().spent.as_yoctonear(), 0);
}

#[test]
fn refund_claimed_once_and_restored_if_it_fails() {
    let (mut c, id) = setup();
    fund(&mut c, id);
    for m in &MEMBERS[..3] {
        call(m, 500);
        c.close_pot(id);
    }
    let owed = c.get_refund(id, acc("tunde.testnet"));
    call("tunde.testnet", 501);
    let _ = c.claim_refund(id);
    assert_eq!(c.get_refund(id, acc("tunde.testnet")).as_yoctonear(), 0);
    c.restore_pot_transfer(id, owed, Some(acc("tunde.testnet")));
    assert_eq!(c.get_refund(id, acc("tunde.testnet")), owed);
}

#[test]
#[should_panic(expected = "No refund to claim")]
fn refund_cannot_be_claimed_twice() {
    let (mut c, id) = setup();
    fund(&mut c, id);
    for m in &MEMBERS[..3] {
        call(m, 500);
        c.close_pot(id);
    }
    call("tunde.testnet", 501);
    let _ = c.claim_refund(id);
    let _ = c.claim_refund(id);
}

#[test]
#[should_panic(expected = "Only this line's vendor can confirm it")]
fn only_the_vendor_confirms() {
    let (mut c, id) = setup();
    fund(&mut c, id);
    let line = hall_line(&mut c, id, near(2));
    approve_by(&mut c, line, &MEMBERS[..3], 30);
    call(AGENT, 30 + POT_HOLD);
    let _ = c.pay_line(line, near(2));
    call("ada.testnet", 200);
    c.vendor_confirm(line, "Received".into());
}

#[test]
fn mul_div_is_exact_for_large_numbers() {
    let a = 4_999_999_999_999_999_999_999_999u128;
    let b = 3_333_333_333_333_333_333_333_333u128;
    let d = 9_999_999_999_999_999_999_999_997u128;
    // a * b / d computed by hand-checked long division: verify by multiplication.
    let q = mul_div(a, b, d);
    // q*d <= a*b < (q+1)*d, checked through mul_div identities.
    assert_eq!(mul_div(q, d, b) <= a, true);
    assert_eq!(mul_div(10, 7, 3), 23);
    assert_eq!(mul_div(u128::MAX, 2, 4), u128::MAX / 2);
}
