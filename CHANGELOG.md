# Changelog

Every release is generated from the public Crossly OpenAPI specs; each entry lists what changed in them.

## 0.3.0 (2026-11-28)

Generated from the Crossly API specs: seller `361d4c3da`, buyer `db3c48c10`. **Contains breaking changes.**

### seller

**Removed operations (breaking)** (1)

- `createConnectionRequest` (POST /v1/connections/{platform}/request)

**Removed models (breaking)** (50)

- `CreateCbxBoostPauseResponseData`
- `CreateCreatorCardSetPublishResponseDataSubmitted`
- `CreateCustomerBulkExportResponse`
- `CreateDetectedEventEventUndoResponse`
- `CreateDetectedEventEventUndoResponseData`
- `CreateDetectedEventEventUndoResponseDataEvent`
- `CreateMagicScanSynthesizeResponsePayloadCategory`
- `CreateMagicScanSynthesizeResponsePayloadDimensions`
- `CreateMeTemplateShareResponse`
- `CreateOrderDisputeResponseError`
- `CreateTcgStarterResponseData`
- `CreateTradeBlockSetRecipeResponseRecipeMembers`
- `CreateWorldSpaceEventRsvpResponseData`
- `CreateWorldSpaceRoleResponseData`
- `DeleteDaoProposalResponseData`
- `DeleteStoryResponseData`
- `FromTo2`
- `GetAiStatusResponseCapabilities`
- `GetAiStatusResponseCustomConfig`
- `GetAiStatusResponseImage`
- `GetAiStatusResponseImageSupportedProvidersItem`
- `GetConnectionEmailResponseOauth`
- `GetGroupBuyResponseDataTiers`
- `GetProductFeedReportResponseItems`
- `GetVaultMarketAlertPrefResponseMatrixAccount`
- `GetVaultMarketNavResponseHoldingsAsc820`
- `GetWorldGameTemplateResponseDataFiles`
- `GetWorldMePrefResponseData`
- `ListAppsItemDocsLinks`
- `ListAutomaticDiscountsItemTiers`
- `ListChannelInventoryItem`
- `ListChannelInventoryItemCapabilities`
- `ListChannelInventoryItemCapabilitiesOutOfStockActionsItem`
- `ListChannelInventoryItemExclusions`
- `ListChannelInventoryItemPolicy`
- `ListChannelInventoryResponse`
- `ListDiscountCodesItemRulesFixedPriceSet`
- `ListDiscountCodesItemRulesSpendTiers`
- `ListEmailEventsItemPrice`
- `ListEventsItemDropRef`
- `ListGroupBuysItemTiers`
- `ListProductFeedsItemUrls`
- `ListVaultMarketShareAutoInvestItemTargets`
- `RentalResponseDataInspection`
- `UpdateLookbookDesignResponseData`
- `UpdateWorldAttendantResponseDataKnowledge`
- `UpdateWorldAttendantResponseDataKnowledgeFaqs`
- `UpdateWorldConventionStatusResponseData`
- `UpdateWorldFitValueShareResponseData`
- `UpdateWorldPropertyRentingResponseData`

**New operations** (195)

