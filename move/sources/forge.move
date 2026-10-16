/// Forge marketplace settlement for Aptos ShelbyNet.
/// Every paid grant is tied to a server-issued intent, immutable product/version
/// identifiers, and a one-time nonce. Amounts are always integer octas.
module forge::forge {
    use std::signer;
    use std::vector;
    use aptos_framework::aptos_account;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};

    #[test_only]
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    #[test_only]
    use aptos_framework::coin;

    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;
    const E_ZERO_AMOUNT: u64 = 3;
    const E_INVALID_FEE: u64 = 4;
    const E_EMPTY_IDENTIFIER: u64 = 5;
    const E_NONCE_ALREADY_USED: u64 = 6;
    const E_INTENT_EXPIRED: u64 = 7;
    const E_SELF_PURCHASE: u64 = 8;
    const E_NOT_MODULE_ADMIN: u64 = 9;

    const BPS_DENOMINATOR: u64 = 10_000;
    const PLATFORM_FEE_BPS: u64 = 500;

    #[event]
    struct PaymentSettled has drop, store {
        buyer: address,
        seller: address,
        treasury: address,
        amount_octas: u64,
        fee_octas: u64,
        net_octas: u64,
        fee_bps: u64,
        purchase_intent_id: vector<u8>,
        product_id: vector<u8>,
        version_id: vector<u8>,
        nonce: vector<u8>,
        terms_hash: vector<u8>,
        intent_expires_at: u64,
    }

    struct ForgePlatform has key {
        treasury: address,
        platform_fee_bps: u64,
        used_nonces: Table<vector<u8>, bool>,
    }

    public entry fun initialize_platform(admin: &signer, treasury: address) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @forge, E_NOT_MODULE_ADMIN);
        assert!(!exists<ForgePlatform>(@forge), E_ALREADY_INITIALIZED);
        move_to(
            admin,
            ForgePlatform {
                treasury,
                platform_fee_bps: PLATFORM_FEE_BPS,
                used_nonces: table::new(),
            },
        );
    }

    /// Settle an exact server-issued purchase intent. The caller is always the
    /// buyer; the module address pins both configuration and fee percentage.
    public entry fun settle_purchase(
        buyer: &signer,
        seller: address,
        amount_octas: u64,
        purchase_intent_id: vector<u8>,
        product_id: vector<u8>,
        version_id: vector<u8>,
        nonce: vector<u8>,
        terms_hash: vector<u8>,
        intent_expires_at: u64,
    ) acquires ForgePlatform {
        assert!(exists<ForgePlatform>(@forge), E_NOT_INITIALIZED);
        assert!(amount_octas > 0, E_ZERO_AMOUNT);
        assert!(vector::length(&purchase_intent_id) > 0, E_EMPTY_IDENTIFIER);
        assert!(vector::length(&product_id) > 0, E_EMPTY_IDENTIFIER);
        assert!(vector::length(&version_id) > 0, E_EMPTY_IDENTIFIER);
        assert!(vector::length(&nonce) > 0, E_EMPTY_IDENTIFIER);
        assert!(vector::length(&terms_hash) == 32, E_EMPTY_IDENTIFIER);
        assert!(timestamp::now_seconds() <= intent_expires_at, E_INTENT_EXPIRED);

        let buyer_addr = signer::address_of(buyer);
        assert!(buyer_addr != seller, E_SELF_PURCHASE);

        let platform = borrow_global_mut<ForgePlatform>(@forge);
        assert!(platform.platform_fee_bps < BPS_DENOMINATOR, E_INVALID_FEE);
        assert!(!table::contains(&platform.used_nonces, nonce), E_NONCE_ALREADY_USED);
        table::add(&mut platform.used_nonces, nonce, true);

        let fee_octas = fee_for(amount_octas, platform.platform_fee_bps);
        let net_octas = amount_octas - fee_octas;

        aptos_account::transfer(buyer, seller, net_octas);
        if (fee_octas > 0) {
            aptos_account::transfer(buyer, platform.treasury, fee_octas);
        };

        event::emit(PaymentSettled {
            buyer: buyer_addr,
            seller,
            treasury: platform.treasury,
            amount_octas,
            fee_octas,
            net_octas,
            fee_bps: platform.platform_fee_bps,
            purchase_intent_id,
            product_id,
            version_id,
            nonce,
            terms_hash,
            intent_expires_at,
        });
    }

    #[event]
    struct ProvenanceAnchored has drop, store {
        owner: address,
        dataset_id: vector<u8>,
        version_number: u64,
        manifest_hash: vector<u8>,
        datasheet_hash: vector<u8>,
        seal_hash: vector<u8>,
        anchored_at: u64,
    }

    /// Anchor a dataset version's provenance seal. Stateless: the event and the
    /// signer are the evidence, so anyone can verify who sealed what, and when.
    public entry fun anchor_provenance(
        owner: &signer,
        dataset_id: vector<u8>,
        version_number: u64,
        manifest_hash: vector<u8>,
        datasheet_hash: vector<u8>,
        seal_hash: vector<u8>,
    ) {
        assert!(vector::length(&dataset_id) > 0, E_EMPTY_IDENTIFIER);
        assert!(version_number > 0, E_EMPTY_IDENTIFIER);
        assert!(vector::length(&manifest_hash) == 32, E_EMPTY_IDENTIFIER);
        assert!(vector::length(&datasheet_hash) == 32, E_EMPTY_IDENTIFIER);
        assert!(vector::length(&seal_hash) == 32, E_EMPTY_IDENTIFIER);
        event::emit(ProvenanceAnchored {
            owner: signer::address_of(owner),
            dataset_id,
            version_number,
            manifest_hash,
            datasheet_hash,
            seal_hash,
            anchored_at: timestamp::now_seconds(),
        });
    }

    fun fee_for(amount_octas: u64, fee_bps: u64): u64 {
        assert!(fee_bps < BPS_DENOMINATOR, E_INVALID_FEE);
        (amount_octas * fee_bps) / BPS_DENOMINATOR
    }

    #[view]
    public fun platform_fee_bps(): u64 acquires ForgePlatform {
        borrow_global<ForgePlatform>(@forge).platform_fee_bps
    }

    #[view]
    public fun platform_treasury(): address acquires ForgePlatform {
        borrow_global<ForgePlatform>(@forge).treasury
    }

    #[view]
    public fun nonce_used(nonce: vector<u8>): bool acquires ForgePlatform {
        table::contains(&borrow_global<ForgePlatform>(@forge).used_nonces, nonce)
    }

    #[test]
    fun fee_is_exactly_five_percent() {
        assert!(fee_for(100_000_000, PLATFORM_FEE_BPS) == 5_000_000, 100);
        assert!(fee_for(1, PLATFORM_FEE_BPS) == 0, 101);
    }

    #[test]
    #[expected_failure(abort_code = E_INVALID_FEE, location = Self)]
    fun rejects_invalid_fee() {
        fee_for(100, BPS_DENOMINATOR);
    }

    #[test(core = @0x1, admin = @forge, buyer = @0xb0b, seller = @0xbeef, treasury = @0xfee)]
    fun settles_and_splits_payment(
        core: &signer,
        admin: &signer,
        buyer: &signer,
        seller: &signer,
        treasury: &signer,
    ) acquires ForgePlatform {
        timestamp::set_time_has_started_for_testing(core);
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(core);
        aptos_account::create_account(signer::address_of(buyer));
        aptos_account::create_account(signer::address_of(seller));
        aptos_account::create_account(signer::address_of(treasury));
        coin::deposit(signer::address_of(buyer), coin::mint(10_000, &mint_cap));
        initialize_platform(admin, signer::address_of(treasury));

        settle_purchase(
            buyer,
            signer::address_of(seller),
            1_000,
            b"intent-1",
            b"product-1",
            b"version-1",
            b"nonce-1",
            x"0000000000000000000000000000000000000000000000000000000000000001",
            100,
        );

        assert!(coin::balance<AptosCoin>(signer::address_of(seller)) == 950, 110);
        assert!(coin::balance<AptosCoin>(signer::address_of(treasury)) == 50, 111);
        assert!(nonce_used(b"nonce-1"), 112);
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(core = @0x1, admin = @forge, buyer = @0xb0b, seller = @0xbeef, treasury = @0xfee)]
    #[expected_failure(abort_code = E_NONCE_ALREADY_USED, location = Self)]
    fun rejects_nonce_replay(
        core: &signer,
        admin: &signer,
        buyer: &signer,
        seller: &signer,
        treasury: &signer,
    ) acquires ForgePlatform {
        timestamp::set_time_has_started_for_testing(core);
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(core);
        aptos_account::create_account(signer::address_of(buyer));
        aptos_account::create_account(signer::address_of(seller));
        aptos_account::create_account(signer::address_of(treasury));
        coin::deposit(signer::address_of(buyer), coin::mint(10_000, &mint_cap));
        initialize_platform(admin, signer::address_of(treasury));
        settle_purchase(
            buyer, signer::address_of(seller), 1_000, b"intent-1", b"product-1",
            b"version-1", b"same-nonce",
            x"0000000000000000000000000000000000000000000000000000000000000001", 100,
        );
        settle_purchase(
            buyer, signer::address_of(seller), 1_000, b"intent-2", b"product-1",
            b"version-1", b"same-nonce",
            x"0000000000000000000000000000000000000000000000000000000000000002", 100,
        );
        // Unreachable (the second settlement aborts) but capabilities can't be dropped.
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(core = @0x1, owner = @0xda7a)]
    fun anchors_provenance(core: &signer, owner: &signer) {
        timestamp::set_time_has_started_for_testing(core);
        anchor_provenance(
            owner,
            b"dataset-1",
            1,
            x"0000000000000000000000000000000000000000000000000000000000000001",
            x"0000000000000000000000000000000000000000000000000000000000000002",
            x"0000000000000000000000000000000000000000000000000000000000000003",
        );
    }

    #[test(core = @0x1, owner = @0xda7a)]
    #[expected_failure(abort_code = E_EMPTY_IDENTIFIER, location = Self)]
    fun rejects_short_seal_hash(core: &signer, owner: &signer) {
        timestamp::set_time_has_started_for_testing(core);
        anchor_provenance(
            owner,
            b"dataset-1",
            1,
            x"0000000000000000000000000000000000000000000000000000000000000001",
            x"0000000000000000000000000000000000000000000000000000000000000002",
            x"03",
        );
    }

    #[test(rogue = @0x123, treasury = @0xfee)]
    #[expected_failure(abort_code = E_NOT_MODULE_ADMIN, location = Self)]
    fun rejects_unauthorized_initialization(rogue: &signer, treasury: &signer) {
        initialize_platform(rogue, signer::address_of(treasury));
    }
}
