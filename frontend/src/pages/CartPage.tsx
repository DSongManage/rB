/**
 * Cart Page Component
 *
 * Full shopping cart view with items, totals, savings, and checkout.
 * Uses dual payment system: Balance, Coinbase Onramp, or Direct Crypto.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, Wallet, ArrowLeft, Heart, AlertCircle, BookOpen, Loader2, X, ExternalLink, CheckCircle2, Shield } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useBalance } from '../contexts/BalanceContext';
import { API_URL } from '../config';
import { paymentApi, PurchaseIntentResponse } from '../services/paymentApi';
import { signMessageForSponsoredTx, getTransactionExplorerLink, getConnectedPublicKey } from '../services/web3authService';
import {
  BalanceDisplay,
  PaymentOptionsSelector,
  CoinbaseOnrampWidget,
  DirectCryptoPaymentModal,
} from '../components/payment';

// Payment flow states
type PaymentStep = 'idle' | 'creating_intent' | 'selecting_method' | 'confirm_balance' | 'signing' | 'submitting' | 'coinbase' | 'direct_crypto' | 'success' | 'error';

export default function CartPage() {
  const { cart, loading, error, removeFromCart, clearCart, refreshCart } = useCart();
  const { forceSync: refreshBalance } = useBalance();  // Use forceSync after purchases to get updated balance
  const [removingId, setRemovingId] = useState<number | null>(null);
  const navigate = useNavigate();

  // Payment flow state
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('idle');
  const [purchaseIntent, setPurchaseIntent] = useState<PurchaseIntentResponse | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'balance' | 'coinbase' | 'direct_crypto' | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [balancePaymentData, setBalancePaymentData] = useState<any>(null);

  async function handleRemove(itemId: number) {
    setRemovingId(itemId);
    await removeFromCart(itemId);
    setRemovingId(null);
  }

  // Start the checkout flow - create purchase intent
  async function handleCheckout() {
    setPaymentStep('creating_intent');
    setPaymentError(null);

    try {
      const intent = await paymentApi.createIntent({ cart: true });
      setPurchaseIntent(intent);
      setPaymentStep('selecting_method');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout';
      setPaymentError(message);
      setPaymentStep('error');
    }
  }

  // Handle payment method selection
  async function handleSelectPaymentMethod(method: 'balance' | 'coinbase' | 'direct_crypto') {
    if (!purchaseIntent) return;

    setSelectedMethod(method);
    setPaymentError(null);

    try {
      // Notify backend of selection
      await paymentApi.selectPaymentMethod(purchaseIntent.intent_id, method);

      if (method === 'balance') {
        // Show confirmation modal immediately (don't get transaction yet - blockhash will expire)
        setPaymentStep('confirm_balance');
        // Set placeholder data for display - actual transaction fetched on confirm
        setBalancePaymentData({ amount: purchaseIntent.total_amount });
      } else if (method === 'coinbase') {
        setPaymentStep('coinbase');
      } else if (method === 'direct_crypto') {
        setPaymentStep('direct_crypto');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to select payment method';
      setPaymentError(message);
      setPaymentStep('error');
    }
  }

  // User confirmed - NOW get fresh transaction, sign, and submit immediately
  async function handleConfirmBalancePayment() {
    if (!purchaseIntent) return;

    setPaymentStep('signing');
    setProcessingMessage('Preparing transaction...');

    try {
      // Get fresh transaction with current blockhash RIGHT before signing
      const paymentData = await paymentApi.payWithBalance(purchaseIntent.intent_id);

      // SECURITY: Validate Web3Auth session matches expected user wallet
      // This prevents signing with a stale session from a different user
      const connectedPubkey = await getConnectedPublicKey();
      const expectedPubkey = paymentData.user_pubkey;

      if (connectedPubkey.toBase58() !== expectedPubkey) {
        throw new Error(
          'Wallet session mismatch detected. Please logout and login again to refresh your wallet session.'
        );
      }

      setProcessingMessage('Please approve in your wallet...');

      // Sign the transaction immediately while blockhash is fresh
      const { signedTransaction, userSignatureIndex } = await signMessageForSponsoredTx(
        paymentData.serialized_transaction
      );

      setPaymentStep('submitting');
      setProcessingMessage('Submitting to blockchain...');

      // Submit to backend immediately
      const result = await paymentApi.submitSponsoredPayment(
        purchaseIntent.intent_id,
        signedTransaction,
        userSignatureIndex
      );

      // Store the signature for success screen
      setTransactionSignature(result.signature);

      // Clear cart and refresh balance
      await clearCart();
      await refreshBalance();

      setPaymentStep('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';

      // Check if this is a network error that might have occurred AFTER the transaction was submitted
      // The blockchain transaction may have succeeded even though we lost connection
      const isNetworkError = message.includes('Failed to fetch') ||
                            message.includes('network') ||
                            message.includes('timeout') ||
                            message.includes('NetworkError');

      if (isNetworkError && purchaseIntent) {
        try {
          setProcessingMessage('Connection lost. Checking transaction status...');

          // Wait a moment for the backend to finish processing
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Check if the transaction actually succeeded despite the network error
          const status = await paymentApi.getIntentStatus(purchaseIntent.intent_id);

          if (status.status === 'completed' || status.status === 'payment_received') {
            // Transaction succeeded! Recover gracefully
            console.log('Payment recovered after network error:', status);

            // Set the signature for the success screen
            if (status.solana_tx_signature) {
              setTransactionSignature(status.solana_tx_signature);
            }

            // Clear cart and refresh balance
            await clearCart();
            await refreshBalance();

            setPaymentStep('success');
            return;
          }

          // If still processing, give it more time
          if (status.status === 'processing') {
            setProcessingMessage('Transaction submitted. Waiting for confirmation...');

            // Poll a few more times
            for (let i = 0; i < 5; i++) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              const retryStatus = await paymentApi.getIntentStatus(purchaseIntent.intent_id);

              if (retryStatus.status === 'completed' || retryStatus.status === 'payment_received') {
                if (retryStatus.solana_tx_signature) {
                  setTransactionSignature(retryStatus.solana_tx_signature);
                }
                await clearCart();
                await refreshBalance();
                setPaymentStep('success');
                return;
              }

              if (retryStatus.status === 'failed') {
                setPaymentError(retryStatus.failure_reason || 'Payment failed after submission');
                setPaymentStep('error');
                return;
              }
            }

            // Still processing after polling - show success with note
            // The transaction was submitted, backend is processing
            await clearCart();
            await refreshBalance();
            setPaymentStep('success');
            return;
          }
        } catch (statusErr) {
          console.error('Could not check payment status after network error:', statusErr);
          // Fall through to show original error
        }
      }

      setPaymentError(message);
      setPaymentStep('error');
    }
  }

  // Handle successful payment (from any method)
  async function handlePaymentSuccess() {
    // Clear cart immediately and refresh balance
    await clearCart();
    await refreshBalance();
    setPaymentStep('success');
  }

  // Handle payment cancellation
  function handlePaymentCancel() {
    setPaymentStep('idle');
    setPurchaseIntent(null);
    setSelectedMethod(null);
  }

  // Handle payment error
  function handlePaymentError(errorMessage: string) {
    setPaymentError(errorMessage);
    setPaymentStep('error');
  }

  // Reset payment flow
  function resetPaymentFlow() {
    setPaymentStep('idle');
    setPurchaseIntent(null);
    setSelectedMethod(null);
    setPaymentError(null);
    setTransactionSignature(null);
    setBalancePaymentData(null);
    setProcessingMessage('');
  }

  async function handleClear() {
    if (window.confirm('Remove all items from your cart?')) {
      await clearCart();
    }
  }

  if (loading) {
    return (
      <div className="rb-cart-page rb-cart-page--loading" style={{
        padding: '60px 20px',
        textAlign: 'center',
        color: 'var(--text-muted, #94a3b8)',
      }}>
        <ShoppingCart size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
        <div>Loading cart...</div>
      </div>
    );
  }

  if (!cart || cart.item_count === 0) {
    return (
      <div className="rb-cart-page rb-cart-page--empty" style={{
        padding: '60px 20px',
        textAlign: 'center',
        maxWidth: '500px',
        margin: '0 auto',
      }}>
        <ShoppingCart size={64} style={{ opacity: 0.3, marginBottom: '24px' }} />
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>
          Your Cart is Empty
        </h1>
        <p style={{ color: 'var(--text-muted, #94a3b8)', marginBottom: '32px' }}>
          Browse chapters and add them to your cart to purchase multiple items at once.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 28px',
            backgroundColor: 'var(--accent, #3b82f6)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} />
          Browse Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="rb-cart-page" style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '40px 20px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
          Shopping Cart
        </h1>
        <p style={{ color: 'var(--text-muted, #94a3b8)' }}>
          {cart.item_count} {cart.item_count === 1 ? 'item' : 'items'} in your cart
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px' }}>
        {/* Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cart.items.map(item => {
            // Build cover URL - handle relative paths from Django
            let coverSrc = null;
            if (item.cover_url) {
              coverSrc = item.cover_url.startsWith('http')
                ? item.cover_url
                : `${API_URL}${item.cover_url}`;
            }

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-secondary, #1e293b)',
                  borderRadius: '12px',
                  border: '1px solid var(--border, #334155)',
                  opacity: removingId === item.id ? 0.5 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {/* Cover Image */}
                <div style={{
                  width: '80px',
                  height: '100px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-tertiary, #0f172a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt={item.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <BookOpen size={32} style={{ color: 'var(--text-muted, #64748b)', opacity: 0.5 }} />
                  )}
                </div>

                {/* Item Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.title}
                  </h3>
                  {item.book_title && (
                    <p style={{
                      fontSize: '13px',
                      color: 'var(--text-muted, #94a3b8)',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.book_title} &bull; Chapter {item.chapter_order}
                    </p>
                  )}
                  <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
                    By @{item.creator_username}
                  </p>
                </div>

                {/* Price and Actions */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent, #3b82f6)' }}>
                    ${item.unit_price}
                  </span>
                  <button
                    onClick={() => handleRemove(item.id)}
                    disabled={removingId === item.id}
                    style={{
                      padding: '8px',
                      backgroundColor: 'transparent',
                      color: 'var(--text-error, #ef4444)',
                      border: '1px solid var(--text-error, #ef4444)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      opacity: removingId === item.id ? 0.5 : 1,
                    }}
                    title="Remove from cart"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Clear Cart */}
          <button
            onClick={handleClear}
            style={{
              alignSelf: 'flex-start',
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: 'var(--text-muted, #94a3b8)',
              border: '1px solid var(--border, #334155)',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            Clear Cart
          </button>
        </div>

        {/* Order Summary */}
        <div style={{
          padding: '24px',
          backgroundColor: 'var(--bg-secondary, #1e293b)',
          borderRadius: '16px',
          border: '1px solid var(--border, #334155)',
          height: 'fit-content',
          position: 'sticky',
          top: '100px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>
            Order Summary
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>
                {cart.item_count} {cart.item_count === 1 ? 'item' : 'items'}
              </span>
              <span>${cart.subtotal}</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '16px',
              borderTop: '1px solid var(--border, #334155)',
              fontSize: '20px',
              fontWeight: 700,
            }}>
              <span>Total</span>
              <span style={{ color: 'var(--accent, #3b82f6)' }}>${cart.subtotal}</span>
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: 'var(--bg-error, #450a0a)',
              border: '1px solid var(--border-error, #ef4444)',
              borderRadius: '8px',
              color: 'var(--text-error, #fca5a5)',
              fontSize: '14px',
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={paymentStep !== 'idle'}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '16px 24px',
              backgroundColor: paymentStep !== 'idle' ? 'var(--bg-disabled, #475569)' : 'var(--accent, #3b82f6)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: paymentStep !== 'idle' ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
            }}
          >
            {paymentStep === 'creating_intent' ? (
              <>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                Loading...
              </>
            ) : (
              <>
                <Wallet size={20} />
                Checkout - ${cart.subtotal}
              </>
            )}
          </button>

          {/* Creator Support Message */}
          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: 'var(--bg-tertiary, #0f172a)',
            borderRadius: '10px',
            fontSize: '13px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Heart size={16} style={{ color: 'var(--text-success, #10b981)' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-success, #10b981)' }}>
                Supporting Creators
              </span>
            </div>
            <p style={{ color: 'var(--text-muted, #94a3b8)', lineHeight: '1.5' }}>
              Creators receive 90% of each item's price. Your purchase directly supports the creators you love.
            </p>
          </div>

          {/* Balance Display */}
          <div style={{ marginTop: '12px' }}>
            <BalanceDisplay size="small" showLabel={true} compact={false} />
          </div>
        </div>
      </div>

      {/* Payment Method Selector Modal */}
      {paymentStep === 'selecting_method' && purchaseIntent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary, #0f172a)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '480px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              border: '1px solid var(--border, #334155)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #f1f5f9)',
                }}
              >
                Choose Payment Method
              </h2>
              <button
                onClick={handlePaymentCancel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-muted, #94a3b8)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <PaymentOptionsSelector
              intent={purchaseIntent}
              onSelect={handleSelectPaymentMethod}
              loading={false}
              selectedMethod={selectedMethod}
            />
          </div>
        </div>
      )}

      {/* Balance Confirmation Modal - Shows transaction details before signing */}
      {paymentStep === 'confirm_balance' && purchaseIntent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary, #0f172a)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '440px',
              width: '100%',
              border: '1px solid var(--border, #334155)',
            }}
          >
            {!balancePaymentData ? (
              // Loading state while fetching transaction
              <div style={{ textAlign: 'center' }}>
                <Loader2
                  size={48}
                  style={{
                    color: 'var(--accent, #3b82f6)',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '16px',
                  }}
                />
                <h3 style={{ color: 'var(--text-primary, #f1f5f9)', fontSize: '18px', margin: '0 0 8px' }}>
                  Preparing Transaction
                </h3>
                <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: 0 }}>
                  Setting up your payment...
                </p>
              </div>
            ) : (
              // Confirmation UI
              <>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <Shield size={28} style={{ color: '#3b82f6' }} />
                  </div>
                  <h3 style={{ color: 'var(--text-primary, #f1f5f9)', fontSize: '20px', margin: '0 0 8px' }}>
                    Confirm Payment
                  </h3>
                  <p style={{ color: 'var(--text-secondary, #94a3b8)', margin: 0, fontSize: '14px' }}>
                    Review your purchase details before signing
                  </p>
                </div>

                {/* Transaction Details */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary, #1e293b)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '14px' }}>Items</span>
                    <span style={{ color: 'var(--text-primary, #f1f5f9)', fontSize: '14px' }}>
                      {cart?.item_count || 1} {(cart?.item_count || 1) === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '14px' }}>Amount</span>
                    <span style={{ color: 'var(--accent, #3b82f6)', fontSize: '18px', fontWeight: 700 }}>
                      ${balancePaymentData.amount} USDC
                    </span>
                  </div>
                  <div
                    style={{
                      borderTop: '1px solid var(--border, #334155)',
                      paddingTop: '12px',
                      marginTop: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '13px' }}>Network Fee</span>
                      <span style={{ color: 'var(--text-success, #22c55e)', fontSize: '13px', fontWeight: 500 }}>
                        FREE (paid by platform)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Creator Support Note */}
                <div
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Heart size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary, #cbd5e1)', fontSize: '13px' }}>
                    90% goes directly to the creators
                  </span>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handlePaymentCancel}
                    style={{
                      flex: 1,
                      padding: '14px 20px',
                      backgroundColor: 'var(--bg-secondary, #1e293b)',
                      color: 'var(--text-primary, #f1f5f9)',
                      border: '1px solid var(--border, #334155)',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmBalancePayment}
                    style={{
                      flex: 2,
                      padding: '14px 20px',
                      backgroundColor: 'var(--accent, #3b82f6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <Wallet size={18} />
                    Sign & Pay
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Signing/Submitting Modal */}
      {(paymentStep === 'signing' || paymentStep === 'submitting') && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary, #0f172a)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '400px',
              width: '100%',
              textAlign: 'center',
              border: '1px solid var(--border, #334155)',
            }}
          >
            <Loader2
              size={48}
              style={{
                color: 'var(--accent, #3b82f6)',
                animation: 'spin 1s linear infinite',
                marginBottom: '16px',
              }}
            />
            <h3
              style={{
                color: 'var(--text-primary, #f1f5f9)',
                fontSize: '18px',
                margin: '0 0 8px',
              }}
            >
              {paymentStep === 'signing' ? 'Awaiting Signature' : 'Processing Payment'}
            </h3>
            <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: 0 }}>
              {processingMessage}
            </p>
            {paymentStep === 'signing' && (
              <p style={{ color: 'var(--text-muted, #64748b)', margin: '16px 0 0', fontSize: '13px' }}>
                Check for a Web3Auth popup window
              </p>
            )}
          </div>
        </div>
      )}

      {/* Coinbase Onramp Widget */}
      {paymentStep === 'coinbase' && purchaseIntent && (
        <CoinbaseOnrampWidget
          intentId={purchaseIntent.intent_id}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
          onError={handlePaymentError}
        />
      )}

      {/* Direct Crypto Payment Modal */}
      {paymentStep === 'direct_crypto' && purchaseIntent && (
        <DirectCryptoPaymentModal
          intentId={purchaseIntent.intent_id}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
          onError={handlePaymentError}
        />
      )}

      {/* Success Modal */}
      {paymentStep === 'success' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary, #0f172a)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '440px',
              width: '100%',
              textAlign: 'center',
              border: '1px solid var(--border, #334155)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <CheckCircle2 size={36} style={{ color: '#22c55e' }} />
            </div>
            <h3
              style={{
                color: 'var(--text-primary, #f1f5f9)',
                fontSize: '22px',
                margin: '0 0 8px',
              }}
            >
              Purchase Complete!
            </h3>
            <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: '0 0 20px' }}>
              Your items have been added to your library.
            </p>

            {/* Transaction Link */}
            {transactionSignature && (
              <a
                href={getTransactionExplorerLink(transactionSignature)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  backgroundColor: 'var(--bg-secondary, #1e293b)',
                  border: '1px solid var(--border, #334155)',
                  borderRadius: '8px',
                  color: 'var(--text-muted, #94a3b8)',
                  fontSize: '13px',
                  textDecoration: 'none',
                  marginBottom: '20px',
                }}
              >
                <span>View on Solana Explorer</span>
                <ExternalLink size={14} />
              </a>
            )}

            {/* Creator Support Confirmation */}
            <div
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Heart size={16} style={{ color: '#22c55e' }} />
              <span style={{ color: '#22c55e', fontSize: '14px', fontWeight: 500 }}>
                You supported the creators!
              </span>
            </div>

            <button
              onClick={() => {
                resetPaymentFlow();
                navigate('/dashboard');
              }}
              style={{
                width: '100%',
                padding: '14px 24px',
                backgroundColor: 'var(--accent, #3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <BookOpen size={18} />
              Go to Library
            </button>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {paymentStep === 'error' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary, #0f172a)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '400px',
              width: '100%',
              textAlign: 'center',
              border: '1px solid var(--border, #334155)',
            }}
          >
            <AlertCircle
              size={48}
              style={{
                color: 'var(--error, #ef4444)',
                marginBottom: '16px',
              }}
            />
            <h3
              style={{
                color: 'var(--text-primary, #f1f5f9)',
                fontSize: '18px',
                margin: '0 0 8px',
              }}
            >
              Payment Failed
            </h3>
            <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: '0 0 24px' }}>
              {paymentError || 'Something went wrong with your payment.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setPaymentError(null);
                  setPaymentStep('selecting_method');
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--accent, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <button
                onClick={resetPaymentFlow}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--bg-secondary, #1e293b)',
                  color: 'var(--text-primary, #f1f5f9)',
                  border: '1px solid var(--border, #334155)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