- `deleteAiKeyById` (DELETE /v1/ai/keys/{id})
- `deleteChannelAccountSetting` (DELETE /v1/channel-accounts/{accountId}/settings)
- `deleteConnectionEmail` (DELETE /v1/connections/email/{id})
- `deleteConnectionOwnApp` (DELETE /v1/connections/own-apps/{platform})
- `deleteCreatorCardGame` (DELETE /v1/creator/cards/games/{id})
- `deleteCrmIntegration` (DELETE /v1/crm/integrations/{id})
- `deleteDesignTool` (DELETE /v1/design-tools/{tool})
- `deleteDevice` (DELETE /v1/devices/{id})
- `deleteEmailProvider` (DELETE /v1/email-providers/{id})
- `deleteLoyaltyReward` (DELETE /v1/loyalty/rewards/{rewardId})
- `deletePrintMailCredential` (DELETE /v1/print-mail/credentials/{id})
- `deleteProductFeedItem` (DELETE /v1/product-feeds/{id}/items/{listingId})
- `deleteRepricingAssignment` (DELETE /v1/repricing/assignments/{id})
- `deleteSkuPreset` (DELETE /v1/sku-presets/{id})
- `deleteTeamMemberStore` (DELETE /v1/team/members/{id}/stores/{store})
- `deleteWholesaleCatalogAccess` (DELETE /v1/wholesale/catalogs/{id}/access/{grantId})
- `deleteWorldExperienceLocalization` (DELETE /v1/worlds/experiences/{experienceId}/localization/{locale})
- `getAccountNotificationPreference` (GET /v1/account/notification-preferences)
- `getAccountSignInIdentity` (GET /v1/account/sign-in-identity)
- `getAiKey` (GET /v1/ai/keys)
- `getAiRouting` (GET /v1/ai/routing)
- `getAssignee` (GET /v1/assignees)
- `listBillingInvoices` (GET /v1/billing/invoices)
- `getBillingUsage` (GET /v1/billing/usage)
- `listBrandingBrandSellers` (GET /v1/branding/brand/sellers)
- `listBrandingBrandSellerSearch` (GET /v1/branding/brand/sellers/search)
- `getBrandingBrandTerm` (GET /v1/branding/brand/terms)
- `listBrandingDropBuyers` (GET /v1/branding/drops/{id}/buyers)
- `listChannelAccounts` (GET /v1/channel-accounts)
- `getChannelAccountHistoryImport` (GET /v1/channel-accounts/{accountId}/history-import)
- `getChannelAccountSetting` (GET /v1/channel-accounts/{accountId}/settings)
- `getConnectionEmail` (GET /v1/connections/email/{id})
- `listConnectionEmailEmails` (GET /v1/connections/email/{id}/emails)
- `listConnectionOwnApps` (GET /v1/connections/own-apps)
- `getConnectionStore` (GET /v1/connections/stores)
- `listCreatorCardGames` (GET /v1/creator/cards/games)
- `getCreatorCardGame` (GET /v1/creator/cards/games/{id})
- `listCrmIntegrations` (GET /v1/crm/integrations)
- `listCrmIntegrationLogs` (GET /v1/crm/integrations/{id}/logs)
- `getDaoSubjectParticipation` (GET /v1/dao/subjects/{subjectId}/participation)
- `getDesignTool` (GET /v1/design-tools/{tool})
- `getDetectedEventOverview` (GET /v1/detected-events/overview)
- `getDetectedEventRule` (GET /v1/detected-events/rules/{ref})
- `listDetectedEventSituations` (GET /v1/detected-events/situations)
- `getDetectedEventStartingPoint` (GET /v1/detected-events/starting-point)
- `listDeveloperApps` (GET /v1/developer/apps)
- `getDeveloperApp` (GET /v1/developer/apps/{appId})
- `getDeviceScale` (GET /v1/devices/scale)
- `getEmailEvent` (GET /v1/email-events/{id})
- `getEmailEventPreview` (GET /v1/email-events/{id}/preview)
- `getFundingInvoiceAdvanceEligibility` (GET /v1/funding/invoice-advance-eligibility)
- `getGradingSetting` (GET /v1/grading/settings)
- `getIntegration` (GET /v1/integrations)
- `listInventoryHoldIssues` (GET /v1/inventory/holds/issues)
- `listInventoryHolds` (GET /v1/inventory/{id}/holds)
- `getListingOfferFloor` (GET /v1/listings/{id}/offer-floor)
- `listLoyaltyProgramMemberPoints` (GET /v1/loyalty/program/members/{id}/points)
- `listLoyaltyRewards` (GET /v1/loyalty/rewards)
- `getOrderPickList` (GET /v1/orders/pick-list)
- `getOrderSuggestedParcel` (GET /v1/orders/{id}/suggested-parcel)
- … and 135 more

**Changed operations** (874)

