# GameContext domain split inventory

This document captures the pre-split `GameContext` surface and the incremental focused providers now layered under the legacy provider. The legacy `useGame()` export remains available for compatibility, but new and migrated consumers should prefer the focused hooks so unrelated updates do not invalidate their render trees.

## State fields and domains

| Domain | State fields |
| --- | --- |
| Authentication/user | `user`, `isAuthenticated`, `authInitialized`, `showLoginModal`, `authModalMode`, `showEmailVerificationModal`, `showEmailVerifiedModal`, `emailVerificationStatus` |
| Balance/wallet | `balance` plus the balance and XP fields carried on `user` |
| Catalog/boxes | `boxes`, `items` |
| Inventory | `inventory` |
| Shipments/orders | `shipments` |
| Notifications | `notifications` |
| Application settings | `coinPackages`, `bonusSettings`, `stripeSettings` |
| Navigation/UI | `view`, `showTopUpModal`, `topUpModalIntent` |
| Battles | `battles` |
| Admin/community | `users`, internal `adminDirectoryUsers` |

## Exported actions by domain

| Domain | Actions |
| --- | --- |
| Authentication/user | `login`, `loginWithGoogle`, `linkGoogleAccount`, `register`, `resetPassword`, `logout`, `openAuthModal`, `setShowLoginModal`, `setAuthModalMode`, `resendEmailVerification`, `refreshEmailVerification`, `dismissEmailVerificationModal`, `setShowEmailVerificationModal`, `setShowEmailVerifiedModal` |
| Balance/wallet | `syncBalance`, `syncXpBalance`, `addBalance`, `deductBalance`, `registerSpend`, `awardCaseOpenXp` |
| Catalog/boxes | `createBox`, `createUserBox`, `updateBox`, `deleteBox`, `createItem`, `updateItem`, `deleteItem` |
| Inventory | `addToInventory`, `addInventoryItemFromServer`, `sellItem` |
| Shipments/orders | `shipItem`, `updateShipmentStatus`, `cancelShipmentAsAdmin` |
| Notifications | `addNotification`, `dismissNotification`, `clearNotifications`, `sendAdminNotification` |
| Application settings | `createCoinPackage`, `updateCoinPackage`, `deleteCoinPackage`, `updateBonusSettings`, `updateStripeSettings` |
| Navigation/UI | `setView`, `setShowTopUpModal`, `setTopUpModalIntent` |
| Battles | `createBattle`, `joinBattle`, `updateBattle` |
| User/admin profile operations | `followUser`, `unfollowUser`, `updateAddress`, `updateUserInfo`, `updateUserFlags`, `updateUserAdminData`, `updateUserBalance`, `claimFreeBox`, `claimRakeback`, `generateAffiliateCode`, `updateUserProgress` |

## Realtime listeners and cleanup

- Firebase Auth: `onAuthStateChanged` initializes and tears down authenticated user state.
- User document: `onSnapshot(users/{uid})` is stored in `userUnsubscribeRef` and cleared by `clearUserSubscriptions`.
- Inventory subcollection: `onSnapshot(users/{uid}/inventory)` is stored in `inventoryUnsubscribeRef`, route-scoped, and cleared by `unsubscribeFromInventory`/`clearUserSubscriptions`.
- Notifications subcollection: `onSnapshot(users/{uid}/notifications)` is stored in `notificationsUnsubscribeRef` and cleared by `clearUserSubscriptions`.
- Bonus settings: `onSnapshot(appSettings/bonus)` returns its unsubscribe from the effect.
- Stripe settings: `onSnapshot(appSettings/stripe)` returns its unsubscribe from the effect.
- Browser navigation: the `popstate` listener returns `removeEventListener` from the effect.
- Item polling fallback: the delayed `setTimeout` and recurring `setInterval` are both cleared by that effect cleanup.

## Focused providers and migrated consumers

| Provider hook | Value scope | Migrated consumers in this change |
| --- | --- | --- |
| `useAuth()` | User/authentication modal and email verification state/actions | `CaseOpening`, `BoxCatalog` |
| `useWallet()` | Balance, wallet sync, spend, and XP helpers | `CaseOpening`, `BoxCatalog` |
| `useBoxes()` | Box and item catalog state/actions | `useBoxDetails`, `CaseOpening`, `BoxCatalog`, existing `BoxGrid` |
| `useInventory()` | Inventory items and inventory item mutations | `CaseOpening` |
| `useShipments()` | Shipment state/actions | New provider available; legacy consumers remain on `useGame()` until migrated |
| `useNotifications()` | Notification list and notification actions | New provider available; legacy consumers remain on `useGame()` until migrated |
| `useSettings()` | Coin packages, bonus settings, and Stripe settings | `CaseOpening`, `BoxCatalog` |
| `useUI()` | Route view and top-up modal state/actions | `CaseOpening`, `BoxCatalog`, existing `BoxGrid` |
| `useBattles()` | Battle state/actions | New provider available; legacy consumers remain on `useGame()` until migrated |
| `useAdminGame()` | Admin/community profile operations retained from the original context | `CaseOpening` for `claimFreeBox` |

## Rerender boundaries introduced

- Catalog-only consumers of `useBoxes()` no longer receive the wallet `balance` value, so balance changes do not invalidate catalog-only subscriptions.
- Shipment consumers can subscribe through `useShipments()` without receiving catalog, balance, or notification values.
- The case spinner path in `CaseOpening` no longer subscribes to the legacy `useGame()` object, so notification list updates do not invalidate that component through context.
- Provider values are memoized per domain with `useMemo`, and domains only include the state/actions they own.
