//! Pause Groups: a shared pot for a reunion, wedding or trip.
//!
//! Members decide every payment (k of n), the agent does the chores, and the
//! contract makes sure money leaves a pot only:
//! - to the vendor of an Approved budget line,
//! - up to that line's amount,
//! - after the line's hold window, during which any member can object,
//! - never to a vendor hard-blocked in Pause's scam registry,
//! - or back to the contributors, pro rata, when the pot is cancelled or closed.
//!
//! Pots, lines and refunds are stored under their own keys, so adding this
//! module changes nothing in the existing contract state.

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde_json::json;
use near_sdk::{env, near, require, AccountId, NearToken, Promise, PromiseOrValue};

use super::{dedup, emit, now_secs, Pause, PauseExt, BLOCK_REPORTS, CALLBACK_GAS};

pub const MAX_MEMBERS: usize = 12;
pub const MAX_LINES: usize = 20;
pub const MAX_TEXT: usize = 64;
pub const MAX_NOTE: usize = 140;
pub const MAX_POT_HOLD_SECS: u64 = 7 * 24 * 60 * 60;

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PotStatus {
    Raising,
    Spending,
    Closed,
    Cancelled,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LineStatus {
    Proposed,
    Approved,
    Paid,
    Rejected,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct RuleChange {
    pub members: Vec<AccountId>,
    pub approvals_needed: u8,
    pub votes: Vec<AccountId>,
    /// Set once k members agree; the change applies after the settings delay.
    pub effective_at: Option<u64>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Pot {
    pub id: u64,
    pub name: String,
    /// A member like any other, with no extra power over money.
    pub organizer: AccountId,
    pub members: Vec<AccountId>,
    pub approvals_needed: u8,
    /// Proposes lines and pays approved ones. Never a voter.
    pub agent: AccountId,
    pub goal: NearToken,
    pub contribution_each: Option<NearToken>,
    pub raised: NearToken,
    pub spent: NearToken,
    pub deadline: u64,
    pub hold_secs: u64,
    pub status: PotStatus,
    pub contributions: Vec<(AccountId, NearToken)>,
    pub line_ids: Vec<u64>,
    pub cancel_votes: Vec<AccountId>,
    pub close_votes: Vec<AccountId>,
    pub pending_rule: Option<RuleChange>,
    pub created_at: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct BudgetLine {
    pub id: u64,
    pub pot_id: u64,
    pub vendor: AccountId,
    pub label: String,
    pub amount: NearToken,
    pub paid: NearToken,
    pub approvals: Vec<AccountId>,
    pub rejections: Vec<AccountId>,
    pub status: LineStatus,
    pub approved_at: Option<u64>,
    pub proposed_by: AccountId,
    pub vendor_note: Option<String>,
    /// Why Pause flagged this vendor when it was proposed, if it did.
    pub flagged: Option<String>,
    /// Why a payment was refused, if one was.
    pub refused: Option<String>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct PotReport {
    pub pot_id: u64,
    pub status: PotStatus,
    pub goal: NearToken,
    pub raised: NearToken,
    /// Approved but not yet paid.
    pub approved: NearToken,
    pub paid: NearToken,
    /// Money in the pot not yet paid out.
    pub remaining: NearToken,
    /// Money in the pot not yet promised to an approved line.
    pub uncommitted: NearToken,
    pub unpaid_members: Vec<AccountId>,
    pub lines_open: u32,
}

// ------------------------------------------------------------------ storage

fn key(parts: &[&str]) -> Vec<u8> {
    format!("g:{}", parts.join(":")).into_bytes()
}

fn load<T: BorshDeserialize>(k: &[u8]) -> Option<T> {
    env::storage_read(k).map(|b| T::try_from_slice(&b).unwrap_or_else(|_| env::panic_str("Corrupt pot state")))
}

fn save<T: BorshSerialize>(k: &[u8], v: &T) {
    env::storage_write(k, &borsh::to_vec(v).unwrap());
}

fn next_id(name: &str) -> u64 {
    let k = key(&["next", name]);
    let id: u64 = load(&k).unwrap_or(0);
    save(&k, &(id + 1));
    id
}

fn pot_key(id: u64) -> Vec<u8> {
    key(&["pot", &id.to_string()])
}
fn line_key(id: u64) -> Vec<u8> {
    key(&["line", &id.to_string()])
}
fn refund_key(pot_id: u64, who: &AccountId) -> Vec<u8> {
    key(&["refund", &pot_id.to_string(), who.as_str()])
}
fn member_key(who: &AccountId) -> Vec<u8> {
    key(&["member", who.as_str()])
}

fn get_pot_or_panic(id: u64) -> Pot {
    load(&pot_key(id)).unwrap_or_else(|| env::panic_str("No such pot"))
}
fn get_line_or_panic(id: u64) -> BudgetLine {
    load(&line_key(id)).unwrap_or_else(|| env::panic_str("No such budget line"))
}

fn index_member(who: &AccountId, pot_id: u64) {
    let mut ids: Vec<u64> = load(&member_key(who)).unwrap_or_default();
    if !ids.contains(&pot_id) {
        ids.push(pot_id);
        save(&member_key(who), &ids);
    }
}

// --------------------------------------------------------------------- math

/// floor(a * b / d) without overflowing u128, for exact pro-rata refunds.
pub(crate) fn mul_div(a: u128, b: u128, d: u128) -> u128 {
    require!(d > 0, "Division by zero");
    const M: u128 = u64::MAX as u128;
    let (a0, a1, b0, b1) = (a & M, a >> 64, b & M, b >> 64);
    let (p00, p01, p10, p11) = (a0 * b0, a0 * b1, a1 * b0, a1 * b1);
    let mid = (p00 >> 64) + (p01 & M) + (p10 & M);
    let lo = (p00 & M) | (mid << 64);
    let hi = p11 + (p01 >> 64) + (p10 >> 64) + (mid >> 64);
    let (mut rem, mut q) = (0u128, 0u128);
    for i in (0..256u32).rev() {
        let bit = if i >= 128 { (hi >> (i - 128)) & 1 } else { (lo >> i) & 1 };
        let carry = rem >> 127;
        rem = (rem << 1) | bit;
        if carry == 1 || rem >= d {
            rem = rem.wrapping_sub(d);
            if i < 128 {
                q |= 1u128 << i;
            }
        }
    }
    q
}

/// Edit distance, used to flag vendors whose names look like another's.
fn distance(a: &str, b: &str) -> usize {
    let (a, b): (Vec<char>, Vec<char>) = (a.chars().collect(), b.chars().collect());
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    for i in 1..=a.len() {
        let mut cur = vec![i; b.len() + 1];
        for j in 1..=b.len() {
            let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
            cur[j] = (prev[j] + 1).min(cur[j - 1] + 1).min(prev[j - 1] + cost);
        }
        prev = cur;
    }
    prev[b.len()]
}

fn check_text(s: &str, max: usize, what: &str) {
    require!(!s.trim().is_empty() && s.len() <= max, format!("{what} must be 1 to {max} characters"));
}

fn check_rules(members: &[AccountId], k: u8, agent: &AccountId) {
    require!(members.len() >= 1 && members.len() <= MAX_MEMBERS, "A pot needs 1 to 12 members");
    require!(k >= 1 && (k as usize) <= members.len(), "Approvals needed must be between 1 and the number of members");
    require!(!members.contains(agent), "The agent can't be a member: it never votes");
}

fn contribution_of(pot: &Pot, who: &AccountId) -> NearToken {
    pot.contributions.iter().find(|(a, _)| a == who).map(|(_, v)| *v).unwrap_or(NearToken::from_yoctonear(0))
}

fn balance(pot: &Pot) -> NearToken {
    pot.raised.saturating_sub(pot.spent)
}

fn hold_ends(pot: &Pot, line: &BudgetLine) -> u64 {
    line.approved_at.unwrap_or(0) + pot.hold_secs
}

// ------------------------------------------------------------------ methods

#[near]
impl Pause {
    /// The organizer creates the pot. The attached deposit covers storage and
    /// anything left over counts as the organizer's contribution.
    #[payable]
    pub fn create_pot(
        &mut self,
        name: String,
        members: Vec<AccountId>,
        approvals_needed: u8,
        agent: AccountId,
        goal: NearToken,
        contribution_each: Option<NearToken>,
        deadline: u64,
        hold_secs: u64,
    ) -> u64 {
        let organizer = env::predecessor_account_id();
        check_text(&name, MAX_TEXT, "Name");
        let mut members = dedup(members);
        if !members.contains(&organizer) {
            members.insert(0, organizer.clone());
        }
        check_rules(&members, approvals_needed, &agent);
        require!(goal.as_yoctonear() > 0, "Goal must be above zero");
        require!(hold_secs > 0 && hold_secs <= MAX_POT_HOLD_SECS, "Hold window must be between 1 second and 7 days");

        let before = env::storage_usage();
        let id = next_id("pot");
        let now = now_secs();
        let pot = Pot {
            id,
            name: name.clone(),
            organizer: organizer.clone(),
            members: members.clone(),
            approvals_needed,
            agent: agent.clone(),
            goal,
            contribution_each,
            raised: NearToken::from_yoctonear(0),
            spent: NearToken::from_yoctonear(0),
            deadline,
            hold_secs,
            status: PotStatus::Raising,
            contributions: vec![],
            line_ids: vec![],
            cancel_votes: vec![],
            close_votes: vec![],
            pending_rule: None,
            created_at: now,
        };
        save(&pot_key(id), &pot);
        for m in &members {
            index_member(m, id);
        }
        let cost = Self::storage_cost(before);
        let deposit = env::attached_deposit();
        require!(deposit >= cost, format!("Attach at least {} yoctoNEAR for storage", cost.as_yoctonear()));
        emit(
            "pot_created",
            json!({ "pot_id": id, "name": name, "organizer": organizer, "members": members,
                    "approvals_needed": approvals_needed, "agent": agent, "goal": goal, "hold_secs": hold_secs }),
        );
        let extra = deposit.saturating_sub(cost);
        if extra.as_yoctonear() > 0 {
            self.add_contribution(id, organizer, extra);
        }
        id
    }

    #[payable]
    pub fn contribute(&mut self, pot_id: u64) {
        let who = env::predecessor_account_id();
        let amount = env::attached_deposit();
        require!(amount.as_yoctonear() > 0, "Attach the amount you're contributing");
        self.add_contribution(pot_id, who, amount);
    }

    /// A member or the pot's agent proposes a payment. Nobody can approve it
    /// by proposing it.
    pub fn propose_line(&mut self, pot_id: u64, vendor: AccountId, label: String, amount: NearToken) -> u64 {
        let who = env::predecessor_account_id();
        let mut pot = get_pot_or_panic(pot_id);
        require!(pot.members.contains(&who) || who == pot.agent, "Only a member or the pot's agent can propose");
        require!(matches!(pot.status, PotStatus::Raising | PotStatus::Spending), "This pot is finished");
        require!(pot.line_ids.len() < MAX_LINES, "This pot already has 20 budget lines");
        check_text(&label, MAX_TEXT, "Label");
        require!(amount.as_yoctonear() > 0, "Amount must be above zero");
        require!(vendor != env::current_account_id(), "The vendor can't be the Pause contract");
        require!(!pot.members.contains(&vendor) && vendor != pot.agent, "A vendor can't be a member or the agent");

        // Flag anything doubtful in the proposal itself; members decide.
        let mut flags: Vec<String> = vec![];
        let reports = self.registry.get(&vendor).map(|e| e.reports).unwrap_or(0);
        if reports >= BLOCK_REPORTS {
            flags.push(format!("Blocked in the Pause scam registry ({reports} reports). It can't be paid."));
        } else if reports > 0 {
            flags.push(format!("Reported as a scam by {reports} Pause user{}", if reports == 1 { "" } else { "s" }));
        }
        for lid in &pot.line_ids {
            let other: BudgetLine = get_line_or_panic(*lid);
            if other.vendor != vendor && distance(other.vendor.as_str(), vendor.as_str()) <= 2 {
                flags.push(format!("Looks like {}, another vendor in this pot", other.vendor));
                break;
            }
        }
        let committed: u128 = pot
            .line_ids
            .iter()
            .map(|l| get_line_or_panic(*l))
            .filter(|l| matches!(l.status, LineStatus::Proposed | LineStatus::Approved | LineStatus::Paid))
            .map(|l| l.amount.as_yoctonear())
            .sum();
        if committed + amount.as_yoctonear() > pot.goal.as_yoctonear() {
            flags.push("Budget lines add up to more than the goal".into());
        }
        let flagged = if flags.is_empty() { None } else { Some(flags.join(". ")) };

        let id = next_id("line");
        let line = BudgetLine {
            id,
            pot_id,
            vendor: vendor.clone(),
            label: label.clone(),
            amount,
            paid: NearToken::from_yoctonear(0),
            approvals: vec![],
            rejections: vec![],
            status: LineStatus::Proposed,
            approved_at: None,
            proposed_by: who.clone(),
            vendor_note: None,
            flagged: flagged.clone(),
            refused: None,
        };
        save(&line_key(id), &line);
        pot.line_ids.push(id);
        save(&pot_key(pot_id), &pot);
        emit(
            "line_proposed",
            json!({ "pot_id": pot_id, "line_id": id, "vendor": vendor, "label": label, "amount": amount,
                    "proposed_by": who, "flagged": flagged }),
        );
        id
    }

    /// At k approvals the line is Approved and its hold window starts.
    pub fn approve_line(&mut self, line_id: u64) {
        self.vote_line(line_id, true);
    }

    /// At k rejections the line is Rejected.
    pub fn reject_line(&mut self, line_id: u64) {
        self.vote_line(line_id, false);
    }

    /// Any member, during the hold window: back to Proposed for a fresh vote.
    pub fn object(&mut self, line_id: u64) {
        let who = env::predecessor_account_id();
        let mut line = get_line_or_panic(line_id);
        let pot = get_pot_or_panic(line.pot_id);
        require!(pot.members.contains(&who), "Only a member can object");
        require!(line.status == LineStatus::Approved && line.paid.as_yoctonear() == 0, "Only an approved, unpaid line can be objected to");
        require!(now_secs() < hold_ends(&pot, &line), "The hold window is over");
        line.status = LineStatus::Proposed;
        line.approvals.clear();
        line.rejections.clear();
        line.approved_at = None;
        save(&line_key(line_id), &line);
        emit("line_objected", json!({ "pot_id": pot.id, "line_id": line_id, "by": who, "vendor": line.vendor, "label": line.label }));
    }

    /// The pot's agent pays all or part of an approved line after its hold
    /// window. A hard-blocked vendor is refused and the line rejected.
    pub fn pay_line(&mut self, line_id: u64, amount: NearToken) -> PromiseOrValue<bool> {
        let mut line = get_line_or_panic(line_id);
        let mut pot = get_pot_or_panic(line.pot_id);
        require!(env::predecessor_account_id() == pot.agent, "Only the pot's agent can pay");
        require!(matches!(pot.status, PotStatus::Raising | PotStatus::Spending), "This pot is finished");
        require!(line.status == LineStatus::Approved, "This line isn't approved");
        require!(now_secs() >= hold_ends(&pot, &line), "The hold window isn't over yet");
        require!(amount.as_yoctonear() > 0, "Amount must be above zero");
        let left = line.amount.saturating_sub(line.paid);
        require!(amount <= left, format!("Only {} yoctoNEAR is left on this line", left.as_yoctonear()));
        require!(amount <= balance(&pot), "The pot doesn't hold enough for this payment");

        let reports = self.registry.get(&line.vendor).map(|e| e.reports).unwrap_or(0);
        if reports >= BLOCK_REPORTS {
            let why = format!("Pause users have reported {} as a scam ({reports} reports)", line.vendor);
            line.status = LineStatus::Rejected;
            line.refused = Some(why.clone());
            save(&line_key(line_id), &line);
            emit("payment_refused", json!({ "pot_id": pot.id, "line_id": line_id, "vendor": line.vendor, "reason": why }));
            return PromiseOrValue::Value(false);
        }

        // State first; the callback restores it if the transfer fails.
        line.paid = line.paid.saturating_add(amount);
        if line.paid == line.amount {
            line.status = LineStatus::Paid;
        }
        pot.spent = pot.spent.saturating_add(amount);
        pot.status = PotStatus::Spending;
        save(&line_key(line_id), &line);
        save(&pot_key(pot.id), &pot);
        emit(
            "line_paid",
            json!({ "pot_id": pot.id, "line_id": line_id, "vendor": line.vendor, "label": line.label,
                    "amount": amount, "paid": line.paid, "left": line.amount.saturating_sub(line.paid) }),
        );
        PromiseOrValue::Promise(
            Promise::new(line.vendor.clone()).transfer(amount).then(
                Self::ext(env::current_account_id()).with_static_gas(CALLBACK_GAS).on_pot_transfer(line_id, amount, None),
            ),
        )
    }

    /// The vendor records "received, delivering on…".
    pub fn vendor_confirm(&mut self, line_id: u64, note: String) {
        let mut line = get_line_or_panic(line_id);
        require!(env::predecessor_account_id() == line.vendor, "Only this line's vendor can confirm it");
        require!(line.paid.as_yoctonear() > 0, "Nothing has been paid on this line yet");
        check_text(&note, MAX_NOTE, "Note");
        line.vendor_note = Some(note.clone());
        save(&line_key(line_id), &line);
        emit("vendor_confirmed", json!({ "pot_id": line.pot_id, "line_id": line_id, "vendor": line.vendor, "label": line.label, "note": note }));
    }

    pub fn propose_cancel(&mut self, pot_id: u64) {
        self.vote_finish(pot_id, true);
    }

    pub fn approve_cancel(&mut self, pot_id: u64) {
        self.vote_finish(pot_id, true);
    }

    /// After the event: a vote to close, refunding anything left over.
    pub fn close_pot(&mut self, pot_id: u64) {
        self.vote_finish(pot_id, false);
    }

    /// Pull-based, so one bad transfer can't block everyone else's refund.
    pub fn claim_refund(&mut self, pot_id: u64) -> Promise {
        let who = env::predecessor_account_id();
        let k = refund_key(pot_id, &who);
        let amount: NearToken = load(&k).unwrap_or(NearToken::from_yoctonear(0));
        require!(amount.as_yoctonear() > 0, "No refund to claim");
        env::storage_remove(&k);
        emit("refund_claimed", json!({ "pot_id": pot_id, "who": who, "amount": amount }));
        Promise::new(who.clone()).transfer(amount).then(
            Self::ext(env::current_account_id()).with_static_gas(CALLBACK_GAS).on_pot_transfer(pot_id, amount, Some(who)),
        )
    }

    /// Changing members or k needs k approvals and then the settings delay.
    pub fn propose_rule_change(&mut self, pot_id: u64, members: Vec<AccountId>, approvals_needed: u8) {
        let who = env::predecessor_account_id();
        let mut pot = get_pot_or_panic(pot_id);
        require!(pot.members.contains(&who), "Only a member can propose a rule change");
        let members = dedup(members);
        check_rules(&members, approvals_needed, &pot.agent);
        pot.pending_rule = Some(RuleChange { members: members.clone(), approvals_needed, votes: vec![], effective_at: None });
        save(&pot_key(pot_id), &pot);
        emit("rule_change_proposed", json!({ "pot_id": pot_id, "by": who, "members": members, "approvals_needed": approvals_needed }));
        self.approve_rule_change(pot_id);
    }

    pub fn approve_rule_change(&mut self, pot_id: u64) {
        let who = env::predecessor_account_id();
        let mut pot = get_pot_or_panic(pot_id);
        require!(pot.members.contains(&who), "Only a member can vote");
        let k = pot.approvals_needed as usize;
        let delay = self.settings_delay_secs;
        let rule = pot.pending_rule.as_mut().unwrap_or_else(|| env::panic_str("No rule change to vote on"));
        if !rule.votes.contains(&who) {
            rule.votes.push(who.clone());
        }
        if rule.votes.len() >= k && rule.effective_at.is_none() {
            let at = now_secs() + delay;
            rule.effective_at = Some(at);
            emit("rule_change_agreed", json!({ "pot_id": pot_id, "effective_at": at }));
        }
        save(&pot_key(pot_id), &pot);
    }

    pub fn apply_rule_change(&mut self, pot_id: u64) {
        let who = env::predecessor_account_id();
        let mut pot = get_pot_or_panic(pot_id);
        require!(pot.members.contains(&who), "Only a member can apply a rule change");
        let rule = pot.pending_rule.clone().unwrap_or_else(|| env::panic_str("No rule change to apply"));
        let at = rule.effective_at.unwrap_or_else(|| env::panic_str("Not enough members have agreed yet"));
        require!(now_secs() >= at, "The settings delay hasn't passed yet");
        for m in &rule.members {
            index_member(m, pot_id);
        }
        pot.members = rule.members;
        pot.approvals_needed = rule.approvals_needed;
        pot.pending_rule = None;
        save(&pot_key(pot_id), &pot);
        emit("rule_change_applied", json!({ "pot_id": pot_id, "members": pot.members, "approvals_needed": pot.approvals_needed }));
    }

    #[private]
    pub fn on_pot_transfer(&mut self, id: u64, amount: NearToken, refund_to: Option<AccountId>) -> bool {
        let ok = env::promise_result_checked(0, 16).is_ok();
        if !ok {
            self.restore_pot_transfer(id, amount, refund_to);
        }
        ok
    }

    // ---------------------------------------------------------------- views

    pub fn get_pot(&self, pot_id: u64) -> Option<Pot> {
        load(&pot_key(pot_id))
    }

    pub fn get_lines(&self, pot_id: u64) -> Vec<BudgetLine> {
        self.get_pot(pot_id).map(|p| p.line_ids.iter().filter_map(|l| load(&line_key(*l))).collect()).unwrap_or_default()
    }

    pub fn get_line(&self, line_id: u64) -> Option<BudgetLine> {
        load(&line_key(line_id))
    }

    pub fn get_contributions(&self, pot_id: u64) -> Vec<(AccountId, NearToken)> {
        self.get_pot(pot_id).map(|p| p.contributions).unwrap_or_default()
    }

    pub fn get_refund(&self, pot_id: u64, who: AccountId) -> NearToken {
        load(&refund_key(pot_id, &who)).unwrap_or(NearToken::from_yoctonear(0))
    }

    pub fn get_pots_of(&self, member: AccountId) -> Vec<Pot> {
        let ids: Vec<u64> = load(&member_key(&member)).unwrap_or_default();
        ids.iter().filter_map(|i| self.get_pot(*i)).filter(|p| p.members.contains(&member)).collect()
    }

    pub fn get_report(&self, pot_id: u64) -> PotReport {
        let pot = get_pot_or_panic(pot_id);
        let lines = self.get_lines(pot_id);
        let approved: u128 = lines
            .iter()
            .filter(|l| l.status == LineStatus::Approved)
            .map(|l| l.amount.saturating_sub(l.paid).as_yoctonear())
            .sum();
        let open = lines.iter().filter(|l| matches!(l.status, LineStatus::Proposed | LineStatus::Approved)).count() as u32;
        let target = pot.contribution_each.map(|t| t.as_yoctonear()).unwrap_or(1);
        let unpaid_members = pot
            .members
            .iter()
            .filter(|m| contribution_of(&pot, m).as_yoctonear() < target)
            .cloned()
            .collect();
        let remaining = balance(&pot);
        PotReport {
            pot_id,
            status: pot.status,
            goal: pot.goal,
            raised: pot.raised,
            approved: NearToken::from_yoctonear(approved),
            paid: pot.spent,
            remaining,
            uncommitted: NearToken::from_yoctonear(remaining.as_yoctonear().saturating_sub(approved)),
            unpaid_members,
            lines_open: open,
        }
    }
}

// ---------------------------------------------------------------- internals

impl Pause {
    fn add_contribution(&mut self, pot_id: u64, who: AccountId, amount: NearToken) {
        let mut pot = get_pot_or_panic(pot_id);
        require!(pot.members.contains(&who), "Only a member can contribute");
        require!(matches!(pot.status, PotStatus::Raising | PotStatus::Spending), "This pot is finished");
        match pot.contributions.iter_mut().find(|(a, _)| a == &who) {
            Some((_, v)) => *v = v.saturating_add(amount),
            None => pot.contributions.push((who.clone(), amount)),
        }
        pot.raised = pot.raised.saturating_add(amount);
        let total = contribution_of(&pot, &who);
        save(&pot_key(pot_id), &pot);
        emit(
            "contributed",
            json!({ "pot_id": pot_id, "who": who, "amount": amount, "total": total, "raised": pot.raised, "goal": pot.goal }),
        );
    }

    fn vote_line(&mut self, line_id: u64, approve: bool) {
        let who = env::predecessor_account_id();
        let mut line = get_line_or_panic(line_id);
        let mut pot = get_pot_or_panic(line.pot_id);
        require!(who != pot.agent, "The agent can't vote");
        require!(pot.members.contains(&who), "Only a member can vote");
        require!(matches!(pot.status, PotStatus::Raising | PotStatus::Spending), "This pot is finished");
        require!(line.status == LineStatus::Proposed, "This line isn't open for a vote");
        // One vote per member; changing your mind moves your vote.
        line.approvals.retain(|a| a != &who);
        line.rejections.retain(|a| a != &who);
        if approve {
            line.approvals.push(who.clone());
        } else {
            line.rejections.push(who.clone());
        }
        let k = pot.approvals_needed as usize;
        if line.approvals.len() >= k {
            let now = now_secs();
            line.status = LineStatus::Approved;
            line.approved_at = Some(now);
            pot.status = PotStatus::Spending;
            save(&pot_key(pot.id), &pot);
            emit(
                "line_approved",
                json!({ "pot_id": pot.id, "line_id": line_id, "vendor": line.vendor, "label": line.label, "amount": line.amount,
                        "approvals": line.approvals.len(), "members": pot.members.len(), "pays_after": now + pot.hold_secs }),
            );
        } else if line.rejections.len() >= k {
            line.status = LineStatus::Rejected;
            emit("line_rejected", json!({ "pot_id": pot.id, "line_id": line_id, "vendor": line.vendor, "label": line.label }));
        } else {
            emit(
                "line_vote",
                json!({ "pot_id": pot.id, "line_id": line_id, "by": who, "approve": approve,
                        "approvals": line.approvals.len(), "needed": k }),
            );
        }
        save(&line_key(line_id), &line);
    }

    fn vote_finish(&mut self, pot_id: u64, cancel: bool) {
        let who = env::predecessor_account_id();
        let mut pot = get_pot_or_panic(pot_id);
        require!(pot.members.contains(&who), "Only a member can vote");
        require!(matches!(pot.status, PotStatus::Raising | PotStatus::Spending), "This pot is already finished");
        let votes = if cancel { &mut pot.cancel_votes } else { &mut pot.close_votes };
        if !votes.contains(&who) {
            votes.push(who.clone());
        }
        let n = votes.len();
        let k = pot.approvals_needed as usize;
        let what = if cancel { "cancel" } else { "close" };
        if n < k {
            save(&pot_key(pot_id), &pot);
            emit("finish_vote", json!({ "pot_id": pot_id, "kind": what, "by": who, "votes": n, "needed": k }));
            return;
        }
        // Open lines are closed; unspent money becomes pro-rata refunds.
        for lid in pot.line_ids.clone() {
            let mut l = get_line_or_panic(lid);
            if matches!(l.status, LineStatus::Proposed | LineStatus::Approved) {
                l.status = if l.paid.as_yoctonear() > 0 { LineStatus::Paid } else { LineStatus::Rejected };
                save(&line_key(lid), &l);
            }
        }
        pot.status = if cancel { PotStatus::Cancelled } else { PotStatus::Closed };
        let refunds = Self::allot_refunds(&pot);
        save(&pot_key(pot_id), &pot);
        emit(
            if cancel { "pot_cancelled" } else { "pot_closed" },
            json!({ "pot_id": pot_id, "refunded": balance(&pot), "refunds": refunds }),
        );
    }

    /// Splits the unspent balance pro rata to contributions, exact to the
    /// yoctoNEAR: rounding dust goes to the largest contributor.
    fn allot_refunds(pot: &Pot) -> Vec<(AccountId, NearToken)> {
        let unspent = balance(pot).as_yoctonear();
        let raised = pot.raised.as_yoctonear();
        if unspent == 0 || raised == 0 {
            return vec![];
        }
        let mut shares: Vec<(AccountId, u128)> = pot
            .contributions
            .iter()
            .map(|(a, c)| (a.clone(), mul_div(unspent, c.as_yoctonear(), raised)))
            .collect();
        let given: u128 = shares.iter().map(|(_, s)| s).sum();
        let dust = unspent - given;
        if let Some(i) = (0..pot.contributions.len()).max_by_key(|&i| pot.contributions[i].1.as_yoctonear()) {
            shares[i].1 += dust;
        }
        for (a, s) in &shares {
            if *s > 0 {
                save(&refund_key(pot.id, a), &NearToken::from_yoctonear(*s));
            }
        }
        shares.into_iter().map(|(a, s)| (a, NearToken::from_yoctonear(s))).collect()
    }

    pub(crate) fn restore_pot_transfer(&mut self, id: u64, amount: NearToken, refund_to: Option<AccountId>) {
        match refund_to {
            Some(who) => {
                let k = refund_key(id, &who);
                let had: NearToken = load(&k).unwrap_or(NearToken::from_yoctonear(0));
                save(&k, &had.saturating_add(amount));
                emit("refund_failed", json!({ "pot_id": id, "who": who, "amount": amount }));
            }
            None => {
                let mut line = get_line_or_panic(id);
                let mut pot = get_pot_or_panic(line.pot_id);
                line.paid = line.paid.saturating_sub(amount);
                if line.status == LineStatus::Paid {
                    line.status = LineStatus::Approved;
                }
                pot.spent = pot.spent.saturating_sub(amount);
                save(&line_key(id), &line);
                save(&pot_key(pot.id), &pot);
                emit("pot_transfer_failed", json!({ "pot_id": pot.id, "line_id": id, "amount": amount }));
            }
        }
    }
}
