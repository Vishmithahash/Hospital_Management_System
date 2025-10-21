import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../app/store';
import apiClient from '../../app/apiClient';
import { toastError, toastInfo, toastSuccess, toastWarning } from '../../app/toastHelpers';
import { downloadBlob, formatCurrency, formatDateTime } from '../../lib/formatters';

const Steps = {
  BILL: 'bill',
  SUMMARY: 'summary',
  METHOD: 'method',
  CARD: 'card',
  RESULT: 'result'
};

const METHOD_CARD = 'CARD';
const METHOD_CASH = 'CASH';
const METHOD_GOV = 'GOVERNMENT';

const CARD_STORAGE_KEY = 'hospitalms_saved_cards';
const TEST_CARD_OPTIONS = [
  { label: 'Visa **** 1111 (Sample success)', value: '4111111111111111' },
  { label: 'Visa **** 0002 (Decline test)', value: '4000000000000002' },
  { label: 'Visa **** 8084 (Gateway error test)', value: '4084084084084084' }
];

const METHOD_OPTIONS = [
  {
    id: METHOD_GOV,
    label: 'Gov Cover',
    description: 'Pay with your government health coverage'
  },
  {
    id: 'INSURANCE',
    label: 'Insurance',
    description: 'Insurance has already been applied automatically',
    disabled: true
  },
  {
    id: METHOD_CARD,
    label: 'Card',
    description: 'Pay with your credit or debit card'
  },
  {
    id: METHOD_CASH,
    label: 'Cash',
    description: 'Pay in person with cash'
  },
  {
    id: 'SPLIT',
    label: 'Split',
    description: 'Split the bill between multiple payment methods',
    disabled: true
  }
];

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPatient = user?.role === 'patient';
  const isStaff = user?.role === 'staff';
  const isDoctor = user?.role === 'doctor';

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [bill, setBill] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  const [step, setStep] = useState(Steps.BILL);
  const [selectedMethod, setSelectedMethod] = useState(METHOD_CARD);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [rememberCard, setRememberCard] = useState(true);
  const [storedCards, setStoredCards] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(CARD_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sanitized = parsed
          .filter((value) => typeof value === 'string')
          .map((value) => value.replace(/\s+/g, ''))
          .filter((value) => value);
        if (sanitized.length) {
          setStoredCards(Array.from(new Set(sanitized)));
        }
      }
    } catch (_) {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(storedCards));
  }, [storedCards]);

  const addStoredCard = useCallback((rawNumber) => {
    if (!rawNumber) return;
    const normalized = rawNumber.replace(/\s+/g, '');
    if (!normalized || normalized.length < 4) return;
    if (TEST_CARD_OPTIONS.some((option) => option.value === normalized)) {
      return;
    }
    setStoredCards((prev) => {
      if (prev.includes(normalized)) {
        return prev;
      }
      const next = [...prev, normalized];
      return next;
    });
  }, []);

  const savedCardOptions = useMemo(() => {
    const options = [{ label: 'Use a new card', value: '' }];
    storedCards.forEach((value) => {
      options.push({ label: `Saved **** ${value.slice(-4)}`, value });
    });
    options.push(...TEST_CARD_OPTIONS);
    return options;
  }, [storedCards]);
  useEffect(() => {
    if (isPatient && user?.linkedPatientId) {
      setSelectedPatientId(user.linkedPatientId);
      return;
    }
    const param = searchParams.get('patientId');
    if (param) {
      setSelectedPatientId(param);
    }
  }, [isPatient, searchParams, user]);

  useEffect(() => {
    if (!user) return;
    if (isPatient) return;
    if (selectedPatientId) {
      setSearchParams({ patientId: selectedPatientId });
    } else {
      setSearchParams({});
    }
  }, [selectedPatientId, setSearchParams, user, isPatient]);

  useEffect(() => {
    if (isPatient) {
      setSelectedMethod(METHOD_CARD);
    } else if (isStaff) {
      setSelectedMethod(METHOD_CARD);
    } else {
      setSelectedMethod('');
    }
  }, [isPatient, isStaff]);

  const canUseCard = useMemo(() => ['patient', 'staff'].includes(user?.role), [user?.role]);
  const canUseCash = useMemo(() => ['staff'].includes(user?.role), [user?.role]);
  const canUseGovernment = useMemo(
    () => !!bill?.governmentCover && ['staff'].includes(user?.role),
    [bill?.governmentCover, user?.role]
  );

  const coverageAmount = bill ? bill.subtotal - bill.totalPayable : 0;
  const outstanding = bill ? bill.totalPayable : 0;

  const resetCardForm = () => {
    setCardNumber('');
    setExpMonth('');
    setExpYear('');
    setCvc('');
  };

  const loadBill = useCallback(
    async (build = false) => {
      if (!selectedPatientId) {
        setBill(null);
        return;
      }
      setBillLoading(true);
      try {
        const endpoint = build
          ? `/billing/patient/${selectedPatientId}/build-latest`
          : `/billing/patient/${selectedPatientId}/current`;
        const { data } = await apiClient.get(endpoint, { skipErrorToast: true });
        setBill(data || null);
        if (build) {
          setStep(Steps.BILL);
          setResult(null);
        }
      } catch (error) {
        const message = error.response?.data?.message || 'Unable to load billing details';
        toastError(message);
      } finally {
        setBillLoading(false);
      }
    },
    [selectedPatientId]
  );

  useEffect(() => {
    if (selectedPatientId) {
      loadBill(false);
    }
  }, [selectedPatientId, loadBill]);

  const handleRefreshBill = async () => {
    if (!selectedPatientId) {
      toastInfo('Enter a patient id to refresh billing');
      return;
    }
    await loadBill(true);
  };

  const handleGoToSummary = () => {
    if (!bill) {
      toastInfo('No bill available. Refresh to build one.');
      return;
    }
    setStep(Steps.SUMMARY);
  };

  const handleGoToMethod = () => {
    if (isDoctor) {
      toastInfo('Doctors have read-only access to billing.');
      return;
    }
    setStep(Steps.METHOD);
  };
  const handleMethodContinue = async () => {
    if (!selectedMethod) {
      toastWarning('Select a payment method to continue.');
      return;
    }
    if (selectedMethod === METHOD_CARD) {
      if (outstanding <= 0) {
        toastInfo('No balance due. Government or insurance already covers this bill.');
        return;
      }
      setStep(Steps.CARD);
      return;
    }
    if (selectedMethod === METHOD_CASH) {
      if (!canUseCash) {
        toastWarning('Cash payments are restricted to billing staff.');
        return;
      }
      await handleCashPayment();
      return;
    }
    if (selectedMethod === METHOD_GOV) {
      if (!canUseGovernment) {
        toastWarning('Government cover is unavailable for this patient.');
        return;
      }
      await handleGovernmentPayment();
      return;
    }
    toastInfo('Insurance adjustments are already reflected in the bill.');
  };

  const handleCardPayment = async () => {
    if (!bill) return;
    if (!cardNumber || !expMonth || !expYear || !cvc) {
      toastWarning('Enter complete card details.');
      return;
    }
    setProcessing(true);
    try {
      const normalizedCard = cardNumber.replace(/\s+/g, '');
      const { data } = await apiClient.post(
        '/payments/card',
        {
          billId: bill._id,
          cardNumber: normalizedCard,
          expMonth,
          expYear,
          cvc
        },
        { skipErrorToast: true }
      );
      toastSuccess('Payment successful');
      if (rememberCard) {
        addStoredCard(normalizedCard);
      }
      resetCardForm();
      setResult({
        status: 'success',
        payment: data.payment,
        receipt: data.receipt,
        method: METHOD_CARD
      });
      setStep(Steps.RESULT);
      await loadBill(false);
    } catch (error) {
      const status = error.response?.status;
      const message =
        error.response?.data?.message ||
        (status === 402
          ? 'Your card was declined. Please try a different card.'
          : status === 503
          ? 'Payment gateway temporarily unavailable.'
          : 'Failed to process card payment.');
      setResult({
        status: 'error',
        method: METHOD_CARD,
        message
      });
      setStep(Steps.RESULT);
    } finally {
      setProcessing(false);
    }
  };

  const handleCashPayment = async () => {
    if (!bill) return;
    setProcessing(true);
    try {
      const { data } = await apiClient.post(
        '/payments/cash',
        { billId: bill._id, amount: bill.totalPayable },
        { skipErrorToast: true }
      );
      toastSuccess('Cash payment recorded');
      setResult({
        status: 'success',
        payment: data.payment,
        receipt: data.receipt,
        method: METHOD_CASH
      });
      setStep(Steps.RESULT);
      await loadBill(false);
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to record cash payment.';
      setResult({
        status: 'error',
        method: METHOD_CASH,
        message
      });
      setStep(Steps.RESULT);
    } finally {
      setProcessing(false);
    }
  };

  const handleGovernmentPayment = async () => {
    if (!bill) return;
    setProcessing(true);
    try {
      const { data } = await apiClient.post(
        '/payments/government',
        { billId: bill._id },
        { skipErrorToast: true }
      );
      toastSuccess('Government cover applied');
      setResult({
        status: 'success',
        payment: data.payment,
        receipt: data.receipt,
        method: METHOD_GOV
      });
      setStep(Steps.RESULT);
      await loadBill(false);
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to record government cover.';
      setResult({
        status: 'error',
        method: METHOD_GOV,
        message
      });
      setStep(Steps.RESULT);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = async () => {
    setResult(null);
    setStep(Steps.BILL);
    await loadBill(false);
  };

  const handleRetry = () => {
    if (result?.method === METHOD_CARD) {
      setResult(null);
      setStep(Steps.CARD);
      return;
    }
    setResult(null);
    setStep(Steps.METHOD);
  };

  const handleDownloadReceipt = useCallback(() => {
    if (!result?.receipt) {
      toastWarning('Receipt is not available yet.');
      return;
    }
    const payload = result.receipt.payload || {};
    const items = payload.items || [];
    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${result.receipt.receiptNumber}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      h1 { font-size: 22px; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #dfe4ea; padding: 8px; text-align: left; }
      th { background: #f1f5f9; }
    </style>
  </head>
  <body>
    <h1>Receipt ${result.receipt.receiptNumber}</h1>
    <p><strong>Bill ID:</strong> ${payload.billId || ''}</p>
    <p><strong>Payment Method:</strong> ${payload.method || ''}</p>
    <p><strong>Amount Paid:</strong> ${formatCurrency(payload.totalPaid || 0)}</p>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Unit Price</th>
          <th>Insurance Discount</th>
          <th>Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
          <tr>
            <td>${item.description}</td>
            <td>${formatCurrency(item.unitPrice || 0)}</td>
            <td>${formatCurrency(item.insuranceDiscount || 0)}</td>
            <td>${formatCurrency(item.lineTotal || 0)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </body>
</html>`;
    downloadBlob(html, `receipt-${result.receipt.receiptNumber}.html`, 'text/html');
  }, [result]);
  const availabilityByMethod = useMemo(
    () => ({
      [METHOD_GOV]: canUseGovernment,
      [METHOD_CARD]: canUseCard,
      [METHOD_CASH]: canUseCash,
      INSURANCE: false,
      SPLIT: false
    }),
    [canUseCard, canUseCash, canUseGovernment]
  );

  const renderStep = () => {
    switch (step) {
      case Steps.BILL:
        return (
          <BillDetailsStep
            bill={bill}
            loading={billLoading}
            onRefresh={handleRefreshBill}
            onContinue={handleGoToSummary}
            readOnly={isDoctor}
            selectedPatientId={selectedPatientId}
          />
        );
      case Steps.SUMMARY:
        return (
          <PaymentSummaryStep
            bill={bill}
            onBack={() => setStep(Steps.BILL)}
            onContinue={handleGoToMethod}
            readOnly={isDoctor}
            coverageAmount={coverageAmount}
            patientPayable={outstanding}
          />
        );
      case Steps.METHOD:
        return (
          <PaymentMethodStep
            bill={bill}
            selectedMethod={selectedMethod}
            onSelect={setSelectedMethod}
            onBack={() => setStep(Steps.SUMMARY)}
            onContinue={handleMethodContinue}
            availability={availabilityByMethod}
            processing={processing}
            outstanding={outstanding}
            readOnly={isDoctor}
          />
        );
      case Steps.CARD:
        return (
          <CardPaymentStep
            bill={bill}
            cardNumber={cardNumber}
            setCardNumber={setCardNumber}
            expMonth={expMonth}
            setExpMonth={setExpMonth}
            expYear={expYear}
            setExpYear={setExpYear}
            cvc={cvc}
            setCvc={setCvc}
            rememberCard={rememberCard}
            setRememberCard={setRememberCard}
            savedCards={savedCardOptions}
            onBack={() => setStep(Steps.METHOD)}
            onSubmit={handleCardPayment}
            processing={processing}
          />
        );
      case Steps.RESULT:
        return (
          <ResultStep
            bill={bill}
            result={result}
            onDownload={handleDownloadReceipt}
            onDone={handleReset}
            onRetry={handleRetry}
            onChangeMethod={() => {
              setResult(null);
              setStep(Steps.METHOD);
            }}
            canUseCash={canUseCash}
            canUseCard={canUseCard}
          />
        );
      default:
        return null;
    }
  };
  return (
    <main style={layout}>
      <header style={header}>
        <div>
          <h1 style={title}>Payments</h1>
          <p style={subtitle}>
            Review your bill, choose a payment method, and complete the payment in a few steps.
          </p>
        </div>
        <button style={secondaryButton} onClick={handleRefreshBill} disabled={!selectedPatientId || billLoading}>
          Refresh from approved appointments
        </button>
      </header>

      {!isPatient ? (
        <section style={quickFilters}>
          <label style={field}>
            Patient ID
            <input
              style={input}
              placeholder="Enter patient ID"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value.trim())}
            />
          </label>
          <button style={primaryButton} onClick={() => loadBill(false)} disabled={!selectedPatientId}>
            Load bill
          </button>
        </section>
      ) : null}

      <section style={contentArea}>{renderStep()}</section>
    </main>
  );
}
function BillDetailsStep({
  bill,
  loading,
  onRefresh,
  onContinue,
  readOnly,
  selectedPatientId
}) {
  const items = bill?.items || [];
  return (
    <div style={card}>
      <header style={cardHeader}>
        <div>
          <h2 style={{ margin: 0 }}>Bill Details</h2>
          <p style={mutedText}>Review the bill details before proceeding to payment.</p>
        </div>
      </header>

      {loading ? (
        <p style={mutedText}>Loading bill...</p>
      ) : bill ? (
        <>
          <div style={summaryGrid}>
            <SummaryRow label="Patient ID" value={bill.patientId} />
            <SummaryRow label="Status" value={bill.status} />
            <SummaryRow label="Created At" value={formatDateTime(bill.createdAt)} />
            <SummaryRow label="Bill ID" value={bill._id} />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Itemized Bill</h3>
            {items.length ? (
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Service</th>
                    <th style={th}>Date</th>
                    <th style={th}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id}>
                      <td style={td}>{item.description}</td>
                      <td style={td}>{formatDateTime(item.createdAt)}</td>
                      <td style={td}>{formatCurrency(item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={mutedText}>No billable appointments found.</p>
            )}
          </div>

          <div style={coverageCard}>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>Coverage</h4>
            <div style={coverageRow}>
              <span>Insurance discount</span>
              <strong>{formatCurrency(bill.insuranceDiscount)}</strong>
            </div>
            <div style={coverageRow}>
              <span>Government cover</span>
              <strong>{formatCurrency(bill.governmentCover)}</strong>
            </div>
            <div style={coverageRow}>
              <span>Patient payable</span>
              <strong>{formatCurrency(bill.totalPayable)}</strong>
            </div>
          </div>
        </>
      ) : (
        <div style={emptyCard}>
          <p style={mutedText}>No pending bill. Refresh to build one from approved appointments.</p>
        </div>
      )}

      <footer style={footerActions}>
        <button style={secondaryButton} onClick={onRefresh} disabled={!selectedPatientId}>
          Refresh
        </button>
        <div style={{ flex: 1 }} />
        <button
          style={primaryButton}
          onClick={onContinue}
          disabled={!bill || readOnly || loading || bill.status === 'PAID'}
        >
          Proceed to summary
        </button>
      </footer>
      {readOnly ? (
        <p style={{ ...mutedText, marginTop: '0.75rem' }}>
          Doctors can review billing details but cannot process payments.
        </p>
      ) : null}
    </div>
  );
}
function PaymentSummaryStep({ bill, onBack, onContinue, readOnly, coverageAmount, patientPayable }) {
  return (
    <div style={card}>
      <header style={cardHeader}>
        <div>
          <h2 style={{ margin: 0 }}>Payment Summary</h2>
          <p style={mutedText}>Review the coverage and patient payable amount before continuing.</p>
        </div>
      </header>

      {bill ? (
        <>
          <div style={summaryGrid}>
            <SummaryRow label="Insurance + government" value={formatCurrency(coverageAmount)} />
            <SummaryRow label="Patient payable" value={formatCurrency(patientPayable)} bold />
          </div>
          <button
            style={linkButton}
            type="button"
            onClick={() => toastInfo('Insurance is automatically applied to this bill.')}
          >
            View coverage details
          </button>
        </>
      ) : (
        <p style={mutedText}>No bill available. Go back and refresh to build a bill.</p>
      )}

      <footer style={footerActions}>
        <button style={secondaryButton} onClick={onBack}>
          Back
        </button>
        <div style={{ flex: 1 }} />
        <button style={primaryButton} onClick={onContinue} disabled={!bill || readOnly}>
          Choose payment method
        </button>
      </footer>
    </div>
  );
}
function PaymentMethodStep({
  bill,
  selectedMethod,
  onSelect,
  onBack,
  onContinue,
  availability,
  processing,
  outstanding,
  readOnly
}) {
  return (
    <div style={card}>
      <header style={cardHeader}>
        <div>
          <h2 style={{ margin: 0 }}>How would you like to pay?</h2>
          <p style={mutedText}>Select a payment method to continue.</p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {METHOD_OPTIONS.map((option) => {
          const enabled = availability[option.id] ?? !option.disabled;
          const isSelected = selectedMethod === option.id;
          return (
            <button
              key={option.id}
              type="button"
              style={methodOption(isSelected, enabled)}
              disabled={!enabled || readOnly}
              onClick={() => (enabled ? onSelect(option.id) : null)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={methodRadio(isSelected)} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>{option.label}</div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{option.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {outstanding <= 0 ? (
        <p style={{ ...mutedText, marginTop: '0.75rem' }}>
          Insurance or government coverage already covers this bill. No additional payment is required.
        </p>
      ) : null}

      <footer style={footerActions}>
        <button style={secondaryButton} onClick={onBack}>
          Back
        </button>
        <div style={{ flex: 1 }} />
        <button
          style={primaryButton}
          onClick={onContinue}
          disabled={
            readOnly ||
            processing ||
            !selectedMethod ||
            !(availability[selectedMethod] ?? false)
          }
        >
          Continue
        </button>
      </footer>
    </div>
  );
}
function CardPaymentStep({
  bill,
  cardNumber,
  setCardNumber,
  expMonth,
  setExpMonth,
  expYear,
  setExpYear,
  cvc,
  setCvc,
  rememberCard,
  setRememberCard,
  savedCards,
  onBack,
  onSubmit,
  processing
}) {
  const [selectedSaved, setSelectedSaved] = useState('');
  useEffect(() => {
    if (!cardNumber) {
      setSelectedSaved('');
    }
  }, [cardNumber]);
  const selectValue = savedCards.some((card) => card.value === selectedSaved) ? selectedSaved : '';
  const usingSaved = Boolean(selectValue);

  return (
    <div style={card}>
      <header style={cardHeader}>
        <div>
          <h2 style={{ margin: 0 }}>Card Payment</h2>
          <p style={mutedText}>Securely enter your card details below.</p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={field}>
          Saved card
          <select
            style={input}
            value={selectValue}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedSaved(value);
              setCardNumber(value);
              if (value) {
                setExpMonth('12');
                setExpYear('29');
                setCvc('123');
                setRememberCard(false);
              } else {
                setExpMonth('');
                setExpYear('');
                setCvc('');
              }
            }}
          >
            {savedCards.map((card) => (
              <option key={card.value || card.label} value={card.value}>
                {card.label}
              </option>
            ))}
          </select>
        </label>

        {!usingSaved ? (
          <>
            <label style={field}>
              Card number
              <input
                style={input}
                placeholder="4111 1111 1111 1111"
                value={cardNumber}
                onChange={(e) => {
                  setSelectedSaved('');
                  setCardNumber(e.target.value);
                }}
                inputMode="numeric"
              />
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <label style={field}>
                Exp month
                <input
                  style={input}
                  placeholder="MM"
                  value={expMonth}
                  onChange={(e) => setExpMonth(e.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label style={field}>
                Exp year
                <input
                  style={input}
                  placeholder="YY"
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label style={field}>
                CVC
                <input
                  style={input}
                  placeholder="123"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value)}
                  inputMode="numeric"
                />
              </label>
            </div>
          </>
        ) : (
          <div style={mutedText}>
            You selected a saved card. Expiry and CVC are pre-filled by the gateway simulator.
          </div>
        )}

        <label style={checkboxRow}>
          <input
            type="checkbox"
            checked={rememberCard}
            onChange={() => setRememberCard((v) => !v)}
          />
          Save card for next time
        </label>

        <div style={{ color: '#475569', fontSize: '0.9rem' }}>
          You will be redirected to 3-D Secure for payment authorization.
        </div>
      </div>

      <footer style={footerActions}>
        <button style={secondaryButton} onClick={onBack} disabled={processing}>
          Back
        </button>
        <div style={{ flex: 1 }} />
        <button style={primaryButton} onClick={onSubmit} disabled={processing}>
          {processing ? 'Processing...' : `Pay ${formatCurrency(bill?.totalPayable || 0)}`}
        </button>
      </footer>
    </div>
  );
}
function ResultStep({ bill, result, onDownload, onDone, onRetry, onChangeMethod, canUseCash, canUseCard }) {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  if (!result) return null;

  if (result.status === 'success') {
    const covered = (bill?.subtotal || 0) - (result.payment?.amount || 0);
        const emailToggle = [emailEnabled, setEmailEnabled];
        const smsToggle = [smsEnabled, setSmsEnabled];
    return (
      <div style={card}>
        <header style={cardHeaderCenter}>
          <div style={successIcon}>?</div>
          <h2 style={{ margin: '0.5rem 0 0 0' }}>Payment Successful</h2>
          <p style={mutedText}>Receipt number: {result.receipt?.receiptNumber || 'N/A'}</p>
          <h3 style={{ fontSize: '2rem', margin: '0.5rem 0' }}>{formatCurrency(result.payment?.amount || 0)}</h3>
        </header>

        <section style={resultBreakdown}>
          <div style={resultRow}>
            <span>Gov/Insurance</span>
            <strong>{formatCurrency(covered)}</strong>
          </div>
          <div style={resultRow}>
            <span>Patient</span>
            <strong>{formatCurrency(result.payment?.amount || 0)}</strong>
          </div>
        </section>

        <section style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={primaryButton} onClick={onDownload}>
            Download receipt
          </button>
          <Toggle label="Email receipt" state={emailToggle} />
          <Toggle label="SMS receipt" state={smsToggle} />
        </section>

        <footer style={{ ...footerActions, marginTop: '1.25rem' }}>
          <div />
          <button style={primaryButton} onClick={onDone}>
            Done
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div style={card}>
      <header style={cardHeaderCenter}>
        <div style={errorIcon}>!</div>
        <h2 style={{ margin: '0.5rem 0 0 0' }}>Payment Failed</h2>
        <p style={mutedText}>We were unable to process your payment.</p>
      </header>

      <section style={errorCard}>
        <strong>Reason for failure</strong>
        <p style={{ margin: '0.5rem 0 0 0' }}>{result.message}</p>
      </section>

      <footer style={footerActions}>
        <button style={primaryButton} onClick={onRetry} disabled={!canUseCard && result.method === METHOD_CARD}>
          Retry payment
        </button>
        <button style={secondaryButton} onClick={onChangeMethod}>
          Change method
        </button>
        {canUseCash ? (
          <button style={linkButton} onClick={() => toastInfo('Select the cash option and continue.')}>Pay with cash</button>
        ) : null}
      </footer>
    </div>
  );
}
function SummaryRow({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
      <span>{label}</span>
      <strong style={bold ? { fontSize: '1rem' } : undefined}>{value}</strong>
    </div>
  );
}

function Toggle({ label, state }) {
  const [enabled, setEnabled] = state;
  return (
    <button style={toggleButton(enabled)} onClick={() => setEnabled((v) => !v)}>
      <span style={toggleThumb(enabled)} />
      {label}
    </button>
  );
}
const layout = {
  padding: "2rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem"
};

const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between"
};

const title = {
  margin: 0,
  fontSize: "1.75rem",
  color: "#0f172a"
};

const subtitle = {
  margin: 0,
  color: "#475569"
};

const contentArea = {
  display: "flex",
  justifyContent: "center"
};

const card = {
  width: "100%",
  maxWidth: "720px",
  background: "#fff",
  borderRadius: "1rem",
  padding: "1.75rem",
  boxShadow: "0 24px 48px rgba(15,23,42,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem"
};

const cardHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between"
};

const cardHeaderCenter = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center"
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "0.75rem"
};

const coverageCard = {
  border: "1px solid #e2e8f0",
  borderRadius: "0.75rem",
  padding: "1rem",
  background: "#f8fafc"
};

const coverageRow = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "0.35rem",
  color: "#334155"
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  border: "1px solid #e2e8f0"
};

const th = {
  textAlign: "left",
  padding: "0.5rem",
  fontSize: "0.85rem",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0"
};

const td = {
  padding: "0.5rem",
  fontSize: "0.85rem",
  borderBottom: "1px solid #f1f5f9",
  color: "#334155"
};

const footerActions = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "center"
};

const primaryButton = {
  border: "none",
  borderRadius: "9999px",
  padding: "0.6rem 1.5rem",
  background: "#0ea5e9",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600
};

const secondaryButton = {
  border: "1px solid #0ea5e9",
  borderRadius: "9999px",
  padding: "0.6rem 1.5rem",
  background: "#fff",
  color: "#0ea5e9",
  cursor: "pointer",
  fontWeight: 600
};

const linkButton = {
  border: "none",
  background: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  textDecoration: "underline"
};

const mutedText = {
  color: "#64748b"
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  fontSize: "0.9rem",
  color: "#1f2937"
};

const input = {
  border: "1px solid #cbd5f5",
  borderRadius: "0.65rem",
  padding: "0.55rem 0.75rem",
  fontSize: "0.95rem"
};

const checkboxRow = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  color: "#334155"
};

const methodOption = (selected, enabled) => ({
  border: selected ? "2px solid #0ea5e9" : "1px solid #e2e8f0",
  borderRadius: "0.85rem",
  padding: "0.9rem 1rem",
  textAlign: "left",
  width: "100%",
  background: enabled ? "#fff" : "#f8fafc",
  cursor: enabled ? "pointer" : "not-allowed",
  display: "flex"
});

const methodRadio = (selected) => ({
  width: "18px",
  height: "18px",
  borderRadius: "9999px",
  border: selected ? "6px solid #0ea5e9" : "2px solid #cbd5f5"
});

const emptyCard = {
  border: "1px dashed #dbeafe",
  padding: "1rem",
  borderRadius: "0.75rem",
  background: "#f8fafc",
  textAlign: "center"
};

const quickFilters = {
  display: "flex",
  alignItems: "flex-end",
  gap: "1rem"
};

const successIcon = {
  width: "56px",
  height: "56px",
  borderRadius: "9999px",
  background: "#dcfce7",
  color: "#16a34a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.75rem"
};

const errorIcon = {
  width: "56px",
  height: "56px",
  borderRadius: "9999px",
  background: "#fee2e2",
  color: "#ef4444",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.75rem"
};

const resultBreakdown = {
  border: "1px solid #e2e8f0",
  borderRadius: "0.75rem",
  padding: "1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  background: "#f8fafc"
};

const resultRow = {
  display: "flex",
  justifyContent: "space-between",
  color: "#334155"
};

const errorCard = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  borderRadius: "0.75rem",
  padding: "1rem",
  color: "#b91c1c"
};

const toggleButton = (enabled) => ({
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  border: "1px solid #e2e8f0",
  borderRadius: "9999px",
  padding: "0.4rem 0.9rem",
  background: enabled ? "#e0f2fe" : "#fff",
  color: "#0f172a",
  cursor: "pointer"
});

const toggleThumb = (enabled) => ({
  width: "28px",
  height: "16px",
  borderRadius: "9999px",
  background: enabled ? "#0ea5e9" : "#cbd5f5",
  position: "relative",
  display: "inline-block",
  marginRight: "0.5rem",
  outline: "1px solid #cbd5f5"
});