- `deleteAiKey` (DELETE /v1/ai/key)
- `deleteChannelInventory` (DELETE /v1/channel-inventory/{platform}/{slot})
- `deleteConnectionEmailImap` (DELETE /v1/connections/email/imap/{id})
- `deleteCosmHandle` (DELETE /v1/cosm/handles)
- `deleteCosmPeg` (DELETE /v1/cosm/pegs/{listingId})
- `deleteDaoProposal` (DELETE /v1/dao/proposals/{id})
- `deleteEventPolicyRule` (DELETE /v1/event-policies/rules/{id})
- `deleteSpatialSceneNode` (DELETE /v1/spatial/scenes/{id}/nodes)
- `deleteSpatialSceneWarehouseStock` (DELETE /v1/spatial/scenes/{id}/warehouse/stock)
- `deleteWorldGamePackage` (DELETE /v1/world/games/packages/{id})
- `deleteWorldPropertyTrespassed` (DELETE /v1/world/property/trespassed/{userId})
- `deleteWorldExperience` (DELETE /v1/worlds/experiences/{experienceId})
- `deleteWorldExperiencePlaceStudioScript` (DELETE /v1/worlds/experiences/{experienceId}/places/{placeId}/studio/script)
- `getAdOffsiteEligibility` (GET /v1/ads/offsite/eligibility)
- `getAnalyticBookkeeping` (GET /v1/analytics/bookkeeping)
- `getAnalyticDashboard` (GET /v1/analytics/dashboard)
- `getAnalyticInventory` (GET /v1/analytics/inventory)
- `getAnalyticItem` (GET /v1/analytics/items)
- `listAuthSessions` (GET /v1/auth/sessions)
- `getBookTaxProfile` (GET /v1/books/tax-profile)
- `listBrandDrops` (GET /v1/brand-drops)
- `listBrandingDrops` (GET /v1/branding/drops)
- `getBrandingEvent` (GET /v1/branding/events)
- `listChannelInventory` (GET /v1/channel-inventory)
- `getChannelInventory` (GET /v1/channel-inventory/{platform}/{slot})
- `listConnectionEmail` (GET /v1/connections/email)
- `listCosmAttestations` (GET /v1/cosm/attestations)
- `getCosmAttestationProof` (GET /v1/cosm/attestations/{id}/proof)
- `listCosmAuction` (GET /v1/cosm/auction)
- `getCosmBalance` (GET /v1/cosm/balance)
- `listCosmCosmetics` (GET /v1/cosm/cosmetics)
- `getCosmEmployeeFeeQuote` (GET /v1/cosm/employee/fee-quote)
- `listCosmInventory` (GET /v1/cosm/inventory)
- `listCosmPegs` (GET /v1/cosm/pegs)
- `getCosmStakeTenure` (GET /v1/cosm/stake-tenure)
- `listCosmUnlocks` (GET /v1/cosm/unlocks)
- `listCosmWithdrawals` (GET /v1/cosm/withdrawals)
- `listCreatorCreations` (GET /v1/creator/creations)
- `listCreatorCreationReviews` (GET /v1/creator/creations/{format}/{id}/reviews)
- `listCreatorExperienceKeys` (GET /v1/creator/experience-keys)
- `listDaoProposals` (GET /v1/dao/proposals)
- `listDetectedEventEvents` (GET /v1/detected-events/events)
- `listDiscountCodes` (GET /v1/discount-codes)
- `listDiscountCodeRedemptions` (GET /v1/discount-codes/{id}/redemptions)
- `getEventPolicy` (GET /v1/event-policies)
- `listEventPolicyDecisions` (GET /v1/event-policies/decisions)
- `listFundingReceipts` (GET /v1/funding/receipts)
- `listInventory` (GET /v1/inventory)
- `getInventorySellThrough` (GET /v1/inventory/sell-through)
- `getInventoryValueHistory` (GET /v1/inventory/value-history)
- `listListingAdCampaigns` (GET /v1/listing-ads/{platform}/campaigns)
- `listListings` (GET /v1/listings)
- `listLiveShipments` (GET /v1/live-shipments)
- `listLookbookCampaigns` (GET /v1/lookbook-campaigns)
- `listLookbookCampaignRecipients` (GET /v1/lookbook-campaigns/{id}/recipients)
- `listLoyaltyAirdrops` (GET /v1/loyalty/airdrops)
- `listMeTemplates` (GET /v1/me/templates)
- `listOrders` (GET /v1/orders)
- `getOrderSalesTax` (GET /v1/orders/{id}/sales-tax)
- `listPassports` (GET /v1/passports)
- … and 814 more

