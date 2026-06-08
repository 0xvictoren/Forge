/// Forge — Web3 Creator Platform on Aptos ShelbyNet
/// Native APT payments: verification, tips, subscriptions, platform fee
module forge::forge {
    use std::signer;
    use std::vector;
    use std::string::String;
    use aptos_framework::aptos_account;
    use aptos_framework::event;
    use aptos_framework::timestamp;

    // ─── Errors ───────────────────────────────────────────────────────────────

    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;
    const E_ZERO_AMOUNT: u64 = 3;
    const E_INVALID_TIER: u64 = 4;

    // ─── Constants ──────────────────────────────────────────────────────────────

    const SUBSCRIPTION_DURATION_SECS: u64 = 2592000; // 30 days

    // ─── Events ─────────────────────────────────────────────────────────────────

    #[event]
    struct CreatorVerified has drop, store {
        creator: address,
        tx_hash: vector<u8>,
    }

    #[event]
    struct TipSent has drop, store {
        from: address,
        to: address,
        amount: u64,
    }

    #[event]
    struct SubscriptionCreated has drop, store {
        subscriber: address,
        creator: address,
        tier_index: u64,
        expires_at: u64,
    }

    #[event]
    struct BurnLinkPurchased has drop, store {
        buyer: address,
        creator: address,
        amount: u64,
    }

    // ─── Structs ────────────────────────────────────────────────────────────────

    struct ForgePlatform has key {
        treasury: address,
        verification_fee: u64,
        platform_fee_bps: u64,
    }

    struct Tier has store, copy, drop {
        name: String,
        price_apt: u64,
        description: String,
    }

    struct CreatorProfile has key {
        verified: bool,
        verification_tx: vector<u8>,
        tiers: vector<Tier>,
        total_earned: u64,
    }

    // ─── Init ───────────────────────────────────────────────────────────────────

    public entry fun initialize_platform(admin: &signer, treasury: address) {
        let admin_addr = signer::address_of(admin);
        assert!(!exists<ForgePlatform>(admin_addr), E_ALREADY_INITIALIZED);
        move_to(
            admin,
            ForgePlatform {
                treasury,
                verification_fee: 1000000000, // 10 APT in octa
                platform_fee_bps: 500, // 5%
            },
        );
    }

    // ─── Verification ───────────────────────────────────────────────────────────

    public entry fun verify_creator(user: &signer, platform_addr: address) acquires ForgePlatform, CreatorProfile {
        let platform = borrow_global<ForgePlatform>(platform_addr);
        let fee = platform.verification_fee;
        assert!(fee > 0, E_ZERO_AMOUNT);
        aptos_account::transfer(user, platform.treasury, fee);

        let addr = signer::address_of(user);
        if (!exists<CreatorProfile>(addr)) {
            move_to(
                user,
                CreatorProfile {
                    verified: true,
                    verification_tx: vector::empty(),
                    tiers: vector::empty(),
                    total_earned: 0,
                },
            );
        } else {
            let profile = borrow_global_mut<CreatorProfile>(addr);
            profile.verified = true;
        };

        event::emit(CreatorVerified { creator: addr, tx_hash: vector::empty() });
    }

    // ─── Tips ───────────────────────────────────────────────────────────────────

    public entry fun tip_creator(
        sender: &signer,
        creator: address,
        amount: u64,
        platform_addr: address,
    ) acquires ForgePlatform, CreatorProfile {
        assert!(amount > 0, E_ZERO_AMOUNT);
        let platform = borrow_global<ForgePlatform>(platform_addr);
        let fee = (amount * platform.platform_fee_bps) / 10000;
        let to_creator = amount - fee;

        aptos_account::transfer(sender, creator, to_creator);
        if (fee > 0) {
            aptos_account::transfer(sender, platform.treasury, fee);
        };

        if (exists<CreatorProfile>(creator)) {
            let profile = borrow_global_mut<CreatorProfile>(creator);
            profile.total_earned = profile.total_earned + to_creator;
        };

        event::emit(TipSent {
            from: signer::address_of(sender),
            to: creator,
            amount,
        });
    }

    // ─── Subscriptions ──────────────────────────────────────────────────────────

    public entry fun subscribe(
        sender: &signer,
        creator: address,
        tier_index: u64,
        platform_addr: address,
    ) acquires ForgePlatform, CreatorProfile {
        assert!(exists<CreatorProfile>(creator), E_NOT_INITIALIZED);
        let profile = borrow_global<CreatorProfile>(creator);
        assert!(tier_index < vector::length(&profile.tiers), E_INVALID_TIER);
        let tier = *vector::borrow(&profile.tiers, tier_index);
        let amount = tier.price_apt;
        assert!(amount > 0, E_ZERO_AMOUNT);

        tip_creator(sender, creator, amount, platform_addr);

        let expires = timestamp::now_seconds() + SUBSCRIPTION_DURATION_SECS;
        event::emit(SubscriptionCreated {
            subscriber: signer::address_of(sender),
            creator,
            tier_index,
            expires_at: expires,
        });
    }

    // ─── BurnLink purchase ──────────────────────────────────────────────────────

    public entry fun purchase_burnlink(
        buyer: &signer,
        creator: address,
        amount: u64,
        platform_addr: address,
    ) acquires ForgePlatform, CreatorProfile {
        assert!(amount > 0, E_ZERO_AMOUNT);
        tip_creator(buyer, creator, amount, platform_addr);
        event::emit(BurnLinkPurchased {
            buyer: signer::address_of(buyer),
            creator,
            amount,
        });
    }

    // ─── View functions ─────────────────────────────────────────────────────────

    #[view]
    public fun is_verified(creator: address): bool acquires CreatorProfile {
        exists<CreatorProfile>(creator) && borrow_global<CreatorProfile>(creator).verified
    }

    #[view]
    public fun verification_fee(platform_addr: address): u64 acquires ForgePlatform {
        borrow_global<ForgePlatform>(platform_addr).verification_fee
    }

    #[view]
    public fun platform_treasury(platform_addr: address): address acquires ForgePlatform {
        borrow_global<ForgePlatform>(platform_addr).treasury
    }
}
