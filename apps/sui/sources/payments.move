module genie_payments::payments;

use std::string::String;
use sui::clock::Clock;
use sui::coin::Coin;
use sui::event;
use sui::sui::SUI;

const EZeroAmount: u64 = 0;
const EEmptyPaymentId: u64 = 1;
const EMemoTooLong: u64 = 2;
const EInvalidRecipient: u64 = 3;
const MAX_MEMO_BYTES: u64 = 280;

/// An owned, queryable proof that Genie routed a payment.
public struct PaymentReceipt has key, store {
    id: UID,
    payment_id: String,
    sender: address,
    recipient: address,
    amount_mist: u64,
    memo: String,
    timestamp_ms: u64,
}

/// Emitted once for every successful Genie payment.
public struct PaymentSent has copy, drop {
    receipt_id: ID,
    payment_id: String,
    sender: address,
    recipient: address,
    amount_mist: u64,
    memo: String,
    timestamp_ms: u64,
}

/// Transfers SUI and gives the sender a permanent receipt object in one atomic transaction.
public fun pay_sui(
    payment: Coin<SUI>,
    recipient: address,
    payment_id: String,
    memo: String,
    clock: &Clock,
    ctx: &mut TxContext,
): PaymentReceipt {
    let amount_mist = payment.value();
    assert!(amount_mist > 0, EZeroAmount);
    assert!(recipient != @0x0, EInvalidRecipient);
    assert!(!payment_id.as_bytes().is_empty(), EEmptyPaymentId);
    assert!(memo.as_bytes().length() <= MAX_MEMO_BYTES, EMemoTooLong);

    let sender = ctx.sender();
    let timestamp_ms = clock.timestamp_ms();
    let receipt = PaymentReceipt {
        id: object::new(ctx),
        payment_id,
        sender,
        recipient,
        amount_mist,
        memo,
        timestamp_ms,
    };
    let receipt_id = receipt.id.to_inner();

    event::emit(PaymentSent {
        receipt_id,
        payment_id,
        sender,
        recipient,
        amount_mist,
        memo,
        timestamp_ms,
    });

    transfer::public_transfer(payment, recipient);
    receipt
}

public fun payment_id(receipt: &PaymentReceipt): &String {
    &receipt.payment_id
}

public fun sender(receipt: &PaymentReceipt): address {
    receipt.sender
}

public fun recipient(receipt: &PaymentReceipt): address {
    receipt.recipient
}

public fun amount_mist(receipt: &PaymentReceipt): u64 {
    receipt.amount_mist
}

public fun memo(receipt: &PaymentReceipt): &String {
    &receipt.memo
}

public fun timestamp_ms(receipt: &PaymentReceipt): u64 {
    receipt.timestamp_ms
}