**New models** (1306)

- `AmountCurrency`
- `BodyRequest`
- `CreateAccountReconfirmDeletionRequest`
- `CreateAccountRequest`
- `CreateAccountRequestDeletionRequest`
- `CreateAdOffsiteCampaignRequest`
- `CreateAiCategorizeRequest`
- `CreateAiCopyRequest`
- `CreateAiCopyResponse`
- `CreateAiEnhanceDescriptionRequest`
- `CreateAiEnhanceListingRequest`
- `CreateAiEnhanceTitleRequest`
- `CreateAiExtractReceiptRequest`
- `CreateAiGenerateListingRequest`
- `CreateAiHelpRequest`
- `CreateAiHelpRequestContext`
- `CreateAiKeyRequest`
- `CreateAiKeyResponse`
- `CreateAiKeyResponseKey`
- `CreateAiKeyResponseKeyCustomConfig`
- `CreateAiKeyResponseKeyGrants`
- `CreateAiKeyResponseTest`
- `CreateAiKeyTestRequest`
- `CreateAiKeyTestResponse`
- `CreateAiMagicListingRequest`
- `CreateAuthSessionSignOutRequest`
- `CreateAuthSessionSignOutResponse`
- `CreateAutomaticDiscountPreviewRequest`
- `CreateAutomaticDiscountPreviewRequestCart`
- `CreateAutomaticDiscountPreviewRequestDraft`
- `CreateAutomaticDiscountPreviewRequestDraftChannelsItem`
- `CreateAutomaticDiscountRequest`
- `CreateAutomaticDiscountRequestAppliesTo`
- `CreateAutomaticDiscountRequestChannelsItem`
- `CreateAutomaticDiscountRequestExclusions`
- `CreateAutomaticDiscountRequestSchedule`
- `CreateAutomaticDiscountRequestScheduleWindows`
- `CreateAutomaticDiscountRequestStacking`
- `CreateAutomationRuleImportRequest`
- `CreateAutomationRuleImportRequestOneOf1Recipes`
- `CreateAutomationRuleImportRequestOneOfMetadata`
- `CreateAutomationRuleImportRequestOneOfTrigger`
- `CreateAutomationRuleValidateRecipeRequest`
- `CreateBookExpenseResponseDataPossibleDuplicateOf`
- `CreateBrandDropRequest`
- `CreateBrandingDropControlRequest`
- `CreateBrandingDropRequest`
- `CreateBrandingDropRestockRunRequest`
- `CreateBrandingDropRestockRunResponse`
- `CreateBrandingDropRestockRunResponseData`
- `CreateBrandingEventCheckInRequest`
- `CreateBrandingEventMessageRequest`
- `CreateBreakRequest`
- `CreateBreakSpotHitRequest`
- `CreateBulkBatchIdentifyRequest`
- `CreateBulkBatchItemBulkRequest`
- `CreateBulkBatchItemBulkRequestPatch`
- `CreateBulkBatchItemRequest`
- `CreateBulkBatchPublishRequest`
- `CreateCbxAccrualPurchaseRequest`
- … and 1246 more

**Changed models** (300)

