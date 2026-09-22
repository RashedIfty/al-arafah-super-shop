/**
 * How the shop is paid.
 *
 * The one file to edit when a QR code is reissued, the bank changes, or
 * a method is added. Everything the checkout, the customer's order card,
 * the owner's panel and the invoice say about payment comes from here.
 *
 * The two QR codes are the shop's own merchant codes, rebuilt as clean
 * SVGs from the payloads on the printed signs (images/payment/*-qr.svg).
 * The bank details are the shop's business account. Nothing here is a
 * card number and nothing here should ever be one.
 */

/** The four ways to pay, in the order the checkout offers them. */
export const METHODS = ["paypay", "merpay", "bank", "cod"];

/** Methods where money changes hands before the order is placed. */
export const PREPAID = ["paypay", "merpay", "bank"];

export const PAY = {
  paypay: {
    qr:  "/images/payment/paypay-qr.svg",
    id:  "05-AreSr2qvBDepK4bp",              // printed under the code, as on the sign
    url: "https://qr.paypay.ne.jp/28180105AreSr2qvBDepK4bp",
  },

  /* One code serves both apps: the sign is a JPQR merchant code that
     Merpay and d払い both read. */
  merpay: {
    qr: "/images/payment/merpay-qr.svg",
  },

  bank: {
    bank:       "PayPay銀行",                 // was ジャパンネット銀行; the card still says so
    bankEn:     "PayPay Bank",
    code:       "0033",                       // 銀行コード
    branch:     "ビジネス営業部",
    branchCode: "005",                        // 支店コード
    type:       "普通",
    typeEn:     "Ordinary",
    number:     "4703412",
    holder:     "アルアラファスーパーショップ",
  },
};

/** The customer-facing name of a method, in the interface language. */
export const payLabel = (id, T) => ({
  paypay: T.pay_paypay,
  merpay: T.pay_merpay,
  bank:   T.pay_bank,
  cod:    T.pay_cod,
}[id] || id);

/** A method id the site knows, or nothing. */
export const knownMethod = id => METHODS.includes(id) ? id : null;
