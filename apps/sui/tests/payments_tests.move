#[test_only]
module genie_payments::payments_tests;

use genie_payments::payments;
use std::string;
use sui::clock;
use sui::coin::Coin;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;

const SENDER: address = @0xA11CE;
const RECIPIENT: address = @0xB0B;

#[test]
fun payment_creates_sender_receipt_and_transfers_coin() {
    let mut scenario = ts::begin(SENDER);
    let clock = clock::create_for_testing(scenario.ctx());
    let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());

    let receipt = payments::pay_sui(
        payment,
        RECIPIENT,
        string::utf8(b"payment-123"),
        string::utf8(b"Dinner"),
        &clock,
        scenario.ctx(),
    );
    transfer::public_transfer(receipt, SENDER);
    clock::destroy_for_testing(clock);

    scenario.next_tx(SENDER);
    let receipt = scenario.take_from_sender<payments::PaymentReceipt>();
    assert!(payments::sender(&receipt) == SENDER);
    assert!(payments::recipient(&receipt) == RECIPIENT);
    assert!(payments::amount_mist(&receipt) == 1_000_000_000);
    assert!(payments::payment_id(&receipt) == &string::utf8(b"payment-123"));
    assert!(payments::memo(&receipt) == &string::utf8(b"Dinner"));
    scenario.return_to_sender(receipt);

    scenario.next_tx(RECIPIENT);
    let received = scenario.take_from_sender<Coin<SUI>>();
    assert!(received.value() == 1_000_000_000);
    scenario.return_to_sender(received);
    scenario.end();
}

#[test, expected_failure(abort_code = 0, location = payments)]
fun zero_amount_is_rejected() {
    let mut scenario = ts::begin(SENDER);
    let clock = clock::create_for_testing(scenario.ctx());
    let payment = coin::mint_for_testing<SUI>(0, scenario.ctx());

    let receipt = payments::pay_sui(
        payment,
        RECIPIENT,
        string::utf8(b"payment-123"),
        string::utf8(b""),
        &clock,
        scenario.ctx(),
    );
    transfer::public_transfer(receipt, SENDER);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test, expected_failure(abort_code = 3, location = payments)]
fun zero_address_recipient_is_rejected() {
    let mut scenario = ts::begin(SENDER);
    let clock = clock::create_for_testing(scenario.ctx());
    let payment = coin::mint_for_testing<SUI>(1, scenario.ctx());

    let receipt = payments::pay_sui(
        payment,
        @0x0,
        string::utf8(b"payment-123"),
        string::utf8(b""),
        &clock,
        scenario.ctx(),
    );
    transfer::public_transfer(receipt, SENDER);
    clock::destroy_for_testing(clock);
    scenario.end();
}