- `AnalyticExperimentResponseData`
- `CreateActionLogSearchTranslateResponse`
- `CreateAiTestKeyResponse`
- `CreateBillingUpgradeRequest`
- `CreateBookExpenseResponseData`
- `CreateBrandingDropPublishResponseData`
- `CreateBrandingDropPublishResponseDataConfigAccessModesItem`
- `CreateBrandingDropResponseDataDrop`
- `CreateBrandingEventCancelResponseData`
- `CreateBulkBatchItemResponse`
- `CreateCbxBoostPauseResponse`
- `CreateCbxRedemptionQuoteResponseData`
- `CreateConnectionEmailImapResponse`
- `CreateConnectionEmailImapTestResponse`
- `CreateCreatorCardSetPublishResponseData`
- `CreateDetectedEventRulePlaceResponseDataItems`
- `CreateDetectedEventRuleReorderResponseData`
- `CreateDetectedEventRuleReorderResponseDataFilter`
- `CreateDetectedEventRuleResponseData`
- `CreateGamePackBreakPickResponseDataCoupon`
- `CreateInboxSendOfferRequest`
- `CreateInboxSendOfferResponseMessage`
- `CreateListingByIdResponseItems`
- `CreateListingLinkResponseManagementAttention`
- `CreateListingPlatformTakeOverResponse`
- `CreateLookbookResponseDataBrand`
- `CreateLookbookResponseDataDesignBrand`
- `CreateLoyaltyTierResponseDataPerksItem`
- `CreateMagicScanResponsePhotoIdentifierIdentifier`
- `CreateMagicScanSynthesizeResponsePayload`
- `CreateOfferRespondResponse`
- `CreateOrderDisputeResponse`
- `CreateOrderTakeOverResponse`
- `CreatePlatformAccountHistoryImportRequest`
- `CreatePlatformAccountHistoryImportResponse`
- `CreatePlatformAccountRefreshStatusResponseResults`
- `CreatePolicyPresetResponse`
- `CreateProductionDesignSpecResponsePrefsSpec`
- `CreateRentalExtensionDecideResponseData`
- `CreateStallBookResponseBooking`
- `CreateStorefrontPolicyFromTermResponseDataPreset`
- `CreateStorefrontProfileSuggestShelveResponseDataShelvesSource`
- `CreateTcgStarterResponse`
- `CreateTeamInviteResponse`
- `CreateTradeBlockEvolutionRecipeResponseRecipe`
- `CreateTradeBlockSetRecipeResponseRecipe`
- `CreateVaultMarketAgentDraftCancelResponseDraft`
- `CreateVaultMarketAlertPrefTestResponse`
- `CreateVaultMarketAlertPrefTestResponsePlan`
- `CreateVaultMarketOptionQuoteResponseOneOfContract`
- `CreateVaultReceiptTokenConfirmResponseToken`
- `CreateWeb3OrderFulfillmentBatchResponseFulfillments`
- `CreateWeb3OrderResponseOrder`
- `CreateWebhookResponse`
- `CreateWebhookTestResponse`
- `CreateWholesaleCatalogResponseData`
- `CreateWholesaleDropResponseData`
- `CreateWholesaleInvoiceCreditNoteResponseDataCreditNote`
- `CreateWorldConventionResponseData`
- `CreateWorldDecorRetractResponseDataInventoryItems`
- … and 240 more

### buyer

**Removed models (breaking)** (1)

- `CreateBuyerScanResponseIdentifier`

**New operations** (6)

- `getBuyerGroupBuyShareLink` (GET /v1/buyer/group-buys/{id}/share-link)
- `getBuyerHomePet` (GET /v1/buyer/home/pets)
- `listBuyerLoyaltyPoints` (GET /v1/buyer/loyalty/{clubId}/points)
- `getBuyerLoyaltyReward` (GET /v1/buyer/loyalty/{clubId}/rewards)
- `createBuyerLoyaltyRewardRedeem` (POST /v1/buyer/loyalty/{clubId}/rewards/{rewardId}/redeem)
- `updateBuyerHomePetActive` (PUT /v1/buyer/home/pets/active)

**Changed operations** (51)

