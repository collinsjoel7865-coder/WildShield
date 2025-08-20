;; WildShield Conservation Token Contract
;; Clarity v2
;; Implements SIP-10 compliant fungible token with mint, burn, transfer, allowances, staking, donations to treasury, governance power, and admin controls

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INSUFFICIENT-BALANCE u101)
(define-constant ERR-INSUFFICIENT-STAKE u102)
(define-constant ERR-MAX-SUPPLY-REACHED u103)
(define-constant ERR-PAUSED u104)
(define-constant ERR-ZERO-ADDRESS u105)
(define-constant ERR-INSUFFICIENT-ALLOWANCE u106)
(define-constant ERR-INVALID-AMOUNT u107)

;; Token metadata (SIP-10 compliant)
(define-constant TOKEN-NAME "WildShield Conservation Token")
(define-constant TOKEN-SYMBOL "WSHIELD")
(define-constant TOKEN-DECIMALS u6)
(define-constant MAX-SUPPLY u1000000000000000) ;; 1B tokens in smallest units (1e9 * 1e6)
(define-constant TOKEN-URI none) ;; Optional URI for token metadata

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var total-supply uint u0)
(define-data-var treasury principal tx-sender)

;; Balances, stakes, allowances, and donations
(define-map balances principal uint)
(define-map staked-balances principal uint)
(define-map allowances {owner: principal, spender: principal} uint)
(define-map donation-history principal uint)

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: emit event via print
(define-private (emit-transfer (from principal) (to principal) (amount uint))
  (print {event: "transfer", from: from, to: to, amount: amount})
)

(define-private (emit-mint (recipient principal) (amount uint))
  (print {event: "mint", recipient: recipient, amount: amount})
)

(define-private (emit-burn (from principal) (amount uint))
  (print {event: "burn", from: from, amount: amount})
)

(define-private (emit-stake (staker principal) (amount uint))
  (print {event: "stake", staker: staker, amount: amount})
)

(define-private (emit-unstake (staker principal) (amount uint))
  (print {event: "unstake", staker: staker, amount: amount})
)

(define-private (emit-donate (donor principal) (amount uint))
  (print {event: "donate", donor: donor, amount: amount})
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Set treasury address
(define-public (set-treasury (new-treasury principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-treasury 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set treasury new-treasury)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (ok pause)
  )
)

;; Mint new tokens (admin only)
(define-public (mint (recipient principal) (amount uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((new-supply (+ (var-get total-supply) amount)))
      (asserts! (<= new-supply MAX-SUPPLY) (err ERR-MAX-SUPPLY-REACHED))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (var-set total-supply new-supply)
      (emit-mint recipient amount)
      (ok true)
    )
  )
)

;; Burn tokens
(define-public (burn (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- balance amount))
      (var-set total-supply (- (var-get total-supply) amount))
      (emit-burn tx-sender amount)
      (ok true)
    )
  )
)

;; Transfer tokens
(define-public (transfer (recipient principal) (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((sender-balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= sender-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- sender-balance amount))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (emit-transfer tx-sender recipient amount)
      (ok true)
    )
  )
)

;; Approve spender allowance
(define-public (approve (spender principal) (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq spender 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (map-set allowances {owner: tx-sender, spender: spender} amount)
    (print {event: "approval", owner: tx-sender, spender: spender, amount: amount})
    (ok true)
  )
)

;; Transfer from another account using allowance
(define-public (transfer-from (sender principal) (recipient principal) (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let (
      (sender-balance (default-to u0 (map-get? balances sender)))
      (allowance (default-to u0 (map-get? allowances {owner: sender, spender: tx-sender})))
    )
      (asserts! (>= sender-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (asserts! (>= allowance amount) (err ERR-INSUFFICIENT-ALLOWANCE))
      (map-set balances sender (- sender-balance amount))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (map-set allowances {owner: sender, spender: tx-sender} (- allowance amount))
      (emit-transfer sender recipient amount)
      (ok true)
    )
  )
)

;; Stake tokens for governance and rewards
(define-public (stake (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- balance amount))
      (map-set staked-balances tx-sender (+ amount (default-to u0 (map-get? staked-balances tx-sender))))
      (emit-stake tx-sender amount)
      (ok true)
    )
  )
)

;; Unstake tokens
(define-public (unstake (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((stake-balance (default-to u0 (map-get? staked-balances tx-sender))))
      (asserts! (>= stake-balance amount) (err ERR-INSUFFICIENT-STAKE))
      (map-set staked-balances tx-sender (- stake-balance amount))
      (map-set balances tx-sender (+ amount (default-to u0 (map-get? balances tx-sender))))
      (emit-unstake tx-sender amount)
      (ok true)
    )
  )
)

;; Donate tokens to treasury
(define-public (donate (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let (
      (sender-balance (default-to u0 (map-get? balances tx-sender)))
      (treasury-addr (var-get treasury))
    )
      (asserts! (>= sender-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- sender-balance amount))
      (map-set balances treasury-addr (+ amount (default-to u0 (map-get? balances treasury-addr))))
      (map-set donation-history tx-sender (+ amount (default-to u0 (map-get? donation-history tx-sender))))
      (emit-donate tx-sender amount)
      (emit-transfer tx-sender treasury-addr amount)
      (ok true)
    )
  )
)

;; SIP-10 read-only functions
(define-read-only (get-name)
  (ok TOKEN-NAME)
)

(define-read-only (get-symbol)
  (ok TOKEN-SYMBOL)
)

(define-read-only (get-decimals)
  (ok TOKEN-DECIMALS)
)

(define-read-only (get-token-uri)
  (ok TOKEN-URI)
)

;; Other read-only functions
(define-read-only (get-balance (account principal))
  (ok (default-to u0 (map-get? balances account)))
)

(define-read-only (get-staked-balance (account principal))
  (ok (default-to u0 (map-get? staked-balances account)))
)

(define-read-only (get-allowance (owner principal) (spender principal))
  (ok (default-to u0 (map-get? allowances {owner: owner, spender: spender})))
)

(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

