//! Pause: a vault that holds risky payments for a short window.
//!
//! Roles per vault:
//! - owner: the only account that can start a payment, cancel or release it.
//! - agent: records a risk verdict and can extend holds. Nothing else.
//! - guardians (max 3): can extend, approve early, veto, or confirm a scam.
//!
//! Money only ever goes to the receiver the owner named, or back into the vault.

use near_sdk::serde_json::{self, json};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseOrValue,
};

pub const MAX_GUARDIANS: usize = 3;
pub const MAX_TRUSTED_PAYEES: usize = 50;
pub const MAX_HOLD_TOTAL_SECS: u64 = 7 * 24 * 60 * 60;
pub const DAY_SECS: u64 = 24 * 60 * 60;
pub const MAX_MEMO_LEN: usize = 280;
const CALLBACK_GAS: Gas = Gas::from_tgas(10);

#[near]
#[derive(BorshStorageKey)]
enum StorageKey {
    Vaults,
    Holds,
    Registry,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum HoldStatus {
    Pending,
    Released,
    Cancelled,
    Vetoed,
    Blocked,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub enum Risk {
    Unknown,
    Low,
    Medium,
    High,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Hold {
    pub id: u64,
    pub owner: AccountId,
    pub receiver: AccountId,
    pub amount: NearToken,
    /// Free text from the owner. Treated as data only, never as instructions.
    pub memo: Option<String>,
    pub created_at: u64,
    pub release_at: u64,
    pub status: HoldStatus,
    pub risk: Risk,
    pub scam_type: Option<String>,
    /// SHA-256 of the agent's reasons. The reasons themselves stay off-chain.
    pub reasons_hash: Option<String>,
    pub guardian_approved: bool,
}

/// A change that may weaken protection. Every field is optional; only the
/// fields that are set are changed when the proposal is applied.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct ChangeRequest {
    pub guardians: Option<Vec<AccountId>>,
    pub agent: Option<AccountId>,
    pub remove_agent: Option<bool>,
    pub instant_limit: Option<NearToken>,
    pub daily_instant_cap: Option<NearToken>,
    pub hold_secs: Option<u64>,
    pub add_trusted_payees: Option<Vec<AccountId>>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct SettingsChange {
    pub change: ChangeRequest,
    pub proposed_at: u64,
    pub effective_at: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Vault {
    pub owner: AccountId,
    pub balance: NearToken,
    pub guardians: Vec<AccountId>,
    pub agent: Option<AccountId>,
    pub instant_limit: NearToken,
    pub daily_instant_cap: NearToken,
    pub spent_today: NearToken,
    pub day_start: u64,
    pub hold_secs: u64,
    pub trusted_payees: Vec<AccountId>,
    pub pending_change: Option<SettingsChange>,
    pub hold_ids: Vec<u64>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct RegistryEntry {
    pub receiver: AccountId,
    pub scam_type: Option<String>,
    pub reports: u32,
    pub first_reported_at: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct Stats {
    pub instant_payments: u64,
    pub holds_created: u64,
    pub blocked_by_registry: u64,
    pub scams_confirmed: u64,
}

/// What `send` did with a payment.
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct SendResult {
    /// "paid", "held" or "blocked"
    pub outcome: String,
    pub hold_id: Option<u64>,
    pub release_at: Option<u64>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Pause {
    admin: AccountId,
    settings_delay_secs: u64,
    vaults: IterableMap<AccountId, Vault>,
    holds: LookupMap<u64, Hold>,
    next_hold_id: u64,
    registry: IterableMap<AccountId, RegistryEntry>,
    stats: Stats,
}

fn now_secs() -> u64 {
    env::block_timestamp() / 1_000_000_000
}

fn emit(event: &str, data: serde_json::Value) {
    let log = json!({
        "standard": "pause",
        "version": "1.0.0",
        "event": event,
        "data": [data],
    });
    env::log_str(&format!("EVENT_JSON:{}", log));
}

fn dedup(list: Vec<AccountId>) -> Vec<AccountId> {
    let mut out: Vec<AccountId> = Vec::new();
    for a in list {
        if !out.contains(&a) {
            out.push(a);
        }
    }
    out
}

#[near]
impl Pause {
    #[init]
    pub fn new(admin: AccountId, settings_delay_secs: u64) -> Self {
        Self {
            admin,
            settings_delay_secs,
            vaults: IterableMap::new(StorageKey::Vaults),
            holds: LookupMap::new(StorageKey::Holds),
            next_hold_id: 0,
            registry: IterableMap::new(StorageKey::Registry),
            stats: Stats::default(),
        }
    }

    // ---------------------------------------------------------------- owner

    /// Opens a vault. The attached deposit pays for storage; the rest is the
    /// starting balance.
    #[payable]
    pub fn create_vault(
        &mut self,
        guardians: Vec<AccountId>,
        agent: Option<AccountId>,
        instant_limit: NearToken,
        daily_instant_cap: NearToken,
        hold_secs: u64,
        trusted_payees: Option<Vec<AccountId>>,
    ) {
        let owner = env::predecessor_account_id();
        require!(self.vaults.get(&owner).is_none(), "Vault already exists");
        let guardians = dedup(guardians);
        self.check_roles(&owner, &guardians, agent.as_ref());
        require!(hold_secs > 0, "hold_secs must be above zero");
        let trusted = dedup(trusted_payees.unwrap_or_default());
        require!(trusted.len() <= MAX_TRUSTED_PAYEES, "Too many trusted payees");

        let before = env::storage_usage();
        self.vaults.insert(
            owner.clone(),
            Vault {
                owner: owner.clone(),
                balance: NearToken::from_yoctonear(0),
                guardians,
                agent,
                instant_limit,
                daily_instant_cap,
                spent_today: NearToken::from_yoctonear(0),
                day_start: now_secs(),
                hold_secs,
                trusted_payees: trusted,
                pending_change: None,
                hold_ids: Vec::new(),
            },
        );
        self.vaults.flush();
        let cost = Self::storage_cost(before);
        let deposit = env::attached_deposit();
        require!(
            deposit >= cost,
            format!("Attach at least {} yoctoNEAR for storage", cost.as_yoctonear())
        );
        let vault = self.vaults.get_mut(&owner).unwrap();
        vault.balance = deposit.saturating_sub(cost);
        emit(
            "vault_created",
            json!({ "owner": owner, "balance": vault.balance, "guardians": vault.guardians }),
        );
    }

    #[payable]
    pub fn deposit(&mut self) {
        let owner = env::predecessor_account_id();
        let amount = env::attached_deposit();
        let vault = self.vault_mut(&owner);
        vault.balance = vault.balance.saturating_add(amount);
        emit("deposit", json!({ "owner": owner, "amount": amount, "balance": vault.balance }));
    }

    /// Registry hit: blocked. Trusted payee under the limits: paid at once.
    /// Anything else: a new hold.
    pub fn send(
        &mut self,
        receiver: AccountId,
        amount: NearToken,
        memo: Option<String>,
    ) -> SendResult {
        let owner = env::predecessor_account_id();
        require!(amount.as_yoctonear() > 0, "Amount must be above zero");
        require!(receiver != env::current_account_id(), "Cannot pay the Pause contract");
        if let Some(m) = &memo {
            require!(m.len() <= MAX_MEMO_LEN, "Memo too long");
        }
        let mut vault = self.vault(&owner).clone();
        require!(vault.balance >= amount, "Not enough balance in the vault");
        let now = now_secs();

        // 1. Shared scam registry.
        if let Some(entry) = self.registry.get(&receiver) {
            let scam_type = entry.scam_type.clone();
            let id = self.store_hold(&mut vault, receiver.clone(), amount, memo, HoldStatus::Blocked, 0);
            self.stats.blocked_by_registry += 1;
            emit(
                "blocked_by_registry",
                json!({ "hold_id": id, "owner": owner, "receiver": receiver, "amount": amount, "scam_type": scam_type }),
            );
            self.vaults.insert(owner, vault);
            return SendResult { outcome: "blocked".into(), hold_id: Some(id), release_at: None };
        }

        // 2. Trusted payee under the instant limit and daily cap.
        if now >= vault.day_start + DAY_SECS {
            vault.day_start = now;
            vault.spent_today = NearToken::from_yoctonear(0);
        }
        let spent_after = vault.spent_today.saturating_add(amount);
        if vault.trusted_payees.contains(&receiver)
            && amount <= vault.instant_limit
            && spent_after <= vault.daily_instant_cap
        {
            vault.balance = vault.balance.saturating_sub(amount);
            vault.spent_today = spent_after;
            self.vaults.insert(owner.clone(), vault);
            self.stats.instant_payments += 1;
            emit("instant_payment", json!({ "owner": owner, "receiver": receiver, "amount": amount }));
            // Dropping the promise schedules it.
            let _ = Self::pay(receiver, amount, owner, None);
            return SendResult { outcome: "paid".into(), hold_id: None, release_at: None };
        }

        // 3. Everything else waits.
        vault.balance = vault.balance.saturating_sub(amount);
        let release_at = now + vault.hold_secs;
        let id = self.store_hold(&mut vault, receiver.clone(), amount, memo.clone(), HoldStatus::Pending, release_at);
        self.stats.holds_created += 1;
        emit(
            "hold_created",
            json!({
                "hold_id": id, "owner": owner, "receiver": receiver, "amount": amount,
                "memo": memo, "release_at": release_at, "guardians": vault.guardians,
            }),
        );
        self.vaults.insert(owner, vault);
        SendResult { outcome: "held".into(), hold_id: Some(id), release_at: Some(release_at) }
    }

    pub fn cancel(&mut self, hold_id: u64) {
        let hold = self.pending_hold(hold_id);
        require!(env::predecessor_account_id() == hold.owner, "Only the owner can cancel");
        self.close_and_refund(hold_id, HoldStatus::Cancelled);
        emit("hold_cancelled", json!({ "hold_id": hold_id, "owner": hold.owner }));
    }

    /// Pays out a hold once its window has passed (or a guardian approved it
    /// early). A High-risk hold also needs a guardian approval.
    pub fn release(&mut self, hold_id: u64) -> PromiseOrValue<bool> {
        let hold = self.pending_hold(hold_id);
        require!(env::predecessor_account_id() == hold.owner, "Only the owner can release");
        let vault = self.vault(&hold.owner);
        require!(
            now_secs() >= hold.release_at || hold.guardian_approved,
            "The hold window has not ended yet"
        );
        if hold.risk == Risk::High && !vault.guardians.is_empty() {
            require!(hold.guardian_approved, "High-risk payment needs a guardian's approval");
        }

        // The receiver may have been reported while the payment waited.
        if self.registry.get(&hold.receiver).is_some() {
            self.close_and_refund(hold_id, HoldStatus::Blocked);
            self.stats.blocked_by_registry += 1;
            emit(
                "blocked_by_registry",
                json!({ "hold_id": hold_id, "owner": hold.owner, "receiver": hold.receiver, "amount": hold.amount }),
            );
            return PromiseOrValue::Value(false);
        }

        self.holds.get_mut(&hold_id).unwrap().status = HoldStatus::Released;
        emit(
            "hold_released",
            json!({ "hold_id": hold_id, "owner": hold.owner, "receiver": hold.receiver, "amount": hold.amount }),
        );
        PromiseOrValue::Promise(Self::pay(hold.receiver, hold.amount, hold.owner, Some(hold_id)))
    }

    // ---------------------------------------------------------------- agent

    /// Records the agent's verdict. High risk extends the hold and alerts
    /// guardians. A High verdict can't be lowered by the agent.
    pub fn set_risk(
        &mut self,
        hold_id: u64,
        risk: Risk,
        scam_type: Option<String>,
        reasons_hash: Option<String>,
    ) {
        let hold = self.pending_hold(hold_id);
        let vault = self.vault(&hold.owner).clone();
        require!(
            vault.agent.as_ref() == Some(&env::predecessor_account_id()),
            "Only the vault's agent can set risk"
        );
        require!(
            !(hold.risk == Risk::High && risk < Risk::High),
            "Only a guardian can clear a high-risk verdict"
        );
        if let Some(s) = &scam_type {
            require!(s.len() <= 64, "scam_type too long");
        }
        if let Some(h) = &reasons_hash {
            require!(h.len() <= 128, "reasons_hash too long");
        }

        let became_high = risk == Risk::High && hold.risk != Risk::High;
        let h = self.holds.get_mut(&hold_id).unwrap();
        h.risk = risk;
        h.scam_type = scam_type.clone();
        h.reasons_hash = reasons_hash.clone();
        if became_high {
            h.release_at = (h.release_at + vault.hold_secs).min(h.created_at + MAX_HOLD_TOTAL_SECS);
        }
        let release_at = h.release_at;
        emit(
            "risk_set",
            json!({
                "hold_id": hold_id, "owner": hold.owner, "risk": risk, "scam_type": scam_type,
                "reasons_hash": reasons_hash, "release_at": release_at,
            }),
        );
        if became_high {
            emit(
                "guardian_alert",
                json!({
                    "hold_id": hold_id, "owner": hold.owner, "receiver": hold.receiver,
                    "amount": hold.amount, "scam_type": scam_type, "guardians": vault.guardians,
                }),
            );
        }
    }

    /// Agent or guardian: pushes release_at later, capped at 7 days in total.
    pub fn extend_hold(&mut self, hold_id: u64, secs: u64) {
        let hold = self.pending_hold(hold_id);
        let vault = self.vault(&hold.owner);
        let caller = env::predecessor_account_id();
        require!(
            vault.agent.as_ref() == Some(&caller) || vault.guardians.contains(&caller),
            "Only the agent or a guardian can extend a hold"
        );
        let h = self.holds.get_mut(&hold_id).unwrap();
        h.release_at = h.release_at.saturating_add(secs).min(h.created_at + MAX_HOLD_TOTAL_SECS);
        emit(
            "hold_extended",
            json!({ "hold_id": hold_id, "owner": hold.owner, "by": caller, "release_at": h.release_at }),
        );
    }

    // ------------------------------------------------------------ guardians

    pub fn approve_early(&mut self, hold_id: u64) {
        let hold = self.pending_hold(hold_id);
        let caller = self.require_guardian(&hold.owner);
        self.holds.get_mut(&hold_id).unwrap().guardian_approved = true;
        emit("hold_approved", json!({ "hold_id": hold_id, "owner": hold.owner, "by": caller }));
    }

    pub fn veto(&mut self, hold_id: u64) {
        let hold = self.pending_hold(hold_id);
        let caller = self.require_guardian(&hold.owner);
        self.close_and_refund(hold_id, HoldStatus::Vetoed);
        emit("hold_vetoed", json!({ "hold_id": hold_id, "owner": hold.owner, "by": caller }));
    }

    /// Owner or guardian: cancels the hold and adds the receiver to the
    /// shared registry, so every vault blocks it from now on.
    pub fn confirm_scam(&mut self, hold_id: u64) {
        let hold = self.pending_hold(hold_id);
        let caller = env::predecessor_account_id();
        let vault = self.vault(&hold.owner);
        require!(
            caller == hold.owner || vault.guardians.contains(&caller),
            "Only the owner or a guardian can confirm a scam"
        );
        self.close_and_refund(hold_id, HoldStatus::Cancelled);

        let entry = match self.registry.get(&hold.receiver) {
            Some(e) => RegistryEntry {
                reports: e.reports + 1,
                scam_type: e.scam_type.clone().or(hold.scam_type.clone()),
                ..e.clone()
            },
            None => RegistryEntry {
                receiver: hold.receiver.clone(),
                scam_type: hold.scam_type.clone(),
                reports: 1,
                first_reported_at: now_secs(),
            },
        };
        let reports = entry.reports;
        self.registry.insert(hold.receiver.clone(), entry);
        self.stats.scams_confirmed += 1;
        emit(
            "scam_confirmed",
            json!({
                "hold_id": hold_id, "owner": hold.owner, "receiver": hold.receiver,
                "scam_type": hold.scam_type, "reports": reports, "by": caller,
            }),
        );
    }

    // --------------------------------------------- settings: tightening (now)

    pub fn add_guardian(&mut self, guardian: AccountId) {
        let owner = env::predecessor_account_id();
        let agent = self.vault(&owner).agent.clone();
        let mut guardians = self.vault(&owner).guardians.clone();
        require!(!guardians.contains(&guardian), "Already a guardian");
        guardians.push(guardian.clone());
        self.check_roles(&owner, &guardians, agent.as_ref());
        self.vault_mut(&owner).guardians = guardians;
        emit("settings_tightened", json!({ "owner": owner, "add_guardian": guardian }));
    }

    pub fn lower_instant_limit(&mut self, instant_limit: NearToken) {
        let owner = env::predecessor_account_id();
        let vault = self.vault_mut(&owner);
        require!(instant_limit <= vault.instant_limit, "Raising a limit needs propose_change");
        vault.instant_limit = instant_limit;
        emit("settings_tightened", json!({ "owner": owner, "instant_limit": instant_limit }));
    }

    pub fn lower_daily_instant_cap(&mut self, daily_instant_cap: NearToken) {
        let owner = env::predecessor_account_id();
        let vault = self.vault_mut(&owner);
        require!(daily_instant_cap <= vault.daily_instant_cap, "Raising a limit needs propose_change");
        vault.daily_instant_cap = daily_instant_cap;
        emit("settings_tightened", json!({ "owner": owner, "daily_instant_cap": daily_instant_cap }));
    }

    pub fn raise_hold_secs(&mut self, hold_secs: u64) {
        let owner = env::predecessor_account_id();
        let vault = self.vault_mut(&owner);
        require!(hold_secs >= vault.hold_secs, "Shortening holds needs propose_change");
        vault.hold_secs = hold_secs;
        emit("settings_tightened", json!({ "owner": owner, "hold_secs": hold_secs }));
    }

    pub fn remove_trusted_payee(&mut self, payee: AccountId) {
        let owner = env::predecessor_account_id();
        let vault = self.vault_mut(&owner);
        vault.trusted_payees.retain(|p| p != &payee);
        emit("settings_tightened", json!({ "owner": owner, "remove_trusted_payee": payee }));
    }

    /// Withdrawing a pending weakening proposal is itself tightening.
    pub fn cancel_change(&mut self) {
        let owner = env::predecessor_account_id();
        self.vault_mut(&owner).pending_change = None;
        emit("change_cancelled", json!({ "owner": owner }));
    }

    // ------------------------------------------- settings: weakening (later)

    /// Any change that may weaken protection waits the settings delay and
    /// alerts guardians. A new proposal replaces the old one and restarts the clock.
    pub fn propose_change(&mut self, change: ChangeRequest) {
        let owner = env::predecessor_account_id();
        let vault = self.vault(&owner).clone();
        if let Some(g) = &change.guardians {
            let agent = if change.remove_agent == Some(true) {
                None
            } else {
                change.agent.clone().or(vault.agent.clone())
            };
            self.check_roles(&owner, &dedup(g.clone()), agent.as_ref());
        }
        if let Some(a) = &change.agent {
            require!(a != &owner, "The owner can't be their own agent");
        }
        if let Some(s) = change.hold_secs {
            require!(s > 0, "hold_secs must be above zero");
        }
        let now = now_secs();
        let effective_at = now + self.settings_delay_secs;
        self.vault_mut(&owner).pending_change =
            Some(SettingsChange { change: change.clone(), proposed_at: now, effective_at });
        emit(
            "change_proposed",
            json!({ "owner": owner, "change": change, "effective_at": effective_at, "guardians": vault.guardians }),
        );
    }

    pub fn apply_change(&mut self) {
        let owner = env::predecessor_account_id();
        let vault = self.vault_mut(&owner);
        let pending = vault.pending_change.clone().unwrap_or_else(|| env::panic_str("No pending change"));
        require!(now_secs() >= pending.effective_at, "The settings delay has not passed yet");
        let c = pending.change;
        if let Some(g) = c.guardians {
            vault.guardians = dedup(g);
        }
        if c.remove_agent == Some(true) {
            vault.agent = None;
        } else if let Some(a) = c.agent {
            vault.agent = Some(a);
        }
        if let Some(v) = c.instant_limit {
            vault.instant_limit = v;
        }
        if let Some(v) = c.daily_instant_cap {
            vault.daily_instant_cap = v;
        }
        if let Some(v) = c.hold_secs {
            vault.hold_secs = v;
        }
        if let Some(list) = c.add_trusted_payees {
            for p in list {
                if !vault.trusted_payees.contains(&p) {
                    vault.trusted_payees.push(p);
                }
            }
            require!(vault.trusted_payees.len() <= MAX_TRUSTED_PAYEES, "Too many trusted payees");
        }
        vault.pending_change = None;
        let guardians = vault.guardians.clone();
        emit("change_applied", json!({ "owner": owner, "guardians": guardians }));
    }

    // ---------------------------------------------------------------- admin

    /// Corrects a false report.
    pub fn remove_registry_entry(&mut self, receiver: AccountId) {
        require!(env::predecessor_account_id() == self.admin, "Only the admin can remove entries");
        self.registry.remove(&receiver);
        emit("registry_entry_removed", json!({ "receiver": receiver }));
    }

    // ------------------------------------------------------------- callback

    #[private]
    pub fn on_transfer(&mut self, owner: AccountId, amount: NearToken, hold_id: Option<u64>) -> bool {
        // A transfer returns no data, so a tiny max length is enough.
        let ok = env::promise_result_checked(0, 16).is_ok();
        if !ok {
            self.restore_failed_transfer(&owner, amount, hold_id);
        }
        ok
    }

    // ---------------------------------------------------------------- views

    pub fn get_vault(&self, owner: AccountId) -> Option<Vault> {
        self.vaults.get(&owner).cloned()
    }

    /// Newest first.
    pub fn get_holds(&self, owner: AccountId, from_index: Option<u64>, limit: Option<u64>) -> Vec<Hold> {
        let Some(vault) = self.vaults.get(&owner) else { return vec![] };
        vault
            .hold_ids
            .iter()
            .rev()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50) as usize)
            .filter_map(|id| self.holds.get(id).cloned())
            .collect()
    }

    pub fn get_hold(&self, hold_id: u64) -> Option<Hold> {
        self.holds.get(&hold_id).cloned()
    }

    pub fn is_flagged(&self, receiver: AccountId) -> bool {
        self.registry.get(&receiver).is_some()
    }

    pub fn get_registry_entry(&self, receiver: AccountId) -> Option<RegistryEntry> {
        self.registry.get(&receiver).cloned()
    }

    pub fn get_registry(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<RegistryEntry> {
        self.registry
            .values()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50) as usize)
            .cloned()
            .collect()
    }

    /// Owners who list this account as a guardian.
    pub fn get_wards(&self, guardian: AccountId) -> Vec<AccountId> {
        self.vaults
            .iter()
            .filter(|(_, v)| v.guardians.contains(&guardian))
            .map(|(k, _)| k.clone())
            .collect()
    }

    /// Holds from every vault this account guards, newest first.
    pub fn get_guardian_holds(&self, guardian: AccountId, only_pending: Option<bool>) -> Vec<Hold> {
        let only_pending = only_pending.unwrap_or(true);
        let mut out: Vec<Hold> = self
            .vaults
            .values()
            .filter(|v| v.guardians.contains(&guardian))
            .flat_map(|v| v.hold_ids.iter().rev().take(50))
            .filter_map(|id| self.holds.get(id).cloned())
            .filter(|h| !only_pending || h.status == HoldStatus::Pending)
            .collect();
        out.sort_by(|a, b| b.id.cmp(&a.id));
        out
    }

    pub fn get_stats(&self) -> Stats {
        self.stats.clone()
    }

    pub fn get_config(&self) -> serde_json::Value {
        json!({ "admin": self.admin, "settings_delay_secs": self.settings_delay_secs })
    }
}

// -------------------------------------------------------------- internals

impl Pause {
    fn storage_cost(before: u64) -> NearToken {
        let used = env::storage_usage().saturating_sub(before);
        env::storage_byte_cost().saturating_mul(used as u128)
    }

    fn vault(&self, owner: &AccountId) -> &Vault {
        self.vaults.get(owner).unwrap_or_else(|| env::panic_str("No vault for this account"))
    }

    fn vault_mut(&mut self, owner: &AccountId) -> &mut Vault {
        self.vaults.get_mut(owner).unwrap_or_else(|| env::panic_str("No vault for this account"))
    }

    fn pending_hold(&self, hold_id: u64) -> Hold {
        let hold = self.holds.get(&hold_id).cloned().unwrap_or_else(|| env::panic_str("No such hold"));
        require!(hold.status == HoldStatus::Pending, "Hold is not pending");
        hold
    }

    fn require_guardian(&self, owner: &AccountId) -> AccountId {
        let caller = env::predecessor_account_id();
        require!(self.vault(owner).guardians.contains(&caller), "Only a guardian can do this");
        caller
    }

    fn check_roles(&self, owner: &AccountId, guardians: &[AccountId], agent: Option<&AccountId>) {
        require!(guardians.len() <= MAX_GUARDIANS, "At most 3 guardians");
        require!(!guardians.contains(owner), "The owner can't be their own guardian");
        if let Some(a) = agent {
            require!(a != owner, "The owner can't be their own agent");
            require!(!guardians.contains(a), "The agent can't also be a guardian");
        }
    }

    /// Saves a hold and charges its storage to the vault balance.
    fn store_hold(
        &mut self,
        vault: &mut Vault,
        receiver: AccountId,
        amount: NearToken,
        memo: Option<String>,
        status: HoldStatus,
        release_at: u64,
    ) -> u64 {
        let id = self.next_hold_id;
        self.next_hold_id += 1;
        let before = env::storage_usage();
        self.holds.insert(
            id,
            Hold {
                id,
                owner: vault.owner.clone(),
                receiver,
                amount,
                memo,
                created_at: now_secs(),
                release_at,
                status,
                risk: Risk::Unknown,
                scam_type: None,
                reasons_hash: None,
                guardian_approved: false,
            },
        );
        self.holds.flush();
        let cost = Self::storage_cost(before);
        require!(vault.balance >= cost, "Not enough balance to cover storage");
        vault.balance = vault.balance.saturating_sub(cost);
        vault.hold_ids.push(id);
        id
    }

    /// Closes a pending hold and puts its money back in the owner's vault.
    fn close_and_refund(&mut self, hold_id: u64, status: HoldStatus) {
        let hold = self.holds.get_mut(&hold_id).unwrap();
        hold.status = status;
        let (owner, amount) = (hold.owner.clone(), hold.amount);
        let vault = self.vault_mut(&owner);
        vault.balance = vault.balance.saturating_add(amount);
    }

    fn pay(receiver: AccountId, amount: NearToken, owner: AccountId, hold_id: Option<u64>) -> Promise {
        Promise::new(receiver).transfer(amount).then(
            Self::ext(env::current_account_id())
                .with_static_gas(CALLBACK_GAS)
                .on_transfer(owner, amount, hold_id),
        )
    }

    fn restore_failed_transfer(&mut self, owner: &AccountId, amount: NearToken, hold_id: Option<u64>) {
        let vault = self.vault_mut(owner);
        vault.balance = vault.balance.saturating_add(amount);
        if hold_id.is_none() {
            vault.spent_today = vault.spent_today.saturating_sub(amount);
        }
        if let Some(id) = hold_id {
            if let Some(h) = self.holds.get_mut(&id) {
                h.status = HoldStatus::Cancelled;
            }
        }
        emit("transfer_failed", json!({ "owner": owner, "amount": amount, "hold_id": hold_id }));
    }
}

#[cfg(test)]
mod tests;