- `getBuyerAnywhere` (GET /v1/buyer/anywhere)
- `listBuyerCatalogBrowse` (GET /v1/buyer/catalog/browse)
- `listBuyerCatalogSearch` (GET /v1/buyer/catalog/search)
- `listBuyerHotspots` (GET /v1/buyer/hotspots)
- `getBuyerMarketPurchaseOption` (GET /v1/buyer/market/purchase-options)
- `getBuyerPassport` (GET /v1/buyer/passports/{code})
- `listBuyerRegistrySearch` (GET /v1/buyer/registries/search)
- `listBuyerStoreListings` (GET /v1/buyer/stores/{slug}/listings)
- `updateBuyerBoard` (PATCH /v1/buyer/boards/{id})
- `updateBuyerHome` (PATCH /v1/buyer/home)
- `updateBuyerMonitor` (PATCH /v1/buyer/monitors/{id})
- `updateBuyerRegistry` (PATCH /v1/buyer/registries/{id})
- `createBuyerAgentSessionAct` (POST /v1/buyer/agent/sessions/{id}/act)
- `createBuyerAgentSessionReact` (POST /v1/buyer/agent/sessions/{id}/react)
- `createBuyerAgentSessionTurn` (POST /v1/buyer/agent/sessions/{id}/turns)
- `createBuyerBoard` (POST /v1/buyer/boards)
- `createBuyerBoardItem` (POST /v1/buyer/boards/{id}/items)
- `createBuyerCartOptimizer` (POST /v1/buyer/cart-optimizer)
- `createBuyerCartQuote` (POST /v1/buyer/cart/quote)
- `createBuyerCatalogListingRental` (POST /v1/buyer/catalog/listings/{slug}/rental)
- `createBuyerCatalogListingRentalQuote` (POST /v1/buyer/catalog/listings/{slug}/rental/quote)
- `createBuyerCatalogListingVideoRequest` (POST /v1/buyer/catalog/listings/{slug}/video-requests)
- `createBuyerCheckout` (POST /v1/buyer/checkout)
- `createBuyerEventRsvp` (POST /v1/buyer/events/{slug}/rsvp)
- `createBuyerIdentify` (POST /v1/buyer/identify)
- `createBuyerLayawayPay` (POST /v1/buyer/layaways/{id}/pay)
- `createBuyerListingTryOn` (POST /v1/buyer/listings/{slug}/try-on)
- `createBuyerLockon` (POST /v1/buyer/lockons)
- `createBuyerLockonConfirm` (POST /v1/buyer/lockons/{id}/confirm)
- `createBuyerLockonObserve` (POST /v1/buyer/lockons/{id}/observe)
- `createBuyerMonitor` (POST /v1/buyer/monitors)
- `createBuyerPackFairnessRotate` (POST /v1/buyer/packs/fairness/rotate)
- `createBuyerPackOpen` (POST /v1/buyer/packs/{slug}/open)
- `createBuyerPassportClaim` (POST /v1/buyer/passports/{code}/claim)
- `createBuyerPurchaseFit` (POST /v1/buyer/purchases/{id}/fit)
- `createBuyerRegistry` (POST /v1/buyer/registries)
- `createBuyerRegistryGiftThanked` (POST /v1/buyer/registries/{id}/gifts/{giftId}/thanked)
- `createBuyerRentalArrivalPhoto` (POST /v1/buyer/rentals/{id}/arrival-photos)
- `createBuyerRentalClaimResponse` (POST /v1/buyer/rentals/{id}/claim-response)
- `createBuyerRentalExtension` (POST /v1/buyer/rentals/{id}/extensions)
- `createBuyerRentalReturnShipped` (POST /v1/buyer/rentals/{id}/return-shipped)
- `createBuyerScan` (POST /v1/buyer/scan)
- `createBuyerScanSession` (POST /v1/buyer/scan/sessions)
- `createBuyerVaultList` (POST /v1/buyer/vault/{id}/list)
- `createBuyerVaultWithdraw` (POST /v1/buyer/vault/{id}/withdraw)
- `updateBuyerBoardLayout` (PUT /v1/buyer/boards/{id}/layout)
- `updateBuyerCheckoutControl` (PUT /v1/buyer/checkout/controls)
- `updateBuyerCollectionSetLeaderboard` (PUT /v1/buyer/collection/sets/leaderboard)
- `updateBuyerHomeBuilder` (PUT /v1/buyer/home/builders)
- `updateBuyerHomeLayout` (PUT /v1/buyer/home/layout)
- `updateBuyerRegistryItem` (PUT /v1/buyer/registries/{id}/items/{platformListingId})

**New models** (71)

- `CreateBuyerAgentSessionActRequest`
- `CreateBuyerAgentSessionReactRequest`
- `CreateBuyerAgentSessionTurnRequest`
- `CreateBuyerBoardItemRequest`
- `CreateBuyerBoardRequest`
- `CreateBuyerCartOptimizerRequest`
- `CreateBuyerCartQuoteRequest`
- `CreateBuyerCatalogListingRentalRequest`
- `CreateBuyerCatalogListingRentalRequestShipTo`
- `CreateBuyerCatalogListingVideoRequestRequest`
- `CreateBuyerCheckoutRequest`
- `CreateBuyerCheckoutRequestGift`
- `CreateBuyerCheckoutRequestPickupPoint`
- `CreateBuyerCheckoutRequestPickupPointAddress`
- `CreateBuyerCheckoutRequestShipTo`
- `CreateBuyerEventRsvpRequest`
- `CreateBuyerIdentifyRequest`
- `CreateBuyerLayawayPayRequest`
- `CreateBuyerListingTryOnRequest`
- `CreateBuyerLockonConfirmRequest`
- `CreateBuyerLockonObserveRequest`
- `CreateBuyerLockonObserveRequestAttributes`
- `CreateBuyerLockonRequest`
- `CreateBuyerLoyaltyRewardRedeemResponse`
- `CreateBuyerLoyaltyRewardRedeemResponseData`
- `CreateBuyerMonitorRequest`
- `CreateBuyerMonitorRequestQuery`
- `CreateBuyerPackFairnessRotateRequest`
- `CreateBuyerPackOpenRequest`
- `CreateBuyerPassportClaimRequest`
- `CreateBuyerPurchaseFitRequest`
- `CreateBuyerRegistryGiftThankedRequest`
- `CreateBuyerRegistryRequest`
- `CreateBuyerRentalArrivalPhotoRequest`
- `CreateBuyerRentalClaimResponseRequest`
- `CreateBuyerRentalExtensionRequest`
- `CreateBuyerRentalReturnShippedRequest`
- `CreateBuyerScanRequest`
- `CreateBuyerScanSessionRequest`
- `CreateBuyerVaultListRequest`
- `CreateBuyerVaultWithdrawRequest`
- `GetBuyerCatalogListingRentalResponseDataOptionsPhotosBack`
- `GetBuyerCatalogListingRentalResponseDataPolicy`
- `GetBuyerCatalogListingRentalResponseDataPolicyArrivalPhotos`
- `GetBuyerGroupBuyShareLinkResponse`
- `GetBuyerGroupBuyShareLinkResponseData`
- `GetBuyerGroupBuyShareLinkResponseDataNext`
- `GetBuyerHomePetResponse`
- `GetBuyerHomePetResponseData`
- `GetBuyerHomePetResponseDataPets`
- `GetBuyerLoyaltyRewardResponse`
- `GetBuyerLoyaltyRewardResponseData`
- `GetBuyerLoyaltyRewardResponseDataItems`
- `GetBuyerLoyaltyRewardResponseDataRedeemed`
- `ListBuyerLoyaltyPointsItem`
- `ListBuyerLoyaltyPointsResponse`
- `NsValue`
- `UpdateBuyerBoardLayoutRequest`
- `UpdateBuyerBoardLayoutRequestItems`
- `UpdateBuyerBoardRequest`
- … and 11 more

**Changed models** (20)

- `BuyerCompanyResponseDataMembers`
- `BuyerCompanyResponseDataYou`
- `BuyerWholesaleQuoteResponseData`
- `CreateBuyerAgentSessionResponseBriefPending`
- `CreateBuyerCatalogListingVideoRequestResponseData`
- `CreateBuyerCompanyApprovalResponseData`
- `CreateBuyerIdentifyResponse`
- `CreateBuyerLockonConfirmResponseIdentifier`
- `CreateBuyerRentalExtensionResponseData`
- `CreateBuyerScanResponse`
- `CreateBuyerWholesaleFreightRequestResponseData`
- `GetBuyerCatalogListingRentalResponseData`
- `GetBuyerCatalogListingRentalResponseDataOptions`
- `GetBuyerRentalResponseData`
- `GetBuyerRentalResponseDataExtensions`
- `GetBuyerSellerLoyaltyResponseDataMember`
- `GetBuyerSellerLoyaltyResponseDataMemberStanding`
- `GetBuyerVaultMarketOptionChainResponseRowsCall`
- `GetBuyerVaultMarketOptionPositionResponsePositionsContract`
- `GetBuyerVaultMarketPredictionLeaderboardResponse`

## 0.2.0 (2026-11-27)

Generated from the Crossly API specs: seller `551c14338`, buyer `d64567faf`.

### seller

First release from this repo: 2742 operations, 5649 models.

### buyer

First release from this repo: 355 operations, 770 models.
