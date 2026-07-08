// 🌍 Система локализации для платформы
// Поддерживаемые языки: русский (по умолчанию) и узбекский

export type Language = 'ru' | 'uz';

export interface Translations {
  // Общие
  welcome: string;
  settings: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  add: string;
  search: string;
  loading: string;
  error: string;
  success: string;
  confirm: string;
  back: string;
  
  // Магазин покупателя (HomePage)
  store: string;
  welcomeUser: string;
  cart: string;
  myOrders: string;
  likes: string;
  totalPrice: string;
  checkout: string;
  emptyCart: string;
  addToCart: string;
  removeFromCart: string;
  quantity: string;
  price: string;
  product: string;
  products: string;
  inStock: string;
  outOfStock: string;
  searchProducts: string;
  noProductsFound: string;
  
  // Заказы и чеки
  orderCode: string;
  orderDate: string;
  orderStatus: string;
  orderTotal: string;
  orderItems: string;
  orderPending: string;
  orderPaid: string;
  orderCancelled: string;
  cancelOrder: string;
  deleteReceipt: string;
  deleteReceiptConfirm: string;
  receiptDeleted: string;
  
  // Оплата
  payment: string;
  paymentMethod: string;
  paymentManual: string;
  paymentDemo: string;
  paymentReal: string;
  payNow: string;
  paymentSuccess: string;
  paymentFailed: string;
  
  // Профиль компании
  companyProfile: string;
  companyName: string;
  companyLocation: string;
  companyProducts: string;
  companyPhotos: string;
  companyAds: string;
  rateCompany: string;
  yourRating: string;
  
  // Настройки покупателя
  settingsTitle: string;
  language: string;
  languageRussian: string;
  languageUzbek: string;
  displayMode: string;
  displayModeDay: string;
  displayModeNight: string;
  logout: string;
  
  // Цифровой склад (InventoryManagement)
  inventory: string;
  addProduct: string;
  editProduct: string;
  deleteProduct: string;
  productName: string;
  productPrice: string;
  productQuantity: string;
  productBarcode: string;
  productCategory: string;
  productImage: string;
  markup: string;
  markupPercent: string;
  sellingPrice: string;
  purchasePrice: string;
  
  // Цифровой склад - новые переводы
  importFile: string;
  enterBarcodes: string;
  totalProducts: string;
  totalQuantity: string;
  totalValue: string;
  categoriesManagement: string;
  manageCategories: string;
  deleteAll: string;
  deleteAllConfirm: string;
  showing: string;
  of: string;
  photo: string;
  name: string;
  category: string;
  barcode: string;
  colors: string;
  priceWithMarkup: string;
  priceWithMarkupTotal: string;
  actions: string;
  yes: string;
  no: string;
  hasColorOptions: string;
  color: string;
  any: string;
  importExcel: string;
  importCSV: string;
  importTXT: string;
  selectFile: string;
  uploading: string;
  uploadSuccess: string;
  uploadFailed: string;
  
  // Админ панель
  adminPanel: string;
  companies: string;
  addCompany: string;
  editCompany: string;
  deleteCompany: string;
  users: string;
  orders: string;
  statistics: string;
  
  // История продаж
  salesHistory: string;
  salesDate: string;
  salesTotal: string;
  salesProfit: string;
  
  // Финансы
  finance: string;
  totalRevenue: string;
  totalProfit: string;
  totalExpenses: string;
  frozenInProducts: string;
  
  // SMM
  smm: string;
  photos: string;
  videos: string;
  ads: string;
  
  // Chat
  chat: string;
  
  // Импорт товаров
  importProducts: string;
  importFromFile: string;
  
  // Цифровая касса
  cashRegister: string;
  scanBarcode: string;
  enterBarcode: string;
  total: string;
  completeSale: string;
  
  // Компания - новые переводы
  companyPanel: string;
  salesPanel: string;
  barcodeSearch: string;
  notifications: string;
  companyManagement: string;
  discountsManagement: string;
  searchByBarcode: string;
  
  // Управление скидками (CompanyDiscountsPanel)
  regularDiscounts: string;
  aggressiveDiscounts: string;
  applyToVariant: string;
  wholeProductAnyVariant: string;
  discountOnMarkupOnly: string;
  discountOnFullAmount: string;
  noActiveDiscounts: string;
  createFirstDiscount: string;
  createDiscount: string;
  createAggressiveDiscount: string;
  useAggressiveForLiquidation: string;
  closeBtn: string;
  createDiscountBtn: string;
  selectProduct: string;
  selectProductError: string;
  allProductsOnDiscount: string;
  discountPercentLabel: string;
  promoTitleLabel: string;
  promoTitlePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  startDateLabel: string;
  endDateLabel: string;
  durationHint: string;
  discountCreated: string;
  discountCreationError: string;
  deleteDiscountConfirm: string;
  errorDeletingDiscount: string;
  loadingText: string;
  activeStatus: string;
  inactiveStatus: string;
  createdOn: string;
  originalPrice: string;
  withDiscount: string;
  discountPercent: string;
  minDurationOneHour: string;
  createdDate: string;
  startLabel: string;
  endLabel: string;
  currency: string;
  aggressiveDiscountHint: string;
  priceBelowCost: string;
  
  // Настройки компании (CompanySettingsPanel)
  privacySettings: string;
  privacyTitle: string;
  privacyDescription: string;
  currentMode: string;
  privateCompany: string;
  publicCompany: string;
  privateMode: string;
  publicMode: string;
  publicModeTitle: string;
  publicModeDescription: string;
  privateModeTitle: string;
  privateModeDescription: string;
  yourAccessCode: string;
  shareCodeWithCustomers: string;
  copyCode: string;
  copied: string;
  switchToPublicMode: string;
  switchToPrivateMode: string;
  switching: string;
  switchToPublicConfirm: string;
  switchToPrivateConfirm: string;
  switchedToPrivate: string;
  switchedToPublic: string;
  importantNote: string;
  privacyImportantNote1: string;
  privacyImportantNote2: string;
  privacyImportantNote3: string;
  errorLoadingCompanyData: string;
  errorChangingPrivacy: string;
  errorCopyingCode: string;
  
  // Панель продаж (SalesPanel)
  availableProducts: string;
  manageSales: string;
  customerOrders: string;
  ordersToday: string;
  salesAmount: string;
  toggleAvailability: string;
  availableForCustomers: string;
  makeAvailable: string;
  makeUnavailable: string;
  viewReceipt: string;
  searchByCode: string;
  searchOrder: string;
  orderNotFound: string;
  confirmingPayment: string;
  bulkActions: string;
  selectAll: string;
  deselectAll: string;
  productsAvailable: string;
  productsSelected: string;
  putOnSale: string;
  removeFromSale: string;
  
  // Аналитика (AnalyticsPanel)
  analytics: string;
  topProducts: string;
  revenueChart: string;
  profitMargin: string;
  totalSales: string;
  averageOrder: string;
  salesTrend: string;
  productPerformance: string;
  dailySales: string;
  weeklySales: string;
  monthlySales: string;
  comparison: string;
  salesLeaders: string;
  mostProfitable: string;
  lowStockProducts: string;
  cheap: string;
  expensive: string;
  
  // Заказы (OrdersPanel)
  allOrders: string;
  pendingOrders: string;
  completedOrders: string;
  cancelledOrders: string;
  filterByStatus: string;
  orderDetails: string;
  customer: string;
  phone: string;
  orderConfirmed: string;
  
  // Поиск по штрих-коду (BarcodeSearchPanel)
  offline: string;
  barcodeSearchTitle: string;
  enterBarcodeManually: string;
  scanWithCamera: string;
  barcodeFound: string;
  barcodeNotFound: string;
  updateQuantity: string;
  currentStock: string;
  newQuantity: string;
  quantityUpdated: string;
  productStats: string;
  withBarcode: string;
  withoutBarcode: string;
  scanOrEnter: string;
  newOrder: string;
  required: string;
  available: string;
  itemsCount: string;
  paymentMethodLabel: string;
  newOrderConfirm: string;
  cartWillBeCleared: string;
  cartEmpty: string;
  quantityError: string;
  invalidQuantity: string;
  quantityMustBeGreater: string;
  notEnoughStock: string;
  confirmCheckout: string;
  totalAmount: string;
  profitAmount: string;
  itemsWillBeRemoved: string;
  saleSuccess: string;
  saleId: string;
  itemsRemoved: string;
  profitAdded: string;
  saleError: string;
  tryAgainOrContactAdmin: string;
  productNotFound: string;
  cash: string;
  card: string;
  totalLabel: string;
  clearCart: string;
  pieces: string;
  purchased: string;
  cardType: string;
  other: string;
  
  // Уведомления (NotificationsPanel)
  allNotifications: string;
  unreadNotifications: string;
  readNotifications: string;
  markAsRead: string;
  markAsUnread: string;
  deleteNotification: string;
  noNotifications: string;
  lowStock: string;
  systemNotification: string;
  
  // SMM панель (CompanySMMPanel)
  smmPanel: string;
  uploadPhoto: string;
  uploadVideo: string;
  createAd: string;
  mediaGallery: string;
  myAds: string;
  adTitle: string;
  adDescription: string;
  publishAd: string;
  deleteMedia: string;
  editMedia: string;
  noMediaYet: string;
  noAdsYet: string;
  uploadInstructions: string;
  fileFormat: string;
  uploadTip: string;
  underModeration: string;
  
  // Сообщения об ошибках
  errorLoading: string;
  errorSaving: string;
  errorDeleting: string;
  errorInvalidData: string;
  errorNetwork: string;
  
  // Подтверждения
  confirmDelete: string;
  confirmCancel: string;
  confirmLogout: string;
  
  // ============== НОВЫЕ КЛЮЧИ ДЛЯ ВНУТРЕННИХ ПАНЕЛЕЙ ==============
  
  // Аналитика (AnalyticsPanel) - внутренние
  loadingAnalytics: string;
  financesAndAnalytics: string;
  paymentHistory: string;
  periodAnalysis: string;
  selectPeriodAnalytics: string;
  profit: string;
  profitFromMarkups: string;
  companyExpenses: string;
  finalBalance: string;
  charts: string;
  salaryExpense: string;
  electricityExpense: string;
  purchasesExpense: string;
  otherExpenses: string;
  profitAndExpenses: string;
  currentPeriod: string;
  previousPeriod: string;
  salesDynamics: string;
  topSellingProducts: string;
  productsSold: string;
  revenue: string;
  noSalesYet: string;
  advancedInsights: string;
  sum: string;
  billion: string;
  million: string;
  thousand: string;
  
  // Период времени
  today: string;
  yesterday: string;
  thisWeek: string;
  thisMonth: string;
  thisYear: string;
  allTime: string;
  customPeriod: string;
  day: string;
  week: string;
  month: string;
  year: string;
  hour: string;
  
  // История платежей (PaymentHistoryForCompany)
  paymentHistoryTitle: string;
  totalPayments: string;
  paidAmount: string;
  searchPayments: string;
  filters: string;
  allMethods: string;
  checksAndCodes: string;
  demoOnline: string;
  realOnline: string;
  status: string;
  allStatuses: string;
  paid: string;
  pending: string;
  failed: string;
  period: string;
  allPeriod: string;
  customDates: string;
  from: string;
  to: string;
  noPaymentsFound: string;
  paymentDetails: string;
  orderId: string;
  orderTime: string;
  paymentVia: string;
  productsInOrder: string;
  profitFromOrder: string;
  close: string;
  
  // Склад (DigitalWarehouse)
  digitalWarehouse: string;
  noCategory: string;
  errorUpdatingProduct: string;
  deleteProductConfirm: string;
  fillNameAndPrice: string;
  markupTooHigh: string;
  errorAddingProduct: string;
  deleteAllProductsConfirm: string;
  successfullyDeleted: string;
  errorMassDelete: string;
  fileTooLarge: string;
  tooManyRows: string;
  fileEmpty: string;
  productsImported: string;
  selectCategory: string;
  allCategories: string;
  unavailable: string;
  pcs: string;
  loadingWarehouse: string;
  errorLoadingWarehouse: string;
  productsCount: string;
  totalInStock: string;
  cost: string;
  categoriesCount: string;
  searchPlaceholder: string;
  addProductShort: string;
  importFromExcelCSV: string;
  importShort: string;
  exportToExcel: string;
  exportShort: string;
  deleteAllProducts: string;
  companyIdNotFound: string;
  markupCorrected: string;
  updateError: string;
  deleteError: string;
  deleteCancelled: string;
  deleteSuccess: string;
  availabilityError: string;
  excelReadError: string;
  importSuccess: string;
  importError: string;
  importFileError: string;
  importSuccessDetailed: string;
  importCheckFormat: string;
  importErrorGeneric: string;
  productNamePlaceholder: string;
  quantityPlaceholder: string;
  pricePlaceholder: string;
  markupPercentPlaceholder: string;
  barcodePlaceholder: string;
  baridPlaceholder: string;
  colorPlaceholder: string;
  sizePlaceholder: string;
  brandPlaceholder: string;
  categoryHeader: string;
  quantityHeader: string;
  basePriceHeader: string;
  markupHeader: string;
  sellingPriceHeader: string;
  barcodeHeader: string;
  actionsHeader: string;
  fillProductInfo: string;
  categoriesAdminOnly: string;
  noProducts: string;
  productsNotFound: string;
  baridDigits: string;
  addPhotoTitle: string;
  productPhotos: string;
  productDescription: string;
  descriptionVisibleToCustomers: string;
  productColor: string;
  productSize: string;
  productBrand: string;
  exampleLabel: string;
  maxQuantityInfo: string;
  markupInfo: string;
  baridInfo: string;
  consoleDetails: string;
  colorExamples: string;
  sizeExamples: string;
  brandExamples: string;
  
  // Заказы (CompanyOrdersPanel)
  customerOrdersTitle: string;
  searchOrdersPlaceholder: string;
  all: string;
  waiting: string;
  completed: string;
  cancelled: string;
  ordersNotFound: string;
  guest: string;
  orderComposition: string;
  colorLabel: string;
  orderDetailsTitle: string;
  orderTimeLabel: string;
  onlineCard: string;
  cashOrCheck: string;
  cancelOrderBtn: string;
  confirmOrderBtn: string;
  processing: string;
  confirmPaymentQuestion: string;
  paymentConfirmedSuccess: string;
  errorConfirmingPayment: string;
  cancelOrderQuestion: string;
  orderCancelledSuccess: string;
  errorCancellingOrder: string;
  
  // Затраты (ExpensesManager)
  companyExpensesTitle: string;
  addExpense: string;
  editExpenses: string;
  saveChanges: string;
  saving: string;
  newExpense: string;
  expenseName: string;
  expenseNamePlaceholder: string;
  amountInSum: string;
  descriptionOptional: string;
  additionalInfo: string;
  saveExpense: string;
  deleteExpenseTooltip: string;
  expense: string;
  refund: string;
  enterAmount: string;
  willBeAdded: string;
  willBeReduced: string;
  additionalCompanyExpense: string;
  fillNameAndAmount: string;
  expenseAddedSuccess: string;
  errorAddingExpense: string;
  deleteExpenseConfirm: string;
  expenseDeletedSuccess: string;
  errorDeletingExpense: string;
  amountCannotBeNegative: string;
  expensesUpdatedSuccess: string;
  errorUpdatingExpenses: string;
  
  // Панель продаж (SalesPanel) - дополнительные
  errorLoadingData: string;
  errorSavingDescription: string;
  productDescriptionSaved: string;
  errorChangingProductStatus: string;
  selectProductsForSale: string;
  successfullyListed: string;
  errorListingProducts: string;
  confirmPaymentForOrder: string;
  paymentConfirmedProductsUpdated: string;
  errorConfirmingPaymentOrder: string;
  errorSearchingOrder: string;
  
  // CompanyOrdersPanel - дополнительные
  searchDots: string;
  searchByCodeNamePhone: string;
  refreshList: string;
  cashCheck: string;
  confirmPaymentReceived: string;
  confirmError: string;
  cancelOrderConfirm: string;
  cancelError: string;
  waitingOrders: string;
  confirmedOrders: string;
  shippedOrders: string;
  acceptOrder: string;
  acceptOrderConfirm: string;
  orderAccepted: string;
  acceptOrderError: string;
  markAsShipped: string;
  markAsShippedConfirm: string;
  orderShipped: string;
  markAsShippedError: string;
  statusConfirmed: string;
  statusShipped: string;

  // Реферальные агенты (AdminReferralPanel, ReferralAgentPanel)
  referralAgents: string;
  referralAgentsManagement: string;
  referralAgentsDescription: string;
  totalAgents: string;
  addAgent: string;
  createNewAgent: string;
  agentName: string;
  agentPhone: string;
  agentPassword: string;
  agentPasswordDigitsOnly: string;
  agentPasswordHint: string;
  referralCode: string;
  uniqueCode: string;
  active: string;
  inactive: string;
  myReferralCode: string;
  myPassword: string;
  loginForAgents: string;
  agentLoginDescription: string;
  welcomeAgent: string;
  myCompanies: string;
  companiesLinked: string;
  trialCompanies: string;
  disabledCompanies: string;
  copyReferralCode: string;
  shareWithCompanies: string;
  yourLoginData: string;
  provideToCompanies: string;
  trialPeriodInfo: string;
  noCompaniesYet: string;
  shareYourCode: string;
  registeredOn: string;
  trialUntil: string;
  days: string;
  disabled: string;
  trial: string;
  phoneFormatError: string;
  passwordRequired: string;
  loginError: string;
  invalidPhoneOrPassword: string;
  dataLoadError: string;
  unknownError: string;
  codeCopied: string;
  
  // Финансовая аналитика агента (ReferralAgentAnalyticsPanel)
  financialAnalytics: string;
  hideEarnings: string;
  showEarnings: string;
  totalCompanySales: string;
  platformFee: string;
  yourEarnings: string;
  fromSales: string;
  howCalculated: string;
  platformTakes10: string;
  youGet10OfPlatform: string;
  totalYouGet1: string;
  companiesFinancials: string;
  company: string;
  yourCommission: string;
  
  // Компания - вход и регистрация
  companyLogin: string;
  companyLoginTitle: string;
  companyLoginDescription: string;
  enterCompanyData: string;
  publicCompanyRegistration: string;
  privateCompanyRegistration: string;
  fillPublicCompanyData: string;
  fillPrivateCompanyData: string;
  firstName: string;
  lastName: string;
  companyId: string;
  companyIdUnique: string;
  companyIdHint: string;
  phoneNumber: string;
  password: string;
  enterPassword: string;
  accessKey: string;
  accessKey30chars: string;
  generate: string;
  backToModeSelection: string;
  registerCompany: string;
  optional: string;
  referralCodeOptional: string;
  referralCodeHint: string;
  enterName: string;
  enterLastName: string;
  enterCompanyId: string;
  enterCompanyName: string;
  phoneNumberHint: string;
  loginButton: string;
  fillAllFields: string;
  
  // SMM Panel (CompanySMMPanel)
  profileTab: string;
  companyProfileTab: string;
  adsTab: string;
  loadingProducts: string;
  salesCount: string;
  subscribersCount: string;
  logo: string;
  uploadingLogo: string;
  logoUploaded: string;
  logoUploadError: string;
  ratings: string;
  saveButton: string;
  editButton: string;
  locationLabel: string;
  selectLocation: string;
  locationSelected: string;
  notSpecified: string;
  companyDescPlaceholder: string;
  noDescription: string;
  adsInstruction: string;
  recommendedSizes: string;
  aspectRatio: string;
  minWidth: string;
  maxFileSize: string;
  formats: string;
  adsTip: string;
  adsTipText: string;
  adBanners: string;
  deleteAllAdsConfirm: string;
  deletingAllAds: string;
  adsDeleted: string;
  adsDeleteError: string;
  deleteAllButton: string;
  uploadAd: string;
  noAdBannersYet: string;
  uploadImageForModeration: string;
  uploadFirstAd: string;
  deleteAdConfirm: string;
  deletingAd: string;
  adDeleted: string;
  adDeleteError: string;
  statusPending: string;
  statusApproved: string;
  statusRejected: string;
  rejectionReason: string;
  uploadAdTitle: string;
  adType: string;
  companyAd: string;
  productAd: string;
  selectProductRequired: string;
  nameRequired: string;
  enterNamePlaceholder: string;
  addDescriptionPlaceholder: string;
  uploadMethod: string;
  uploadFile: string;
  insertURL: string;
  dragImageHere: string;
  or: string;
  removeFile: string;
  recommendedTip: string;
  imageURL: string;
  imageURLExample: string;
  imageURLPlaceholder: string;
  urlTip: string;
  previewLabel: string;
  cancelButton: string;
  createAdButton: string;
  profileSaved: string;
  saveProfileError: string;
  creatingAd: string;
  selectFileToUpload: string;
  enterImageURL: string;
  enterTitle: string;
  selectProductForAd: string;
  pleaseUploadImage: string;
  productsLoadError: string;
  companyAdDescription: string;
  productAdDescription: string;
  noProductsAddFirst: string;
  selectProductOption: string;
  adCreated: string;
  adCreatedStatus: string;
  companyGenitive: string;
  productGenitive: string;
  
  // Sales Panel
  saveError: string;
  productDescSaved: string;
  statusChangeError: string;
  listedProductsAvailable: string;
  timeSeconds: string;
  listProductsError: string;
  confirmPayment: string;
  paymentConfirmed: string;
  paymentConfirmError: string;
  orderSearchError: string;
  selectProductsToRemove: string;
  removeFromSaleConfirm: string;
  successfullyRemoved: string;
  removedProductsHidden: string;
  removeFromSaleError: string;
  searchByName: string;
  foundOrder: string;
  receipt: string;
  noProductsInStock: string;
  listForCustomers: string;
  listForCustomersDesc: string;
  productsAvailableForCustomers: string;
  productDetails: string;
  productDetailsDesc: string;
  describeProduct: string;
  storeInfo: string;
  storeName: string;
  storePhone: string;
  storeAddress: string;
  describeProducts: string;
  alreadyOnSale: string;
  willBeListed: string;
  editProductDescTitle: string;
  noDescriptionClickEdit: string;
  onSale: string;
  notOnSale: string;
  paymentReceived: string;
  pendingPayment: string;
  
  // Analytics Panel
  analyticsLoadError: string;
  monthsShort: string[];
  profitCategory: string;
  expensesCategory: string;
  totalCategory: string;
  zoomOut: string;
  zoomIn: string;
  zoomReset: string;
  periodToday: string;
  periodYesterday: string;
  periodThisWeek: string;
  periodThisMonth: string;
  periodThisYear: string;
  periodCurrent: string;
  periodPrevYesterday: string;
  periodWeekAgo: string;
  periodMonthAgo: string;
  periodYearAgo: string;
  periodPrevious: string;
  
  // Analytics - Additional translations
  daysOfWeek: string[];
  weekLabel: string;
  dayLabel: string;
  monthLabel: string;
  growthDynamics: string;
  selectSpecificPeriod: string;
  
  // Payment methods and statuses
  plasticCards: string;
  cashPayment: string;
  paidStatus: string;
  pendingStatus: string;
  errorStatus: string;
  checksCodesPayment: string;
  
  // Company Orders Panel
  invalidDeliveryCoords: string;
  mapOpenError: string;
  deliveryRecipient: string;
  deliveryAddress: string;
  fromCompany: string;
  toDelivery: string;
  
  // Admin Analytics Panel
  platformAnalytics: string;
  allCompaniesStats: string;
  companyStats: string;
  allCompanies: string;
  specificCompany: string;
  selectCompanyPlaceholder: string;
  refresh: string;
  generalRevenue: string;
  netProfit: string;
  profitFromMarkup: string;
  productsInDatabase: string;
  productUnits: string;
  frozenInStock: string;
  deliveryRevenueTotal: string;
  companyAnalytics: string;
  productAnalytics: string;
  ordersCount: string;
  topProducts: string;
  sold: string;
  revenue: string;
  profit: string;

  // Advanced Insights Panel
  leastSold: string;
  remaining: string;
  threshold: string;
  top20products: string;
  lowStockDescription: string;
  allInStockMessage: string;

  // Payment History date filter
  selectSpecificDay: string;
  selectSpecificDayHint: string;

  // Table headers (short)
  methodHeader: string;
  detailsBtn: string;
  
  // Excel Column Mapper
  excelColumnMapping: string;
  excelColumnMappingDesc: string;
  productNameField: string;
  quantityField: string;
  basePriceField: string;
  markupPercentField: string;
  barcodeField: string;
  baridField: string;
  notSelected: string;
  columnLabel: string;
  emptyColumnName: string;
  dataPreview: string;
  emptyCell: string;
  filePreviewRowsTitle: string;
  importantInfo: string;
  requiredFields: string;
  optionalFields: string;
  quantityNotSpecifiedHint: string;
  markupNotSpecifiedHint: string;
  barcodeNotSpecifiedHint: string;
  fillRequiredFieldsAlert: string;
  confirmAndImport: string;
  
  // Import Progress Messages
  importingFromCSV: string;
  importingToDatabase: string;
  processingExcelData: string;
  updatingData: string;
}

export const translations: Record<Language, Translations> = {
  ru: {
    // Общие
    welcome: 'Добро пожаловать',
    settings: 'Настройки',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Редактировать',
    add: 'Добавить',
    search: 'Поиск',
    loading: 'Загрузка...',
    error: 'Ошибка',
    success: 'Успешно',
    confirm: 'Подтвердить',
    back: 'Назад',
    
    // Магазин покупателя
    store: 'Магазин',
    welcomeUser: 'Добро пожаловать',
    cart: 'Корзина',
    myOrders: 'Мои заказы',
    likes: 'Избранное',
    totalPrice: 'Итого',
    checkout: 'Оформить заказ',
    emptyCart: 'Корзина пуста',
    addToCart: 'В корзину',
    removeFromCart: 'Убрать',
    quantity: 'Количество',
    price: 'Цена',
    product: 'Товар',
    products: 'Товары',
    inStock: 'В наличии',
    outOfStock: 'Нет в наличии',
    searchProducts: 'Поиск товаров...',
    noProductsFound: 'Товары не найдены',
    
    // Заказы и чеки
    orderCode: 'Код заказа',
    orderDate: 'Дата',
    orderStatus: 'Статус',
    orderTotal: 'Сумма',
    orderItems: 'Товары',
    orderPending: 'В ожидании',
    orderPaid: 'Оплачено',
    orderCancelled: 'Отменено',
    cancelOrder: 'Отменить заказ',
    deleteReceipt: 'Удалить из списка',
    deleteReceiptConfirm: 'Удалить этот чек из корзины?\n\n⚠️ Чек останется в системе компании, удалится только из вашего списка.',
    receiptDeleted: 'Чек удалён из корзины!',
    
    // Оплата
    payment: 'Оплата',
    paymentMethod: 'Способ оплаты',
    paymentManual: 'Чеки/Коды',
    paymentDemo: 'Демо онлайн',
    paymentReal: 'Реальная онлайн',
    payNow: 'Оплатить',
    paymentSuccess: 'Оплата успешна',
    paymentFailed: 'Ошибка оплаты',
    
    // Профиль компании
    companyProfile: 'Профиль компании',
    companyName: 'Название компании',
    companyLocation: 'Местоположение',
    companyProducts: 'Товары',
    companyPhotos: 'Фотогалерея',
    companyAds: 'Реклама',
    rateCompany: 'Оцените компанию',
    yourRating: 'Ваша оценка',
    
    // Настройки покупателя
    settingsTitle: 'Настройки',
    language: 'Язык',
    languageRussian: 'Русский',
    languageUzbek: 'Узбекский',
    displayMode: 'Режим отображения',
    displayModeDay: 'Дневной',
    displayModeNight: 'Ночной',
    logout: 'Выйти',
    
    // Цифровой склад
    inventory: 'Цифровой склад',
    addProduct: 'Добавить товар',
    editProduct: 'Редактировать товар',
    deleteProduct: 'Удалить товар',
    productName: 'Название товара',
    productPrice: 'Цена',
    productQuantity: 'Количество',
    productBarcode: 'Штрих-код',
    productCategory: 'Категория',
    productImage: 'Изображение',
    markup: 'Наценка',
    markupPercent: 'Процент наценки',
    sellingPrice: 'Цена продажи',
    purchasePrice: 'Закупочная цена',
    
    // Цифровой склад - новые переводы
    importFile: 'Импорт файла',
    enterBarcodes: 'Введите штрих-коды',
    totalProducts: 'Всего товаров',
    totalQuantity: 'Всего количества',
    totalValue: 'Общая стоимость',
    categoriesManagement: 'Управление категориями',
    manageCategories: 'Управление категориями',
    deleteAll: 'Удалить всё',
    deleteAllConfirm: 'Удалить все товары?\n\n⚠️ Это удалит все товары из вашего склада.',
    showing: 'Показано',
    of: 'из',
    photo: 'Фото',
    name: 'Название',
    category: 'Категория',
    barcode: 'Штрих-код',
    colors: 'Цвета',
    priceWithMarkup: 'Цена с наценкой',
    priceWithMarkupTotal: 'Итого с наценкой',
    actions: 'Действия',
    hasColorOptions: 'Есть цветовые варианты',
    color: 'Цвет',
    any: 'Любой',
    yes: 'Да',
    no: 'Нет',
    selectFile: 'Выберите файл',
    uploading: 'Загрузка...',
    uploadSuccess: 'Файл успешно загружен',
    uploadFailed: 'Ошибка загрузки файла',
    
    // Админ панель
    adminPanel: 'Админ панель',
    companies: 'Компании',
    addCompany: 'Добавить компанию',
    editCompany: 'Редактировать компанию',
    deleteCompany: 'Удалить компанию',
    users: 'Пользователи',
    orders: 'Заказы',
    statistics: 'Аналитика',
    
    // История продаж
    salesHistory: 'История продаж',
    salesDate: 'Дата продажи',
    salesTotal: 'Сумма продажи',
    salesProfit: 'Прибыль',
    
    // Финансы
    finance: 'Финансы',
    totalRevenue: 'Общий доход',
    totalProfit: 'Общая прибыль',
    totalExpenses: 'Общие расходы',
    frozenInProducts: 'Заморожено в товарах',
    
    // SMM
    smm: 'SMM',
    photos: 'Фотографии',
    videos: 'Видео',
    ads: 'Реклама',
    
    // Chat
    chat: 'Чат',
    
    // Импорт товаров
    importProducts: 'Импорт товаров',
    importFromFile: 'Импорт из файла',
    importExcel: 'Excel',
    importCSV: 'CSV',
    importTXT: 'TXT',
    
    // Цифровая касса
    cashRegister: 'Оффлайн',
    scanBarcode: 'Сканировать штрих-код',
    enterBarcode: 'Ввести штрих-код',
    total: 'Итого',
    completeSale: 'Завершить продажу',
    
    // Компания - новые переводы
    companyPanel: 'Панель компании',
    salesPanel: 'Панель продаж',
    barcodeSearch: 'Оффлайн',
    notifications: 'Уведомления',
    companyManagement: 'Управление компанией',
    discountsManagement: 'Управление скидками',
    searchByBarcode: 'Оффлайн',
    
    // Управление скидками (CompanyDiscountsPanel)
    regularDiscounts: 'Обычные скидки',
    aggressiveDiscounts: 'Жёсткие скидки',
    applyToVariant: 'Применить к варианту',
    wholeProductAnyVariant: 'Весь товар (любой вариант)',
    discountOnMarkupOnly: 'Скидка только на наценку. Цена не опускается ниже себестоимости.',
    discountOnFullAmount: 'Скидка на всю сумму (цена + наценка). Может быть ниже себестоимости.',
    noActiveDiscounts: 'У вас пока нет активных скидок',
    createFirstDiscount: 'Создайте первую скидку, чтобы привлечь больше покупателей!',
    createDiscount: 'Создать скидку',
    createAggressiveDiscount: 'Создать жёсткую скидку',
    useAggressiveForLiquidation: 'Используйте жёсткие скидки для ликвидации залежавшихся товаров!',
    closeBtn: 'Закрыть',
    createDiscountBtn: 'Создать скидку',
    selectProduct: 'Выберите товар',
    selectProductError: 'Выберите товар и укажите процент скидки',
    allProductsOnDiscount: 'Все товары уже выставлены на скидку (обычную или жёсткую)',
    discountPercentLabel: 'Процент скидки * (0-100)',
    promoTitleLabel: 'Название акции (необязательно)',
    promoTitlePlaceholder: 'Например: Распродажа зимы',
    descriptionLabel: 'Описание (необязательно)',
    descriptionPlaceholder: 'Дополнительная информация о скидке',
    startDateLabel: 'Начало скидки (необязательно)',
    endDateLabel: 'Конец скидки (необязательно)',
    durationHint: 'Минимальная длительность — 1 час. Если не указано — бессрочно.',
    discountCreated: 'Скидка успешно создана!',
    discountCreationError: 'Ошибка создания скидки',
    deleteDiscountConfirm: 'Удалить скидку?',
    errorDeletingDiscount: 'Ошибка удаления скидки',
    loadingText: 'Загрузка...',
    activeStatus: 'Активна',
    inactiveStatus: 'Неактивна',
    createdOn: 'Создано:',
    originalPrice: 'Цена с наценкой',
    withDiscount: 'Со скидкой',
    discountPercent: 'Скидка',
    minDurationOneHour: 'Минимальная длительность скидки - 1 час',
    createdDate: 'Создано',
    startLabel: 'С',
    endLabel: 'До',
    currency: 'сум',
    aggressiveDiscountHint: 'Скидка применяется к сумме с наценкой, может привести к убыткам',
    priceBelowCost: 'Цена ниже себестоимости',
    
    // Настройки компании (CompanySettingsPanel)
    privacySettings: 'Настройки приватности',
    privacyTitle: 'Настройки приватности',
    privacyDescription: 'Управляйте видимостью ваших товаров для покупателей',
    currentMode: 'Текущий режим',
    privateCompany: 'Приватная компания',
    publicCompany: 'Публичная компания',
    privateMode: '🔒 Приватный',
    publicMode: '🌐 Публичный',
    publicModeTitle: '🌐 Публичный режим',
    publicModeDescription: 'Ваши товары видны всем пользователям. Покупатели из разных компаний видят все публичные товары в общем каталоге.',
    privateModeTitle: '🔒 Приватный режим',
    privateModeDescription: 'Ваши товары видны только покупателям, которые знают уникальный код доступа. Каждый покупатель входит в персональную панель с товарами только вашей компании.',
    yourAccessCode: 'Ваш код доступа',
    shareCodeWithCustomers: 'Поделитесь этим кодом с вашими покупателями',
    copyCode: 'Копировать',
    copied: 'Скопировано!',
    switchToPublicMode: 'Переключить на публичный режим',
    switchToPrivateMode: 'Переключить на приватный режим',
    switching: 'Переключение...',
    switchToPublicConfirm: 'Переключить компанию в публичный режим? Ваши товары станут видны всем пользователям. Код доступа будет удалён.',
    switchToPrivateConfirm: 'Переключить компанию в приватный режим? Будет сгенерирован уникальный код доступа (5-6 цифр), который покупатели должны будут ввести для доступа к вашим товарам.',
    switchedToPrivate: '✅ Компания переведена в приватный режим!',
    switchedToPublic: '✅ Компания переведена в публичный режим!',
    importantNote: '⚠️ Важно:',
    privacyImportantNote1: 'При переключении из публичного в приватный режим генерируется новый уникальный код (5-6 цифр)',
    privacyImportantNote2: 'При переключении обратно в публичный режим код доступа удаляется',
    privacyImportantNote3: 'Покупатели должны ввести код при регистрации или входе для доступа к вашим товарам',
    errorLoadingCompanyData: 'Ошибка загрузки данных компании',
    errorChangingPrivacy: 'Ошибка изменения режима приватности',
    errorCopyingCode: 'Не удалось скопировать код',
    
    // Панель продаж (SalesPanel)
    availableProducts: 'Доступные товары',
    manageSales: 'Управление продажами',
    customerOrders: 'Заказы клиентов',
    ordersToday: 'Заказы сегодня',
    salesAmount: 'Сумма продаж',
    profitAmount: 'Прибыль',
    toggleAvailability: 'Переключить доступность',
    availableForCustomers: 'Доступно для клиентов',
    makeAvailable: 'Сделать доступным',
    makeUnavailable: 'Сделать недоступным',
    confirmPayment: 'Подтвердить оплату',
    viewReceipt: 'Просмотреть чек',
    searchByCode: 'Поиск по коду',
    searchOrder: 'Поиск заказа',
    orderNotFound: 'Заказ не найден',
    confirmingPayment: 'Подтверждение оплаты',
    paymentConfirmed: 'Оплата подтверждена',
    bulkActions: 'Массовые действия',
    selectAll: 'Выбрать все',
    deselectAll: 'Отменить выбор',
    productsAvailable: 'Товаров в наличии',
    productsSelected: 'Выбрано товаров',
    putOnSale: 'В продажу',
    removeFromSale: 'Убрать из продажи',
    
    // Аналитика (AnalyticsPanel)
    analytics: 'Аналитика',
    topProducts: 'Топ-продукты',
    revenueChart: 'График доходов',
    profitMargin: 'Маржа прибыли',
    totalSales: 'Общие продажи',
    averageOrder: 'Средний заказ',
    salesTrend: 'Тенденция продаж',
    productPerformance: 'Производительность продукта',
    dailySales: 'Продажи за день',
    weeklySales: 'Продажи за неделю',
    monthlySales: 'Продажи за месяц',
    comparison: 'Сравнение',
    salesLeaders: 'Лидеры продаж',
    mostProfitable: 'Самые прибыльные',
    lowStockProducts: 'Товары с низким остатком',
    cheap: 'Дешевые',
    expensive: 'Дорогие',
    
    // Заказы (OrdersPanel)
    allOrders: 'Все заказы',
    pendingOrders: 'Заказы в ожидании',
    completedOrders: 'Завершённые заказы',
    cancelledOrders: 'Отменённые заказы',
    filterByStatus: 'Фильтр по статусу',
    orderDetails: 'Детали заказа',
    customer: 'Клиент',
    phone: 'Телефон',
    orderConfirmed: 'Заказ подтверждён',
    
    // Поиск по штрих-коду (BarcodeSearchPanel)
    offline: 'Оффлайн',
    barcodeSearchTitle: 'Оффлайн',
    enterBarcodeManually: 'Ввести штрих-код вручную',
    scanWithCamera: 'Сканировать с камеры',
    barcodeFound: 'Штрих-код найден',
    barcodeNotFound: 'Штрих-код не найден',
    updateQuantity: 'Обновить количество',
    currentStock: 'Текущий запас',
    newQuantity: 'Новое количество',
    quantityUpdated: 'Количество обновлено',
    productStats: 'Статистика товаров',
    withBarcode: 'Со штрих-кодом',
    withoutBarcode: 'Без штрих-кода',
    scanOrEnter: 'Отсканируйте товар или введите штрих-код/barid/название и нажмите Enter',
    newOrder: 'Новый заказ',
    newOrderConfirm: 'Начать новый заказ?',
    cartWillBeCleared: 'Текущая корзина будет очищена.',
    cartEmpty: 'Корзина пуста!',
    quantityError: 'Ошибка! Укажите количество для всех товаров (больше 0).',
    invalidQuantity: 'Некорректное количество товаров:',
    quantityMustBeGreater: 'Количество должно быть >= 1',
    notEnoughStock: 'Недостаточно товара на складе!',
    required: 'Требуется',
    available: 'Доступно',
    confirmCheckout: 'Оформить кассовую продажу?',
    itemsCount: 'Товаров',
    totalAmount: 'Сумма',
    itemsWillBeRemoved: 'Товары будут списаны со склада и добавлены в аналитику.',
    saleSuccess: 'Кассовая продажа успешно оформлена!',
    saleId: 'ID продажи',
    itemsRemoved: 'Товары списаны со склада.',
    profitAdded: 'Прибыль добавлена в аналитику.',
    saleError: 'Ошибка при оформлении продажи',
    tryAgainOrContactAdmin: 'Попробуйте ещё раз или обратитесь к администратору.',
    loadingProducts: 'Загрузка товаров...',
    productNotFound: 'Товар не найден',
    cash: 'Наличные',
    card: 'Карта',
    totalLabel: 'Итого',
    clearCart: 'Очистить корзину',
    paymentMethodLabel: 'Способ оплаты',
    pieces: 'шт.',
    profit: 'Прибыль',
    processing: 'Обработка...',
    purchased: 'Куплено',
    cardType: 'Тип карты',
    other: 'Другие',
    
    // Уведомления (NotificationsPanel)
    allNotifications: 'Все уведомления',
    unreadNotifications: 'Непрочитанные уведомления',
    readNotifications: 'Прочитанные уведомления',
    markAsRead: 'Отметить как прочитанное',
    markAsUnread: 'Отметить как непрочитанное',
    deleteNotification: 'Удалить уведомление',
    noNotifications: 'Уведомлений нет',
    lowStock: 'Низкий запас',
    systemNotification: 'Системное уведомление',
    
    // SMM панель (CompanySMMPanel)
    smmPanel: 'SMM панель',
    uploadPhoto: 'Загрузить фото',
    uploadVideo: 'Загрузить видео',
    createAd: 'Создать рекламу',
    mediaGallery: 'Галерея медиа',
    myAds: 'Мои рекламы',
    adTitle: 'Заголовок рекламы',
    adDescription: 'Описание рекламы',
    publishAd: 'Опубликовать рекламу',
    deleteMedia: 'Удалить медиа',
    editMedia: 'Редактировать медиа',
    noMediaYet: 'Медиа ещё нет',
    noAdsYet: 'Рекламы ещё нет',
    uploadInstructions: 'Инструкция по загрузке рекламы',
    recommendedSizes: 'Рекомендуемые размеры:',
    aspectRatio: 'Соотношение сторон: 16:9 или 21:9 (как в примере)',
    minWidth: 'Минимальная ширина: 1200 пикселей',
    maxFileSize: 'Максимальный размер файла: 5 МБ',
    fileFormat: 'Формат: JPG, PNG, WebP',
    uploadTip: 'Совет: Используйте яркие и привлекательные изображения. После загрузки нажмите кнопку "Отправить на модерацию" для проверки администратором.',
    adBanners: 'Рекламные баннеры',
    uploadAd: 'Загрузить рекламу',
    underModeration: 'На модерации',
    noAdBannersYet: 'Рекламные баннеры не добавлены',
    
    // Сообщения об ошибках
    errorLoading: 'Ошибка загрузки',
    errorSaving: 'Ошибка сохранения',
    errorDeleting: 'Ошибка удаления',
    errorInvalidData: 'Неверные данные',
    errorNetwork: 'Ошибка сети',
    
    // Подтверждения
    confirmDelete: 'Вы уверены, что хотите удалить?',
    confirmCancel: 'Вы уверены, что хотите отменить?',
    confirmLogout: 'Вы уверены, что хотите выйти?',
    
    // ============== НОВЫЕ КЛЮЧИ ДЛЯ ВНУТРЕННИХ ПАНЕЛЕЙ ==============
    
    // Аналитика (AnalyticsPanel) - внутренние
    loadingAnalytics: 'Загрузка аналитики...',
    financesAndAnalytics: 'Финансы и аналитика',
    paymentHistory: 'История платежей',
    periodAnalysis: 'Период анализа',
    selectPeriodAnalytics: 'Выберите период для отображения данных аналитики',
    profitFromMarkups: 'Прибыль от наценок',
    companyExpenses: 'Затраты компании',
    finalBalance: 'Итоговый баланс',
    charts: 'Диаграммы',
    salaryExpense: 'Зарплата',
    electricityExpense: 'Электричество',
    purchasesExpense: 'Закупки',
    otherExpenses: 'Другие затраты',
    profitAndExpenses: 'Прибыль и затраты',
    currentPeriod: 'Текущий период',
    previousPeriod: 'Предыдущий период',
    salesDynamics: 'Динамика продаж',
    topSellingProducts: 'Топ продаваемые товары',
    productsSold: 'Продано',
    revenue: 'Выручка',
    noSalesYet: 'Продаж пока нет',
    advancedInsights: 'Расширенная аналитика',
    sum: 'сум',
    billion: 'млрд',
    million: 'млн',
    thousand: 'тыс',
    
    // Период времени
    today: 'Сегодня',
    yesterday: 'Вчера',
    thisWeek: 'Эта неделя',
    thisMonth: 'Этот месяц',
    thisYear: 'Этот год',
    allTime: 'Всё время',
    customPeriod: 'Свой период',
    day: 'День',
    week: 'Неделя',
    month: 'Месяц',
    year: 'Год',
    hour: 'Час',
    
    // История платежей (PaymentHistoryForCompany)
    paymentHistoryTitle: 'История платежей',
    totalPayments: 'Всего платежей',
    paidAmount: 'Оплачено',
    searchPayments: 'Поиск по заказу, клиенту, товару...',
    filters: 'Фильтры',
    allMethods: 'Все способы',
    checksAndCodes: 'Чеки/Коды',
    demoOnline: 'Демо онлайн',
    realOnline: 'Реальная онлайн',
    status: 'Статус',
    allStatuses: 'Все статусы',
    paid: 'Оплачено',
    pending: 'Ожидает',
    failed: 'Ошибка',
    period: 'Период',
    allPeriod: 'Всё время',
    customDates: 'Свой период',
    from: 'От',
    to: 'До',
    noPaymentsFound: 'Платежей не найдено',
    paymentDetails: 'Детали платежа',
    orderId: 'ID заказа',
    orderTime: 'Время заказа',
    paymentVia: 'Оплата через',
    productsInOrder: 'Товары в заказе',
    profitFromOrder: 'Прибыль',
    close: 'Закрыть',
    
    // Склад (DigitalWarehouse)
    digitalWarehouse: 'Цифровой склад',
    noCategory: 'Без категории',
    errorUpdatingProduct: 'Ошибка при обновлении товара',
    deleteProductConfirm: 'Удалить этот товар?',
    fillNameAndPrice: 'Заполните название и цену товара',
    markupTooHigh: 'Процент наценки слишком большой',
    errorAddingProduct: 'Ошибка при добавлении товара',
    deleteAllProductsConfirm: 'ВНИМАНИЕ! Вы собираетесь удалить ВСЕ товары. Это действие нельзя отменить. Продолжить?',
    successfullyDeleted: 'Успешно удалено',
    errorMassDelete: 'Ошибка при массовом удалении товаров',
    fileTooLarge: 'Файл слишком большой',
    tooManyRows: 'Слишком много строк',
    fileEmpty: 'Файл пустой!',
    productsImported: 'Товары импортированы',
    selectCategory: 'Выберите категорию',
    allCategories: 'Все категории',
    unavailable: 'Недоступно',
    pcs: 'шт',
    loadingWarehouse: 'Загрузка склада...',
    errorLoadingWarehouse: 'Ошибка загрузки:',
    productsCount: 'Товаров',
    totalInStock: 'Всего на складе',
    cost: 'Стоимость',
    categoriesCount: 'Категорий',
    searchPlaceholder: 'Поиск по названию, штрих-коду или barid...',
    addProductShort: 'Добавить',
    importFromExcelCSV: 'Импорт из Excel/CSV',
    importShort: 'Импорт',
    exportToExcel: 'Экспорт в Excel',
    exportShort: 'Экспорт',
    deleteAllProducts: 'Удалить все товары',
    companyIdNotFound: '❌ Ошибка: ID компании не найден. Пожалуйста, перезайдите в систему.',
    markupCorrected: 'Процент наценки исправлен',
    updateError: 'Ошибка при обновлении товара',
    deleteError: 'Ошибка при удалении товара',
    deleteCancelled: 'Удаление отменено',
    deleteSuccess: 'Успешно удалено',
    availabilityError: 'Ошибка при изменении доступности товара',
    excelReadError: 'Ошибка при чтении Excel файла: ',
    importSuccess: 'Успешно импортировано',
    importError: '❌ Не удалось импортировать товары!\n\nПроверьте формат файла.',
    importFileError: 'Ошибка при импорте файла: ',
    importSuccessDetailed: 'Успешно импортировано',
    importCheckFormat: '❌ Не удалось импортировать товары!\n\nПроверьте:\n• Правильно ли выбраны колонки для Названия и Цены\n• Есть ли валидные данные в этих колонках\n\nОткройте консоль (F12) для деталей.',
    importErrorGeneric: 'Ошибка при импорте: ',
    productNamePlaceholder: 'Название товара *',
    quantityPlaceholder: 'Количество',
    pricePlaceholder: 'Цена (сум) *',
    markupPercentPlaceholder: 'Процент наценки (%)',
    barcodePlaceholder: 'Штрих-код (опционально)',
    baridPlaceholder: 'Barid (5-6 цифр, опционально)',
    colorPlaceholder: 'Или введите цвет вручную...',
    sizePlaceholder: 'Например: XL, 40, 42-44...',
    brandPlaceholder: 'Например: Nike, Samsung, Apple...',
    categoryHeader: 'Категория',
    quantityHeader: 'Количество',
    basePriceHeader: 'Базовая цена',
    markupHeader: 'Наценка %',
    sellingPriceHeader: 'Цена продажи',
    barcodeHeader: 'Штрих-код',
    actionsHeader: 'Действия',
    fillProductInfo: 'Заполните информацию о товаре',
    categoriesAdminOnly: 'Категории создаются администратором',
    noProducts: 'Нет товаров на складе. Добавьте товары или импортируйте из Excel',
    productsNotFound: 'Товары не найдены',
    baridDigits: '5-6 цифр',
    addPhotoTitle: 'Добавить фото',
    productPhotos: 'Фотографии товара: ',
    productDescription: '📝 Описание товара',
    descriptionVisibleToCustomers: 'Введите описание товара (видно покупателям)',
    productColor: '🎨 Цвет товара',
    productSize: '📐 Размер товара',
    productBrand: '🏢 Бренд/Производитель',
    exampleLabel: 'Пример:',
    maxQuantityInfo: '✅ Если количество не указано, будет 0',
    markupInfo: '✅ Если наценка не указана, товар продается по базовой цене',
    baridInfo: '✅ Barid - только цифры, максимум 6 символов',
    consoleDetails: '✅ Откройте консоль (F12) для просмотра деталей импорта',
    colorExamples: 'Например: Красный, Синий...',
    sizeExamples: 'XL, 40, 42-44...',
    brandExamples: 'Nike, Samsung, Apple...',
    
    // Заказы (CompanyOrdersPanel)
    customerOrdersTitle: 'Заказы покупателей',
    searchOrdersPlaceholder: 'Поиск по коду, имени или телефону...',
    all: 'Все',
    waiting: 'Ожидают',
    completed: 'Выполнены',
    cancelled: 'Отменены',
    ordersNotFound: 'Заказы не найдены',
    guest: 'Гость',
    orderComposition: 'Состав заказа',
    colorLabel: 'Цвет:',
    orderDetailsTitle: 'Детали заказа',
    orderTimeLabel: 'Время заказа:',
    onlineCard: 'Онлайн карта',
    cashOrCheck: 'Наличные / Чек',
    cancelOrderBtn: 'Отменить',
    confirmOrderBtn: 'Подтвердить',
    confirmPaymentQuestion: 'Подтвердить получение оплаты за этот заказ?',
    paymentConfirmedSuccess: 'Оплата подтверждена!',
    errorConfirmingPayment: 'Ошибка при подтверждении оплаты',
    cancelOrderQuestion: 'Отменить этот заказ? Это действие нельзя отменить.',
    orderCancelledSuccess: 'Заказ отменен',
    errorCancellingOrder: 'Ошибка при отмене заказа',
    
    // Затраты (ExpensesManager)
    companyExpensesTitle: 'Затраты компании',
    addExpense: 'Добавить затрату',
    editExpenses: 'Редактировать',
    saveChanges: 'Сохранить',
    saving: 'Сохранение...',
    newExpense: 'Новая затрата',
    expenseName: 'Название затраты',
    expenseNamePlaceholder: 'Например: Аренда офиса',
    amountInSum: 'Сумма (сум)',
    descriptionOptional: 'Описание (опционально)',
    additionalInfo: 'Дополнительная информация',
    saveExpense: 'Сохранить затрату',
    deleteExpenseTooltip: 'Удалить затрату',
    expense: 'Затрата',
    refund: 'Возврат',
    enterAmount: 'Введите сумму',
    willBeAdded: 'Добавится:',
    willBeReduced: 'Уменьшится:',
    additionalCompanyExpense: 'Дополнительная затрата компании',
    fillNameAndAmount: 'Заполните название и сумму затраты',
    expenseAddedSuccess: 'Затрата успешно добавлена!',
    errorAddingExpense: 'Ошибка при добавлении затраты',
    deleteExpenseConfirm: 'Вы уверены что хотите удалить эту затрату?',
    expenseDeletedSuccess: 'Затрата успешно удалена!',
    errorDeletingExpense: 'Ошибка при удалении затраты',
    amountCannotBeNegative: 'Сумма затраты не может быть отрицательной',
    expensesUpdatedSuccess: 'Затраты успешно обновлены!',
    errorUpdatingExpenses: 'Ошибка обновления затрат',
    
    // Панель продаж (SalesPanel) - дополнительные
    errorLoadingData: 'Ошибка загрузки данных',
    errorSavingDescription: 'Ошибка при сохранении описания',
    productDescriptionSaved: 'Описание товара сохранено!',
    errorChangingProductStatus: 'Ошибка при изменении статуса товара',
    selectProductsForSale: 'Выберите товары для выставления на продажу',
    successfullyListed: 'Успешно выставлено!',
    errorListingProducts: 'Ошибка при выставлении товаров',
    confirmPaymentForOrder: 'Подтвердить получение оплаты за этот заказ?',
    paymentConfirmedProductsUpdated: 'Оплата подтверждена! Товары обновлены.',
    errorConfirmingPaymentOrder: 'Ошибка при подтверждении оплаты',
    errorSearchingOrder: 'Ошибка при поиске заказа',
    
    // CompanyOrdersPanel - дополнительные
    searchDots: 'Поиск...',
    searchByCodeNamePhone: 'Поиск по коду, имени или телефону...',
    refreshList: 'Обновить список',
    cashCheck: 'Наличные / Чек',
    confirmPaymentReceived: 'Подтвердить получение оплаты?',
    confirmError: 'Ошибка при подтверждении',
    cancelOrderConfirm: 'Отменить этот заказ? Это действие нельзя отменить.',
    cancelError: 'Ошибка при отмене',
    waitingOrders: 'Ожидают',
    confirmedOrders: 'Принятые',
    shippedOrders: 'В пути',
    acceptOrder: 'Принять заказ',
    acceptOrderConfirm: 'Принять этот заказ?',
    orderAccepted: 'Заказ принят',
    acceptOrderError: 'Ошибка при принятии заказа',
    markAsShipped: 'В пути',
    markAsShippedConfirm: 'Передать заказ доставщику?',
    orderShipped: 'Заказ передан доставщику',
    markAsShippedError: 'Ошибка при обновлении статуса',
    statusConfirmed: 'Принят',
    statusShipped: 'В пути',

    // Реферальные агенты (AdminReferralPanel, ReferralAgentPanel)
    referralAgents: 'Реферальные агенты',
    referralAgentsManagement: 'Управление реферальными агентами',
    referralAgentsDescription: 'Управление агентами и отслеживание статистики',
    totalAgents: 'Всего агентов',
    addAgent: 'Добавить агента',
    createNewAgent: 'Создать нового реферального агента',
    agentName: 'Имя агента',
    agentPhone: 'Номер телефона',
    agentPassword: 'Пароль',
    agentPasswordDigitsOnly: 'Пароль (только цифры)',
    agentPasswordHint: 'Минимум 4 цифры (только цифры 0-9)',
    referralCode: 'Реферальный код',
    uniqueCode: 'Уникальный код',
    active: 'Активен',
    inactive: 'Неактивен',
    myReferralCode: 'Мой реферальный код',
    myPassword: 'Мой пароль',
    loginForAgents: 'Вход для агентов',
    agentLoginDescription: 'Войдите, чтобы увидеть ваш реферальный код и статистику',
    welcomeAgent: 'Добро пожаловать',
    myCompanies: 'Мои компании',
    companiesLinked: 'Привязанные компании',
    trialCompanies: 'Пробные компании',
    disabledCompanies: 'Отключенные компании',
    copyReferralCode: 'Копировать код',
    shareWithCompanies: 'Поделитесь этим кодом с компаниями',
    yourLoginData: 'Ваши данные для входа',
    provideToCompanies: 'Предоставьте эти данные компаниям при регистрации',
    trialPeriodInfo: 'Компании, зарегистрировавшиеся с вашим кодом, получат 1 месяц пробного периода',
    noCompaniesYet: 'Пока нет компаний',
    shareYourCode: 'Предоставьте ваш код новым компаниям',
    registeredOn: 'Зарегистрирована',
    trialUntil: 'Пробный период до',
    days: 'дн.',
    disabled: 'Приостановлена',
    trial: 'Пробный период',
    phoneFormatError: 'Номер телефона должен содержать ровно 9 цифр',
    passwordRequired: 'Введите пароль',
    loginError: 'Ошибка входа',
    invalidPhoneOrPassword: 'Неверный телефон или пароль',
    dataLoadError: 'Ошибка загрузки данных',
    unknownError: 'Неизвестная ошибка',
    codeCopied: 'Код скопирован',
    
    // Финансовая аналитика агента (ReferralAgentAnalyticsPanel)
    financialAnalytics: 'Финансовая аналитика',
    hideEarnings: 'Скрыть доходы',
    showEarnings: 'Показать доходы',
    totalCompanySales: 'Продажи компаний',
    platformFee: 'Комиссия платформы',
    yourEarnings: 'Ваш доход',
    fromSales: 'от продаж',
    howCalculated: 'Как рассчитывается ваш доход?',
    platformTakes10: 'Платформа берёт 10% от продаж каждой компании',
    youGet10OfPlatform: 'Вы получаете 10% от комиссии платформы',
    totalYouGet1: 'Итого: вы получаете 1% от всех продаж ваших компаний',
    companiesFinancials: 'Финансы по компаниям',
    company: 'Компания',
    yourCommission: 'Ваша комиссия',
    
    // Компания - вход и регистрация
    companyLogin: 'Вход для компании',
    companyLoginTitle: 'Вход для компании',
    companyLoginDescription: 'Введите данные компании',
    enterCompanyData: 'Введите данные компании',
    publicCompanyRegistration: 'Публичная компания',
    privateCompanyRegistration: 'Приватная компания',
    fillPublicCompanyData: 'Заполните данные для регистрации публичной компании',
    fillPrivateCompanyData: 'Заполните данные для регистрации приватной компании',
    firstName: 'Имя',
    lastName: 'Фамилия',
    companyId: 'ID компании',
    companyIdUnique: 'ID компании (уникальный)',
    companyIdHint: 'Покупатели будут использовать этот ID для доступа к вашей компании',
    phoneNumber: 'Номер телефона',
    password: 'Пароль',
    enterPassword: 'Введите пароль',
    accessKey: 'Ключ доступа',
    accessKey30chars: 'Ключ доступа (30 символов)',
    generate: 'Сгенерировать',
    backToModeSelection: 'Назад к выбору режима',
    registerCompany: 'Зарегистрировать компанию',
    optional: 'опционально',
    referralCodeOptional: 'Реферальный код (опционально)',
    referralCodeHint: 'Если у вас есть код от реферального агента, введите его здесь',
    enterName: 'Введите имя',
    enterLastName: 'Введите фамилию',
    enterCompanyId: 'Введите ID компании',
    enterCompanyName: 'Введите название компании',
    phoneNumberHint: '9 цифр без кода страны',
    loginButton: 'Войти',
    fillAllFields: 'Пожалуйста, заполните все поля',
    
    // SMM Panel
    profileTab: 'Профиль',
    companyProfileTab: 'Профиль компании',
    adsTab: 'Реклама',
    salesCount: 'Продаж',
    subscribersCount: 'Подписчиков',
    logo: 'Логотип',
    uploadingLogo: 'Загрузка логотипа...',
    logoUploaded: '✅ Логотип загружен!',
    logoUploadError: 'Ошибка загрузки логотипа',
    ratings: 'оценок',
    saveButton: 'Сохранить',
    editButton: 'Редактировать',
    locationLabel: 'Локация',
    selectLocation: 'Выберите локацию на карте',
    locationSelected: 'Локация выбрана на карте!',
    notSpecified: 'Не указано',
    companyDescPlaceholder: 'Расскажите о вашей компании',
    noDescription: 'Описание не добавлено',
    adsInstruction: '📸 Инструкция по загрузке рекламы',
    formats: 'Форматы:',
    adsTip: '💡 Совет:',
    adsTipText: 'Используйте яркие и привлекательные изображения. После загрузки нажмите кнопку "Отправить на модерацию" для проверки администратором.',
    deleteAllAdsConfirm: 'Вы уверены, что хотите удалить ВСЕ рекламы? Это действие нельзя отменить.',
    deletingAllAds: 'Удаление всех реклам...',
    adsDeleted: '✅ Удалено',
    adsDeleteError: 'Ошибка удаления реклам',
    deleteAllButton: 'Удалить все',
    uploadImageForModeration: 'Загрузите изображение и отправьте на модерацию администратору',
    uploadFirstAd: 'Загрузить первую рекламу',
    deleteAdConfirm: 'Вы уверены, что хотите удалить эту рекламу?',
    deletingAd: 'Удаление рекламы...',
    adDeleted: '🗑️ Реклама удалена',
    adDeleteError: 'Ошибка удаления рекламы',
    statusPending: 'На модерации',
    statusApproved: 'Одобрено',
    statusRejected: 'Отклонено',
    rejectionReason: 'Причина отклонения:',
    uploadAdTitle: 'Создать рекламу',
    adType: 'Тип рекламы *',
    companyAd: 'Компания',
    productAd: 'Товар',
    selectProductRequired: 'Выберите товар *',
    nameRequired: 'Название *',
    enterNamePlaceholder: 'Введите название',
    addDescriptionPlaceholder: 'Добавьте описание',
    uploadMethod: 'Способ добавления изображения',
    uploadFile: '📁 Загрузить файл',
    insertURL: '🔗 Вставить URL',
    dragImageHere: 'Перетащите изображение сюда',
    or: 'или',
    removeFile: '✕ Удалить и выбрать другой файл',
    recommendedTip: '💡 Рекомендуется: 1200x600px, до 5 MB, форматы JPG/PNG/WebP',
    imageURL: 'URL изображения *',
    imageURLExample: '(например, с Imgur, ImgBB)',
    imageURLPlaceholder: 'https://example.com/image.jpg',
    urlTip: '💡 Рекомендуется использовать изображения размером 1200x600px или больше',
    previewLabel: 'Предпросмотр:',
    cancelButton: 'Отмена',
    createAdButton: '🎪 Создать рекламу',
    profileSaved: '✅ Профиль успешно сохранён!',
    saveProfileError: 'Ошибка:',
    creatingAd: 'Создание рекламы...',
    selectFileToUpload: 'Выберите файл для загрузки',
    enterImageURL: 'Введите URL изображения',
    enterTitle: 'Введите название',
    selectProductForAd: 'Выберите товар для рекламы',
    pleaseUploadImage: 'Пожалуйста, загрузите изображение',
    productsLoadError: 'Ошибка загрузки товаров',
    companyAdDescription: 'Реклама всей компании - клик переведет на профиль компании',
    productAdDescription: 'Реклама конкретного товара - клик переведет на страницу товара',
    noProductsAddFirst: 'У вас нет товаров. Сначала добавьте товары.',
    selectProductOption: '-- Выберите товар --',
    adCreated: '🎪 Реклама',
    adCreatedStatus: 'создана! Статус: на модерации',
    companyGenitive: 'компании',
    productGenitive: 'товара',
    
    // Sales Panel
    saveError: '❌ Ошибка при сохранении',
    productDescSaved: '✅ Описание товара сохранено!',
    statusChangeError: 'Ошибка при изменении статуса товара',
    listedProductsAvailable: 'товаров доступны для покупателей',
    timeSeconds: 'Время:',
    listProductsError: 'Ошибка при выставлении товаров',
    paymentConfirmError: 'Ошибка при подтверждении оплаты',
    orderSearchError: 'Ошибка при поиске заказа',
    selectProductsToRemove: 'Выберите товары для снятия с продажи',
    removeFromSaleConfirm: 'товаров из панели покупателей?',
    successfullyRemoved: '✅ Успешно убрано!',
    removedProductsHidden: 'товаров скрыты от покупателей',
    removeFromSaleError: 'Ошибка при снятии товаров с продажи',
    searchByName: 'Поиск по названию...',
    foundOrder: 'Найденный заказ',
    receipt: 'Чек',
    noProductsInStock: 'Нет товаров в наличии',
    listForCustomers: 'Выставить товары для покупателей',
    listForCustomersDesc: 'Эти товары станут доступны в магазине для покупателей',
    productsAvailableForCustomers: 'Товары будут доступны покупателям',
    productDetails: 'Детали товара',
    productDetailsDesc: 'Подробная информация о товаре',
    describeProduct: 'Опишите этот товар... Можно использовать ссылки, эмодзи 🎉',
    storeInfo: 'Информация о магазине',
    storeName: 'Название',
    storePhone: 'Телефон',
    storeAddress: 'Адрес',
    describeProducts: 'Опишите ваши товары... Можно использовать ссылки, эмодзи 🎉',
    alreadyOnSale: 'Уже в продаже',
    willBeListed: 'Будет выставлен',
    editProductDescTitle: 'Редактировать описание этого товара',
    noDescriptionClickEdit: 'Нет описания. Нажмите «Редактировать» чтобы добавить описание этого товара.',
    onSale: 'В продаже',
    notOnSale: 'Не в продаже',
    paymentReceived: 'Оплата получена',
    pendingPayment: 'Ожидает оплаты',
    
    // Analytics Panel
    analyticsLoadError: 'Ошибка загрузки данных аналитики',
    monthsShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    profitCategory: 'Прибыль',
    expensesCategory: 'Затраты',
    totalCategory: 'Итог',
    zoomOut: 'Уменьшить',
    zoomIn: 'Увеличить',
    zoomReset: 'Сбросить',
    periodToday: 'Сегодня',
    periodYesterday: 'Вчера',
    periodThisWeek: 'Эта неделя',
    periodThisMonth: 'Этот месяц',
    periodThisYear: 'Этот год',
    periodCurrent: 'Текущий период',
    periodPrevYesterday: 'Позавчера',
    periodWeekAgo: 'Неделя назад',
    periodMonthAgo: 'Месяц назад',
    periodYearAgo: 'Год назад',
    periodPrevious: 'Предыдущий период',
    
    // Analytics - Additional translations
    daysOfWeek: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    weekLabel: 'Нед',
    dayLabel: 'День',
    monthLabel: 'Мес',
    growthDynamics: 'Динамика роста',
    selectSpecificPeriod: 'Выберите конкретный период для аналитики',
    
    // Payment methods and statuses
    plasticCards: '💳 Пластиковые карты',
    cashPayment: '💵 Наличные',
    paidStatus: '✅ Оплачено',
    pendingStatus: '⏳ Ожидает',
    errorStatus: '❌ Ошибка',
    checksCodesPayment: 'Чеки/Коды',
    
    // Company Orders Panel
    invalidDeliveryCoords: 'Неверный формат координат доставки',
    mapOpenError: 'Ошибка при открытии карты',
    deliveryRecipient: 'Получатель:',
    deliveryAddress: 'Адрес доставки:',
    fromCompany: 'Откуда (Компания)',
    toDelivery: 'Куда (Доставка)',
    
    // Admin Analytics Panel
    platformAnalytics: 'Аналитика платформы',
    allCompaniesStats: 'Общая статистика всех компаний',
    companyStats: 'Статистика компании',
    allCompanies: 'Все компании',
    specificCompany: 'Конкретная компания',
    selectCompanyPlaceholder: 'Выберите компанию...',
    refresh: 'Обновить',
    generalRevenue: 'Общая выручка',
    netProfit: 'Чистая прибыль',
    profitFromMarkup: 'Прибыль от наценок',
    productsInDatabase: 'Товаров в базе',
    productUnits: 'Единиц товаров',
    frozenInStock: 'Заморожено на складе',
    deliveryRevenueTotal: 'Доход от доставки',
    companyAnalytics: 'Аналитика по компаниям',
    productAnalytics: 'Аналитика товаров',
    ordersCount: 'Заказов',

    // Advanced Insights Panel
    leastSold: 'Хуже продаются',
    remaining: 'осталось',
    threshold: 'Порог',
    top20products: 'TOP 20 товаров',
    lowStockDescription: 'Дешёвые: ≤20 шт • Дорогие: ≤10 шт',
    allInStockMessage: 'Все товары в наличии',

    // Payment History date filter
    selectSpecificDay: '📅 Выбрать конкретный день',
    selectSpecificDayHint: 'Выберите дату для фильтрации продаж за конкретный день',

    // Table headers (short)
    methodHeader: 'Метод',
    detailsBtn: 'Детали',
    
    // Excel Column Mapper
    excelColumnMapping: 'Сопоставление колонок Excel',
    excelColumnMappingDesc: 'Укажите какая колонка соответствует какому полю',
    productNameField: 'Название товара',
    quantityField: 'Количество',
    basePriceField: 'Базовая цена',
    markupPercentField: 'Процент наценки (%)',
    barcodeField: 'Штрих-код',
    baridField: 'Barid (5-6 цифр)',
    notSelected: '-- Не выбрано --',
    columnLabel: 'Колонка',
    emptyColumnName: '(пустое название)',
    dataPreview: 'Предпросмотр данных:',
    emptyCell: '(пусто)',
    filePreviewRowsTitle: 'Предпросмотр первых строк файла',
    importantInfo: 'ℹ️ Важная информация:',
    requiredFields: 'Обязательные поля:',
    optionalFields: 'Опциональные поля:',
    quantityNotSpecifiedHint: 'Если количество не указано, будет установлено значение 0',
    markupNotSpecifiedHint: 'Если наценка не указана, товар будет продаваться по базовой цене',
    barcodeNotSpecifiedHint: 'Если штрих-код не указан, товар можно будет добавить позже',
    fillRequiredFieldsAlert: 'Заполните обязательные поля: Название и Цена',
    confirmAndImport: 'Подтвердить и импортировать',
    
    // Import Progress Messages
    importingFromCSV: 'Импорт {count} товаров из CSV/TXT...',
    importingToDatabase: 'Импорт {count} товаров в базу данных...',
    processingExcelData: 'Обработка данных из Excel...',
    updatingData: 'Обновление данных...',
  },
  
  uz: {
    // Общие
    welcome: 'Xush kelibsiz',
    settings: 'Sozlamalar',
    save: 'Saqlash',
    cancel: 'Bekor qilish',
    delete: "O'chirish",
    edit: 'Tahrirlash',
    add: "Qo'shish",
    search: 'Qidiruv',
    loading: 'Yuklanmoqda...',
    error: 'Xato',
    success: 'Muvaffaqiyatli',
    confirm: 'Tasdiqlash',
    back: 'Orqaga',
    
    // Магазин покупателя
    store: 'Do\'kon',
    welcomeUser: 'Xush kelibsiz',
    cart: 'Savat',
    myOrders: 'Mening buyurtmalarim',
    likes: 'Tanlangan',
    totalPrice: 'Jami',
    checkout: 'Rasmiylashtirish',
    emptyCart: 'Savat bo\'sh',
    addToCart: 'Savatga',
    removeFromCart: 'Olib tashlash',
    quantity: 'Miqdor',
    price: 'Narx',
    product: 'Mahsulot',
    products: 'Mahsulotlar',
    inStock: 'Mavjud',
    outOfStock: 'Mavjud emas',
    searchProducts: 'Mahsulotlarni qidirish...',
    noProductsFound: 'Mahsulotlar topilmadi',
    
    // Заказы и чеки
    orderCode: 'Buyurtma kodi',
    orderDate: 'Sana',
    orderStatus: 'Holat',
    orderTotal: 'Summa',
    orderItems: 'Mahsulotlar',
    orderPending: 'Kutilmoqda',
    orderPaid: "To'langan",
    orderCancelled: 'Bekor qilingan',
    cancelOrder: 'Buyurtmani bekor qilish',
    deleteReceipt: "Ro'yxatdan o'chirish",
    deleteReceiptConfirm: "Bu chekni savatdan o'chirasizmi?\n\n⚠️ Chek kompaniya tizimida qoladi, faqat sizning ro'yxatingizdan o'chiriladi.",
    receiptDeleted: "Chek savatdan o'chirildi!",
    
    // Оплата
    payment: "To'lov",
    paymentMethod: "To'lov usuli",
    paymentManual: 'Cheklar/Kodlar',
    paymentDemo: 'Demo onlayn',
    paymentReal: 'Haqiqiy onlayn',
    payNow: "To'lash",
    paymentSuccess: "To'lov muvaffaqiyatli",
    paymentFailed: "To'lov xatosi",
    
    // Профиль компании
    companyProfile: 'Kompaniya profili',
    companyName: 'Kompaniya nomi',
    companyLocation: 'Joylashuv',
    companyProducts: 'Mahsulotlar',
    companyPhotos: 'Fotogalereya',
    companyAds: 'Reklama',
    rateCompany: 'Kompaniyani baholang',
    yourRating: 'Sizning bahoyingiz',
    
    // Настройки покупателя
    settingsTitle: 'Sozlamalar',
    language: 'Til',
    languageRussian: 'Ruscha',
    languageUzbek: "O'zbekcha",
    displayMode: 'Displey rejimi',
    displayModeDay: 'Kunduzgi',
    displayModeNight: 'Tungi',
    logout: 'Chiqish',
    
    // Цифровой склад
    inventory: 'Raqamli ombor',
    addProduct: "Mahsulot qo'shish",
    editProduct: 'Mahsulotni tahrirlash',
    deleteProduct: "Mahsulotni o'chirish",
    productName: 'Mahsulot nomi',
    productPrice: 'Narx',
    productQuantity: 'Miqdor',
    productBarcode: 'Shtrix-kod',
    productCategory: 'Kategoriya',
    productImage: 'Rasm',
    markup: 'Ustama',
    markupPercent: 'Ustama foizi',
    sellingPrice: 'Sotuv narxi',
    purchasePrice: 'Xarid narxi',
    
    // Цифровой склад - новые переводы
    importFile: 'Faylni import qilish',
    enterBarcodes: 'Shtrix-kodlarni kiriting',
    totalProducts: 'Jami mahsulotlar',
    totalQuantity: 'Jami miqdor',
    totalValue: 'Jami narx',
    categoriesManagement: 'Kategoriyalarni boshqarish',
    manageCategories: 'Kategoriyalarni boshqarish',
    deleteAll: 'Hammasini o\'chirish',
    deleteAllConfirm: 'Barcha mahsulotlarni o\'chirasizmi?\n\n⚠️ Bu sizning omboringizdan barcha mahsulotlarni o\'chiradi.',
    showing: 'Ko\'rsatilgan',
    of: 'dan',
    photo: 'Rasm',
    name: 'Nomi',
    category: 'Kategoriya',
    barcode: 'Shtrix-kod',
    colors: 'Ranglar',
    priceWithMarkup: 'Ustama bilan narx',
    priceWithMarkupTotal: 'Ustama bilan jami narx',
    actions: 'Harakatlar',
    yes: 'Ha',
    no: 'Yo\'q',
    hasColorOptions: 'Rang variantlari mavjud',
    color: 'Rang',
    any: 'Har qanday',
    importExcel: 'Excel',
    importCSV: 'CSV',
    importTXT: 'TXT',
    selectFile: 'Faylni tanlash',
    uploading: 'Yuklanmoqda...',
    uploadSuccess: 'Fayl muvaffaqiyatli yuklandi',
    uploadFailed: 'Faylni yuklashda xato',
    
    // Админ панель
    adminPanel: 'Admin panel',
    companies: 'Kompaniyalar',
    addCompany: "Kompaniya qo'shish",
    editCompany: 'Kompaniyani tahrirlash',
    deleteCompany: "Kompaniyani o'chirish",
    users: 'Foydalanuvchilar',
    orders: 'Buyurtmalar',
    statistics: 'Analitika',
    
    // История продаж
    salesHistory: 'Sotuv tarixi',
    salesDate: 'Sotuv sanasi',
    salesTotal: 'Sotuv summasi',
    salesProfit: 'Foyda',
    
    // Финансы
    finance: 'Moliya',
    totalRevenue: 'Umumiy daromad',
    totalProfit: 'Umumiy foyda',
    totalExpenses: 'Umumiy xarajatlar',
    frozenInProducts: 'Mahsulotlarda muzlatilgan',
    
    // SMM
    smm: 'SMM',
    photos: 'Fotosuratlar',
    videos: 'Videolar',
    ads: 'Reklama',
    
    // Chat
    chat: 'Chat',
    
    // Импорт товаров
    importProducts: 'Mahsulotlarni import qilish',
    importFromFile: 'Fayldan import qilish',
    
    // Цифровая касса
    cashRegister: 'Offline',
    scanBarcode: 'Shtrix-kodni skanerlash',
    enterBarcode: 'Shtrix-kodni kiriting',
    total: 'Jami',
    completeSale: 'Sotuvni yakunlash',
    
    // Компания - новые переводы
    companyPanel: 'Kompaniya paneli',
    salesPanel: 'Sotuv paneli',
    barcodeSearch: 'Offline',
    notifications: 'Xabarlar',
    companyManagement: 'Kompaniya boshqaruv',
    discountsManagement: 'Chegirmalar boshqaruvi',
    searchByBarcode: 'Offline',
    
    // Управление скидками (CompanyDiscountsPanel)
    regularDiscounts: 'Oddiy chegirmalar',
    aggressiveDiscounts: 'Qattiq chegirmalar',
    applyToVariant: 'Variantga qoʻllash',
    wholeProductAnyVariant: 'Butun mahsulot (har qanday variant)',
    discountOnMarkupOnly: 'Faqat ustamaga chegirma. Narx tan narxdan past bo\'lmaydi.',
    discountOnFullAmount: 'Butun summaga chegirma (narx + ustama). Tan narxdan past bo\'lishi mumkin.',
    noActiveDiscounts: 'Sizda hali faol chegirmalar yo\'q',
    createFirstDiscount: 'Ko\'proq xaridorlarni jalb qilish uchun birinchi chegirmani yarating!',
    createDiscount: 'Chegirma yaratish',
    createAggressiveDiscount: 'Qattiq chegirma yaratish',
    useAggressiveForLiquidation: 'Qattiq chegirmalarni eskirgan tovarlarni yo\'qotish uchun ishlating!',
    closeBtn: 'Yopish',
    createDiscountBtn: 'Chegirma yaratish',
    selectProduct: 'Mahsulotni tanlang',
    selectProductError: 'Mahsulotni tanlang va chegirma foizini kiriting',
    allProductsOnDiscount: 'Barcha mahsulotlar allaqachon chegirmada (oddiy yoki qattiq)',
    discountPercentLabel: 'Chegirma foizi * (0-100)',
    promoTitleLabel: 'Aksiya nomi (ixtiyoriy)',
    promoTitlePlaceholder: 'Masalan: Qish sotilishi',
    descriptionLabel: 'Tavsif (ixtiyoriy)',
    descriptionPlaceholder: 'Chegirma haqida qo\'shimcha ma\'lumot',
    startDateLabel: 'Chegirma boshlanishi (ixtiyoriy)',
    endDateLabel: 'Chegirma tugashi (ixtiyoriy)',
    durationHint: 'Minimal muddat — 1 soat. Agar ko\'rsatilmasa — muddatsiz.',
    discountCreated: 'Chegirma muvaffaqiyatli yaratildi!',
    discountCreationError: 'Chegirma yaratishda xato',
    deleteDiscountConfirm: 'Chegirmani o\'chirmoqchimisiz?',
    errorDeletingDiscount: 'Chegirmani o\'chirishda xato',
    loadingText: 'Yuklanmoqda...',
    activeStatus: 'Faol',
    inactiveStatus: 'Nofaol',
    createdOn: 'Yaratilgan:',
    originalPrice: 'Ustama bilan narx',
    withDiscount: 'Chegirmali',
    discountPercent: 'Chegirma',
    minDurationOneHour: 'Chegirmaning minimal muddati - 1 soat',
    createdDate: 'Yaratilgan',
    startLabel: 'Dan',
    endLabel: 'Gacha',
    currency: 'so\'m',
    aggressiveDiscountHint: 'Chegirma ustama bilan summaga qo\'llaniladi, zararlarga olib kelishi mumkin',
    priceBelowCost: 'Narx tan narxdan past',
    
    // Настройки компании (CompanySettingsPanel)
    privacySettings: 'Maxfiylik sozlamalari',
    privacyTitle: 'Maxfiylik sozlamalari',
    privacyDescription: 'Xaridorlar uchun mahsulotlaringizning ko\'rinishini boshqaring',
    currentMode: 'Joriy rejim',
    privateCompany: 'Shaxsiy kompaniya',
    publicCompany: 'Ommaviy kompaniya',
    privateMode: '🔒 Shaxsiy',
    publicMode: '🌐 Ommaviy',
    publicModeTitle: '🌐 Ommaviy rejim',
    publicModeDescription: 'Sizning mahsulotlaringiz barcha foydalanuvchilarga ko\'rinadi. Turli kompaniyalardan xaridorlar umumiy katalogda barcha ommaviy mahsulotlarni ko\'radilar.',
    privateModeTitle: '🔒 Shaxsiy rejim',
    privateModeDescription: 'Sizning mahsulotlaringiz faqat noyob kirish kodini biladigan xaridorlarga ko\'rinadi. Har bir xaridor faqat sizning kompaniyangizning mahsulotlari bilan shaxsiy panelga kiradi.',
    yourAccessCode: 'Sizning kirish kodingiz',
    shareCodeWithCustomers: 'Ushbu kodni xaridorlaringiz bilan baham ko\'ring',
    copyCode: 'Nusxalash',
    copied: 'Nusxalandi!',
    switchToPublicMode: 'Ommaviy rejimga o\'tkazish',
    switchToPrivateMode: 'Shaxsiy rejimga o\'tkazish',
    switching: 'O\'tkazilmoqda...',
    switchToPublicConfirm: 'Kompaniyani ommaviy rejimga o\'tkazish? Sizning mahsulotlaringiz barcha foydalanuvchilarga ko\'rinadi. Kirish kodi o\'chiriladi.',
    switchToPrivateConfirm: 'Kompaniyani shaxsiy rejimga o\'tkazish? Sizning mahsulotlaringizga kirish uchun xaridorlar kiritishi kerak bo\'lgan noyob kirish kodi (5-6 raqam) yaratiladi.',
    switchedToPrivate: '✅ Kompaniya shaxsiy rejimga o\'tkazildi!',
    switchedToPublic: '✅ Kompaniya ommaviy rejimga o\'tkazildi!',
    importantNote: '⚠️ Muhim:',
    privacyImportantNote1: 'Ommaviy rejimdan shaxsiy rejimga o\'tganda yangi noyob kod (5-6 raqam) yaratiladi',
    privacyImportantNote2: 'Ommaviy rejimga qaytganda kirish kodi o\'chiriladi',
    privacyImportantNote3: 'Xaridorlar sizning mahsulotlaringizga kirish uchun ro\'yxatdan o\'tish yoki kirish paytida kodni kiritishlari kerak',
    errorLoadingCompanyData: 'Kompaniya ma\'lumotlarini yuklashda xatolik',
    errorChangingPrivacy: 'Maxfiylik rejimini o\'zgartirishda xatolik',
    errorCopyingCode: 'Kodni nusxalash muvaffaqiyatsiz',
    
    // Панель продаж (SalesPanel)
    availableProducts: 'Mavjud mahsulotlar',
    manageSales: 'Sotuvlarni boshqarish',
    customerOrders: 'Mijoz buyurtmalari',
    ordersToday: 'Bugungi buyurtmalar',
    salesAmount: 'Sotuv miqdori',
    profitAmount: 'Foyda miqdori',
    toggleAvailability: 'Mavjudlikni o\'zgartirish',
    availableForCustomers: 'Mijozlar uchun mavjud',
    makeAvailable: 'Mavjud qilish',
    makeUnavailable: 'Mavjud emas qilish',
    confirmPayment: 'To\'lovni tasdiqlash',
    viewReceipt: 'Chekni ko\'rish',
    searchByCode: 'Kod bo\'yicha qidirish',
    searchOrder: 'Buyurtmani qidirish',
    orderNotFound: 'Buyurtma topilmadi',
    confirmingPayment: 'To\'lovni tasdiqlash',
    paymentConfirmed: 'To\'lov tasdiqlandi',
    bulkActions: 'Ko\'plab harakatlar',
    selectAll: 'Hammasini tanlash',
    deselectAll: 'Tanlashni bekor qilish',
    productsAvailable: 'Mahsulotlar mavjud',
    productsSelected: 'Tanlangan mahsulotlar',
    putOnSale: 'Sotuvga qo\'yish',
    removeFromSale: 'Sotuvdan olib tashlash',
    
    // Аналитика (AnalyticsPanel)
    analytics: 'Analitika',
    topProducts: 'Eng yuqori mahsulotlar',
    revenueChart: 'Daromad grafigi',
    profitMargin: 'Foyda foizi',
    totalSales: 'Umumiy sotuvlar',
    averageOrder: 'O\'rta buyurtma',
    salesTrend: 'Sotuv tendensiya',
    productPerformance: 'Mahsulot faoliyati',
    dailySales: 'Kundalik sotuvlar',
    weeklySales: 'Haftalik sotuvlar',
    monthlySales: 'Oylik sotuvlar',
    comparison: 'Taqqoslash',
    salesLeaders: 'Sotuv yetakchilari',
    mostProfitable: 'Eng foydali',
    lowStockProducts: 'Qoldig\'i kam mahsulotlar',
    cheap: 'Arzon',
    expensive: 'Qimmat',
    
    // Заказы (OrdersPanel)
    allOrders: 'Barcha buyurtmalar',
    pendingOrders: 'Kutilayotgan buyurtmalar',
    completedOrders: 'Yakunlangan buyurtmalar',
    cancelledOrders: 'Bekor qilingan buyurtmalar',
    filterByStatus: 'Holat bo\'yicha filtrlash',
    orderDetails: 'Buyurtma tafsilotlari',
    customer: 'Mijoz',
    phone: 'Telefon',
    orderConfirmed: 'Buyurtma tasdiqlandi',
    
    // Поиск по штрих-коду (BarcodeSearchPanel)
    offline: 'Offline',
    barcodeSearchTitle: 'Offline',
    enterBarcodeManually: 'Shtrix-kodni qo\'lda kiriting',
    scanWithCamera: 'Kamera yordamida skanerlang',
    barcodeFound: 'Shtrix-kod topildi',
    barcodeNotFound: 'Shtrix-kod topilmadi',
    updateQuantity: 'Miqdorni yangilash',
    currentStock: 'Joriy ombor',
    newQuantity: 'Yangi miqdor',
    quantityUpdated: 'Miqdor yangilandi',
    productStats: 'Mahsulotlar statistikasi',
    withBarcode: 'Shtrix-kodli',
    withoutBarcode: 'Shtrix-kodsiz',
    scanOrEnter: 'Mahsulotni skanerlang yoki shtrix-kod/barid/nomini kiriting va Enter bosing',
    newOrder: 'Yangi buyurtma',
    newOrderConfirm: 'Yangi buyurtma boshlamoqchimisiz?',
    cartWillBeCleared: 'Joriy savatcha tozalanadi.',
    cartEmpty: 'Savatcha bo\'sh!',
    quantityError: 'Xato! Barcha mahsulotlar uchun miqdorni kiriting (0 dan katta).',
    invalidQuantity: 'Noto\'g\'ri mahsulot miqdori:',
    quantityMustBeGreater: 'Miqdor >= 1 bo\'lishi kerak',
    notEnoughStock: 'Omborda tovar yetarli emas!',
    required: 'Kerak',
    available: 'Mavjud',
    confirmCheckout: 'Kassa sotuvini amalga oshirasizmi?',
    itemsCount: 'Mahsulotlar',
    totalAmount: 'Summa',
    itemsWillBeRemoved: 'Tovarlar ombordan olinadi va tahlilga qo\'shiladi.',
    saleSuccess: 'Kassa sotuvi muvaffaqiyatli amalga oshirildi!',
    saleId: 'Sotuv ID',
    itemsRemoved: 'Tovarlar ombordan olindi.',
    profitAdded: 'Foyda tahlilga qo\'shildi.',
    saleError: 'Sotuvni amalga oshirishda xato',
    tryAgainOrContactAdmin: 'Qayta urinib ko\'ring yoki ma\'murga murojaat qiling.',
    loadingProducts: 'Mahsulotlar yuklanmoqda...',
    productNotFound: 'Mahsulot topilmadi',
    cash: 'Naqd',
    card: 'Karta',
    totalLabel: 'Jami',
    clearCart: 'Savatchani tozalash',
    paymentMethodLabel: 'To\'lov usuli',
    pieces: 'dona',
    profit: 'Foyda',
    processing: 'Ishlanmoqda...',
    purchased: 'Sotib olindi',
    cardType: 'Karta turi',
    other: 'Boshqalar',
    
    // Уведомления (NotificationsPanel)
    allNotifications: 'Barcha xabarlar',
    unreadNotifications: 'O\'qilmagan xabarlar',
    readNotifications: 'O\'qilgan xabarlar',
    markAsRead: 'O\'qilgan deb belgilash',
    markAsUnread: 'O\'qilmagan deb belgilash',
    deleteNotification: 'Xabarni o\'chirish',
    noNotifications: 'Xabarlar yo\'q',
    lowStock: 'Omborda kam',
    systemNotification: 'Tizim xabari',
    
    // SMM панель (CompanySMMPanel)
    smmPanel: 'SMM paneli',
    uploadPhoto: 'Rasmni yuklash',
    uploadVideo: 'Videoni yuklash',
    createAd: 'Reklama yaratish',
    mediaGallery: 'Media galereya',
    myAds: 'Mening reklamalari',
    adTitle: 'Reklama sarlavhasi',
    adDescription: 'Reklama tavsifi',
    publishAd: 'Reklamani nashr etish',
    deleteMedia: 'Medaniyatni o\'chirish',
    editMedia: 'Medaniyatni tahrirlash',
    noMediaYet: 'Medaniyat hali yo\'q',
    noAdsYet: 'Reklamalar hali yo\'q',
    uploadInstructions: 'Reklama yuklash yo\'riqnomasi',
    recommendedSizes: 'Tavsiya etilgan o\'lchamlar:',
    aspectRatio: 'Nisbat: 16:9 yoki 21:9 (misolda ko\'rsatilganidek)',
    minWidth: 'Minimal kenglik: 1200 piksel',
    maxFileSize: 'Maksimal fayl hajmi: 5 MB',
    fileFormat: 'Format: JPG, PNG, WebP',
    uploadTip: 'Maslahat: Yorqin va jozibali tasvirlardan foydalaning. Yuklashdan keyin administrator tekshirishi uchun "Moderatsiyaga yuborish" tugmasini bosing.',
    adBanners: 'Reklama bannerlari',
    uploadAd: 'Reklama yuklash',
    underModeration: 'Moderatsiyada',
    noAdBannersYet: 'Reklama bannerlari qo\'shilmagan',
    
    // Сообщения об ошибках
    errorLoading: 'Yuklash xatosi',
    errorSaving: 'Saqlash xatosi',
    errorDeleting: "O'chirish xatosi",
    errorInvalidData: "Noto'g'ri ma'lumotlar",
    errorNetwork: 'Tarmoq xatosi',
    
    // Подтверждения
    confirmDelete: "O'chirishni xohlaysizmi?",
    confirmCancel: 'Bekor qilishni xohlaysizmi?',
    confirmLogout: 'Chiqishni xohlaysizmi?',
    
    // ============== НОВЫЕ КЛЮЧИ ДЛЯ ВНУТРЕННИХ ПАНЕЛЕЙ ==============
    
    // Аналитика (AnalyticsPanel) - внутренние
    loadingAnalytics: 'Analitika yuklanmoqda...',
    financesAndAnalytics: 'Moliya va analitika',
    paymentHistory: 'To\'lovlar tarixi',
    periodAnalysis: 'Tahlil davri',
    selectPeriodAnalytics: 'Analitika ma\'lumotlarini ko\'rsatish uchun davrni tanlang',
    profitFromMarkups: 'Ustama foydasi',
    companyExpenses: 'Kompaniya xarajatlari',
    finalBalance: 'Yakuniy balans',
    charts: 'Diagrammalar',
    salaryExpense: 'Maosh',
    electricityExpense: 'Elektr',
    purchasesExpense: 'Xaridlar',
    otherExpenses: 'Boshqa xarajatlar',
    profitAndExpenses: 'Foyda va xarajatlar',
    currentPeriod: 'Joriy davr',
    previousPeriod: 'Oldingi davr',
    salesDynamics: 'Sotuv dinamikasi',
    topSellingProducts: 'Eng ko\'p sotilgan mahsulotlar',
    productsSold: 'Sotildi',
    revenue: 'Tushum',
    noSalesYet: 'Sotuvlar hali yo\'q',
    advancedInsights: 'Kengaytirilgan analitika',
    sum: 'so\'m',
    billion: 'mlrd',
    million: 'mln',
    thousand: 'ming',
    
    // Период времени
    today: 'Bugun',
    yesterday: 'Kecha',
    thisWeek: 'Bu hafta',
    thisMonth: 'Bu oy',
    thisYear: 'Bu yil',
    allTime: 'Hamma vaqt',
    customPeriod: 'Maxsus davr',
    day: 'Kun',
    week: 'Hafta',
    month: 'Oy',
    year: 'Yil',
    hour: 'Soat',
    
    // История платежей (PaymentHistoryForCompany)
    paymentHistoryTitle: 'To\'lovlar tarixi',
    totalPayments: 'Jami to\'lovlar',
    paidAmount: 'To\'langan',
    searchPayments: 'Buyurtma, mijoz, mahsulot bo\'yicha qidirish...',
    filters: 'Filtrlar',
    allMethods: 'Barcha usullar',
    checksAndCodes: 'Cheklar/Kodlar',
    demoOnline: 'Demo onlayn',
    realOnline: 'Haqiqiy onlayn',
    status: 'Holat',
    allStatuses: 'Barcha holatlar',
    paid: 'To\'langan',
    pending: 'Kutilmoqda',
    failed: 'Xato',
    period: 'Davr',
    allPeriod: 'Hamma vaqt',
    customDates: 'Maxsus davr',
    from: 'Dan',
    to: 'Gacha',
    noPaymentsFound: 'To\'lovlar topilmadi',
    paymentDetails: 'To\'lov tafsilotlari',
    orderId: 'Buyurtma ID',
    orderTime: 'Buyurtma vaqti',
    paymentVia: 'To\'lov orqali',
    productsInOrder: 'Buyurtmadagi mahsulotlar',
    profitFromOrder: 'Foyda',
    close: 'Yopish',
    
    // Склад (DigitalWarehouse)
    digitalWarehouse: 'Raqamli ombor',
    noCategory: 'Kategoriyasiz',
    errorUpdatingProduct: 'Mahsulotni yangilashda xato',
    deleteProductConfirm: 'Bu mahsulotni o\'chirmoqchimisiz?',
    fillNameAndPrice: 'Mahsulot nomi va narxini kiriting',
    markupTooHigh: 'Ustama foizi juda katta',
    errorAddingProduct: 'Mahsulot qo\'shishda xato',
    deleteAllProductsConfirm: 'DIQQAT! Siz BARCHA mahsulotlarni o\'chirmoqchisiz. Bu amalni bekor qilib bo\'lmaydi. Davom etasizmi?',
    successfullyDeleted: 'Muvaffaqiyatli o\'chirildi',
    errorMassDelete: 'Mahsulotlarni ommaviy o\'chirishda xato',
    fileTooLarge: 'Fayl juda katta',
    tooManyRows: 'Qatorlar juda ko\'p',
    fileEmpty: 'Fayl bo\'sh!',
    productsImported: 'Mahsulotlar import qilindi',
    selectCategory: 'Kategoriyani tanlang',
    allCategories: 'Barcha kategoriyalar',
    unavailable: 'Mavjud emas',
    pcs: 'dona',
    loadingWarehouse: 'Ombor yuklanmoqda...',
    errorLoadingWarehouse: 'Yuklashda xato:',
    productsCount: 'Tovarlar',
    totalInStock: 'Omborda jami',
    cost: 'Qiymati',
    categoriesCount: 'Kategoriyalar',
    searchPlaceholder: 'Nomi, shtrix-kod yoki barid bo\'yicha qidirish...',
    addProductShort: 'Qo\'shish',
    importFromExcelCSV: 'Excel/CSV dan import',
    importShort: 'Import',
    exportToExcel: 'Excel ga eksport',
    exportShort: 'Eksport',
    deleteAllProducts: 'Barcha tovarlarni o\'chirish',
    companyIdNotFound: "❌ Xato: Kompaniya ID topilmadi. Iltimos, tizimga qayta kiring.",
    markupCorrected: "Ustama foizi tuzatildi",
    updateError: "Mahsulotni yangilashda xato",
    deleteError: "Mahsulotni o'chirishda xato",
    deleteCancelled: "O'chirish bekor qilindi",
    deleteSuccess: "Muvaffaqiyatli o'chirildi",
    availabilityError: "Mahsulot mavjudligini o'zgartirishda xato",
    excelReadError: "Excel faylini o'qishda xato: ",
    importSuccess: "Muvaffaqiyatli import qilindi",
    importError: "❌ Mahsulotlarni import qilib bo'lmadi!\n\nFailning formatini tekshiring.",
    importFileError: "Faylni import qilishda xato: ",
    importSuccessDetailed: "Muvaffaqiyatli import qilindi",
    importCheckFormat: "❌ Mahsulotlarni import qilib bo'lmadi!\n\nTekshiring:\n• Nom va Narx ustunlari to'g'ri tanlanganmi?\n• Ushbu ustunlarda to'g'ri ma'lumotlar bormi?\n\nTafsilotlar uchun konsolni oching (F12).",
    importErrorGeneric: "Import qilishda xato: ",
    productNamePlaceholder: "Mahsulot nomi *",
    quantityPlaceholder: "Miqdori",
    pricePlaceholder: "Narxi (so'm) *",
    markupPercentPlaceholder: "Ustama foizi (%)",
    barcodePlaceholder: "Shtrix-kod (ixtiyoriy)",
    baridPlaceholder: "Barid (5-6 raqam, ixtiyoriy)",
    colorPlaceholder: "Yoki rangni qo'lda kiriting...",
    sizePlaceholder: "Masalan: XL, 40, 42-44...",
    brandPlaceholder: "Masalan: Nike, Samsung, Apple...",
    categoryHeader: "Kategoriya",
    quantityHeader: "Miqdori",
    basePriceHeader: "Bazaviy narx",
    markupHeader: "Ustama %",
    sellingPriceHeader: "Sotuv narxi",
    barcodeHeader: "Shtrix-kod",
    actionsHeader: "Amallar",
    fillProductInfo: "Mahsulot ma'lumotlarini to'ldiring",
    categoriesAdminOnly: "Kategoriyalarni administrator yaratadi",
    noProducts: "Omborxonada mahsulotlar yo'q. Mahsulot qo'shing yoki Exceldan import qiling",
    productsNotFound: "Mahsulotlar topilmadi",
    baridDigits: "5-6 raqam",
    addPhotoTitle: "Rasm qo'shish",
    productPhotos: "Mahsulot rasmlari: ",
    productDescription: "📝 Mahsulot tavsifi",
    descriptionVisibleToCustomers: "Mahsulot tavsifini kiriting (xaridorlar ko'radi)",
    productColor: "🎨 Mahsulot rangi",
    productSize: "📐 Mahsulot o'lchami",
    productBrand: "🏢 Brend/Ishlab chiqaruvchi",
    exampleLabel: "Misol:",
    maxQuantityInfo: "✅ Agar miqdor ko'rsatilmagan bo'lsa, 0 bo'ladi",
    markupInfo: "✅ Agar ustama ko'rsatilmagan bo'lsa, mahsulot bazaviy narxda sotiladi",
    baridInfo: "✅ Barid - faqat raqamlar, maksimum 6 ta belgi",
    consoleDetails: "✅ Import tafsilotlarini ko'rish uchun konsolni oching (F12)",
    colorExamples: "Masalan: Qizil, Ko'k...",
    sizeExamples: "XL, 40, 42-44...",
    brandExamples: "Nike, Samsung, Apple...",
    
    // Заказы (CompanyOrdersPanel)
    customerOrdersTitle: 'Mijoz buyurtmalari',
    searchOrdersPlaceholder: 'Kod, ism yoki telefon bo\'yicha qidirish...',
    all: 'Barchasi',
    waiting: 'Kutilmoqda',
    completed: 'Bajarildi',
    cancelled: 'Bekor qilindi',
    ordersNotFound: 'Buyurtmalar topilmadi',
    guest: 'Mehmon',
    orderComposition: 'Buyurtma tarkibi',
    colorLabel: 'Rang:',
    orderDetailsTitle: 'Buyurtma tafsilotlari',
    orderTimeLabel: 'Buyurtma vaqti:',
    onlineCard: 'Onlayn karta',
    cashOrCheck: 'Naqd / Chek',
    cancelOrderBtn: 'Bekor qilish',
    confirmOrderBtn: 'Tasdiqlash',
    confirmPaymentQuestion: 'Bu buyurtma uchun to\'lovni tasdiqlaysizmi?',
    paymentConfirmedSuccess: 'To\'lov tasdiqlandi!',
    errorConfirmingPayment: 'To\'lovni tasdiqlashda xato',
    cancelOrderQuestion: 'Bu buyurtmani bekor qilmoqchimisiz? Bu amalni bekor qilib bo\'lmaydi.',
    orderCancelledSuccess: 'Buyurtma bekor qilindi',
    errorCancellingOrder: 'Buyurtmani bekor qilishda xato',
    
    // Затраты (ExpensesManager)
    companyExpensesTitle: 'Kompaniya xarajatlari',
    addExpense: 'Xarajat qo\'shish',
    editExpenses: 'Tahrirlash',
    saveChanges: 'Saqlash',
    saving: 'Saqlanmoqda...',
    newExpense: 'Yangi xarajat',
    expenseName: 'Xarajat nomi',
    expenseNamePlaceholder: 'Masalan: Ofis ijarasi',
    amountInSum: 'Summa (so\'m)',
    descriptionOptional: 'Tavsif (ixtiyoriy)',
    additionalInfo: 'Qo\'shimcha ma\'lumot',
    saveExpense: 'Xarajatni saqlash',
    deleteExpenseTooltip: 'Xarajatni o\'chirish',
    expense: 'Xarajat',
    refund: 'Qaytarish',
    enterAmount: 'Summani kiriting',
    willBeAdded: 'Qo\'shiladi:',
    willBeReduced: 'Kamayadi:',
    additionalCompanyExpense: 'Kompaniyaning qo\'shimcha xarajati',
    fillNameAndAmount: 'Xarajat nomi va summasini kiriting',
    expenseAddedSuccess: 'Xarajat muvaffaqiyatli qo\'shildi!',
    errorAddingExpense: 'Xarajat qo\'shishda xato',
    deleteExpenseConfirm: 'Bu xarajatni o\'chirmoqchimisiz?',
    expenseDeletedSuccess: 'Xarajat muvaffaqiyatli o\'chirildi!',
    errorDeletingExpense: 'Xarajatni o\'chirishda xato',
    amountCannotBeNegative: 'Xarajat summasi manfiy bo\'lishi mumkin emas',
    expensesUpdatedSuccess: 'Xarajatlar muvaffaqiyatli yangilandi!',
    errorUpdatingExpenses: 'Xarajatlarni yangilashda xato',
    
    // Панель продаж (SalesPanel) - дополнительные
    errorLoadingData: 'Ma\'lumotlarni yuklashda xato',
    errorSavingDescription: 'Tavsifni saqlashda xato',
    productDescriptionSaved: 'Mahsulot tavsifi saqlandi!',
    errorChangingProductStatus: 'Mahsulot holatini o\'zgartirishda xato',
    selectProductsForSale: 'Sotuvga qo\'yish uchun mahsulotlarni tanlang',
    successfullyListed: 'Muvaffaqiyatli qo\'yildi!',
    errorListingProducts: 'Mahsulotlarni qo\'yishda xato',
    confirmPaymentForOrder: 'Bu buyurtma uchun to\'lovni tasdiqlaysizmi?',
    paymentConfirmedProductsUpdated: 'To\'lov tasdiqlandi! Mahsulotlar yangilandi.',
    errorConfirmingPaymentOrder: 'To\'lovni tasdiqlashda xato',
    errorSearchingOrder: 'Buyurtmani qidirishda xato',
    
    // CompanyOrdersPanel - дополнительные
    searchDots: 'Qidiruv...',
    searchByCodeNamePhone: 'Kod, ism yoki telefon bo\'yicha qidirish...',
    refreshList: 'Ro\'yxatni yangilash',
    cashCheck: 'Naqd / Chek',
    confirmPaymentReceived: 'To\'lov olinganini tasdiqlaysizmi?',
    confirmError: 'Tasdiqlashda xato',
    cancelOrderConfirm: 'Bu buyurtmani bekor qilasizmi? Bu amalni qaytarib bo\'lmaydi.',
    cancelError: 'Bekor qilishda xato',
    waitingOrders: 'Kutilmoqda',
    confirmedOrders: 'Qabul qilingan',
    shippedOrders: 'Yo\'lda',
    acceptOrder: 'Buyurtmani qabul qilish',
    acceptOrderConfirm: 'Bu buyurtmani qabul qilasizmi?',
    orderAccepted: 'Buyurtma qabul qilindi',
    acceptOrderError: 'Buyurtmani qabul qilishda xato',
    markAsShipped: 'Yo\'lda',
    markAsShippedConfirm: 'Buyurtmani yetkazib beruvchiga topshirasizmi?',
    orderShipped: 'Buyurtma yetkazib beruvchiga topshirildi',
    markAsShippedError: 'Statusni yangilashda xato',
    statusConfirmed: 'Qabul qilindi',
    statusShipped: 'Yo\'lda',

    // Реферальные агенты (AdminReferralPanel, ReferralAgentPanel)
    referralAgents: 'Referal agentlar',
    referralAgentsManagement: 'Referal agentlarni boshqarish',
    referralAgentsDescription: 'Agentlarni boshqarish va statistika kuzatish',
    totalAgents: 'Jami agentlar',
    addAgent: 'Agent qo\'shish',
    createNewAgent: 'Yangi referal agent yaratish',
    agentName: 'Agent ismi',
    agentPhone: 'Telefon raqami',
    agentPassword: 'Parol',
    agentPasswordDigitsOnly: 'Parol (faqat raqamlar)',
    agentPasswordHint: 'Kamida 4 ta raqam (faqat 0-9 raqamlar)',
    referralCode: 'Referal kod',
    uniqueCode: 'Noyob kod',
    active: 'Faol',
    inactive: 'Nofaol',
    myReferralCode: 'Mening referal kodig',
    myPassword: 'Mening parolim',
    loginForAgents: 'Agentlar uchun kirish',
    agentLoginDescription: 'Referal kodingiz va statistikangizni ko\'rish uchun kiring',
    welcomeAgent: 'Xush kelibsiz',
    myCompanies: 'Mening kompaniyalarim',
    companiesLinked: 'Bog\'langan kompaniyalar',
    trialCompanies: 'Sinov kompaniyalar',
    disabledCompanies: 'O\'chirilgan kompaniyalar',
    copyReferralCode: 'Kodni nusxalash',
    shareWithCompanies: 'Bu kodni kompaniyalar bilan baham ko\'ring',
    yourLoginData: 'Sizning kirish ma\'lumotlaringiz',
    provideToCompanies: 'Ro\'yxatdan o\'tishda kompaniyalarga bu ma\'lumotlarni taqdim eting',
    trialPeriodInfo: 'Sizning kodingiz bilan ro\'yxatdan o\'tgan kompaniyalar 1 oy sinov muddatiga ega bo\'ladi',
    noCompaniesYet: 'Hozircha kompaniyalar yo\'q',
    shareYourCode: 'Yangi kompaniyalarga kodingizni taqdim eting',
    registeredOn: 'Ro\'yxatdan o\'tgan',
    trialUntil: 'Sinov muddati',
    days: 'kun',
    disabled: 'To\'xtatilgan',
    trial: 'Sinov davri',
    phoneFormatError: 'Telefon raqami 9 ta raqamdan iborat bo\'lishi kerak',
    passwordRequired: 'Parolni kiriting',
    loginError: 'Kirishda xato',
    invalidPhoneOrPassword: 'Telefon yoki parol noto\'g\'ri',
    dataLoadError: 'Ma\'lumotlarni yuklashda xato',
    unknownError: 'Noma\'lum xato',
    codeCopied: 'Kod nusxalandi',
    
    // Финансовая аналитika агента (ReferralAgentAnalyticsPanel)
    financialAnalytics: 'Moliyaviy tahlil',
    hideEarnings: 'Daromadni yashirish',
    showEarnings: 'Daromadni ko\'rsatish',
    totalCompanySales: 'Kompaniyalar savdosi',
    platformFee: 'Platforma komissiyasi',
    yourEarnings: 'Sizning daromadingiz',
    fromSales: 'savdodan',
    howCalculated: 'Daromadingiz qanday hisoblanadi?',
    platformTakes10: 'Platforma har bir kompaniya savdosidan 10% oladi',
    youGet10OfPlatform: 'Siz platforma komissiyasidan 10% olasiz',
    totalYouGet1: 'Jami: sizning kompaniyalaringiz savdosidan 1% olasiz',
    companiesFinancials: 'Kompaniyalar bo\'yicha moliya',
    company: 'Kompaniya',
    yourCommission: 'Sizning komissiyangiz',
    
    // Компания - вход и регистрация
    companyLogin: 'Kompaniya uchun kirish',
    companyLoginTitle: 'Kompaniya uchun kirish',
    companyLoginDescription: 'Kompaniya ma\'lumotlarini kiriting',
    enterCompanyData: 'Kompaniya ma\'lumotlarini kiriting',
    publicCompanyRegistration: 'Ommaviy kompaniya',
    privateCompanyRegistration: 'Shaxsiy kompaniya',
    fillPublicCompanyData: 'Ommaviy kompaniyani ro\'yxatdan o\'tkazish uchun ma\'lumotlarni to\'ldiring',
    fillPrivateCompanyData: 'Shaxsiy kompaniyani ro\'yxatdan o\'tkazish uchun ma\'lumotlarni to\'ldiring',
    firstName: 'Ism',
    lastName: 'Familiya',
    companyId: 'Kompaniya ID',
    companyIdUnique: 'Kompaniya ID (noyob)',
    companyIdHint: 'Xaridorlar kompaniyangizga kirish uchun bu IDdan foydalanadilar',
    phoneNumber: 'Telefon raqami',
    password: 'Parol',
    enterPassword: 'Parolni kiriting',
    accessKey: 'Kirish kaliti',
    accessKey30chars: 'Kirish kaliti (30 belgi)',
    generate: 'Yaratish',
    backToModeSelection: 'Rejimni tanlashga qaytish',
    registerCompany: 'Kompaniyani ro\'yxatdan o\'tkazish',
    optional: 'ixtiyoriy',
    referralCodeOptional: 'Referal kod (ixtiyoriy)',
    referralCodeHint: 'Agar referal agentdan kod bo\'lsa, uni shu yerga kiriting',
    enterName: 'Ismni kiriting',
    enterLastName: 'Familiyani kiriting',
    enterCompanyId: 'Kompaniya IDni kiriting',
    enterCompanyName: 'Kompaniya nomini kiriting',
    phoneNumberHint: 'Mamlakat kodisiz 9 ta raqam',
    loginButton: 'Kirish',
    fillAllFields: 'Iltimos, barcha maydonlarni to\'ldiring',
    
    // SMM Panel
    profileTab: 'Profil',
    companyProfileTab: 'Kompaniya profili',
    adsTab: 'Reklama',
    salesCount: 'Sotuvlar',
    subscribersCount: 'Obunachilar',
    logo: 'Logotip',
    uploadingLogo: 'Logotip yuklanmoqda...',
    logoUploaded: '✅ Logotip yuklandi!',
    logoUploadError: 'Logotip yuklashda xatolik',
    ratings: 'baholash',
    saveButton: 'Saqlash',
    editButton: 'Tahrirlash',
    locationLabel: 'Joylashuv',
    selectLocation: 'Xaritada joyni tanlang',
    locationSelected: 'Xaritada joy tanlandi!',
    notSpecified: 'Ko\'rsatilmagan',
    companyDescPlaceholder: 'Kompaniyangiz haqida ma\'lumot',
    noDescription: 'Tavsif qo\'shilmagan',
    adsInstruction: '📸 Reklama yuklash yo\'riqnomasi',
    formats: 'Formatlar:',
    adsTip: '💡 Maslahat:',
    adsTipText: 'Yorqin va jozibali rasmlardan foydalaning. Yuklashdan keyin administrator tomonidan tekshirish uchun "Moderatsiyaga yuborish" tugmasini bosing.',
    deleteAllAdsConfirm: 'BARCHA reklamalarni o\'chirmoqchimisiz? Bu amalni bekor qilish mumkin emas.',
    deletingAllAds: 'Barcha reklamalar o\'chirilmoqda...',
    adsDeleted: '✅ O\'chirildi',
    adsDeleteError: 'Reklamalarni o\'chirishda xatolik',
    deleteAllButton: 'Hammasini o\'chirish',
    uploadImageForModeration: 'Rasmni yuklang va administrator moderatsiyasiga yuboring',
    uploadFirstAd: 'Birinchi reklamani yuklash',
    deleteAdConfirm: 'Bu reklamani o\'chirmoqchimisiz?',
    deletingAd: 'Reklama o\'chirilmoqda...',
    adDeleted: '🗑️ Reklama o\'chirildi',
    adDeleteError: 'Reklamani o\'chirishda xatolik',
    statusPending: 'Moderatsiyada',
    statusApproved: 'Tasdiqlangan',
    statusRejected: 'Rad etilgan',
    rejectionReason: 'Rad etish sababi:',
    uploadAdTitle: 'Reklama yaratish',
    adType: 'Reklama turi *',
    companyAd: 'Kompaniya',
    productAd: 'Mahsulot',
    selectProductRequired: 'Mahsulotni tanlang *',
    nameRequired: 'Nomi *',
    enterNamePlaceholder: 'Nomini kiriting',
    addDescriptionPlaceholder: 'Tavsif qo\'shing',
    uploadMethod: 'Rasm qo\'shish usuli',
    uploadFile: '📁 Fayl yuklash',
    insertURL: '🔗 URL qo\'shish',
    dragImageHere: 'Rasmni bu yerga torting',
    or: 'yoki',
    removeFile: '✕ O\'chirish va boshqa faylni tanlash',
    recommendedTip: '💡 Tavsiya: 1200x600px, 5 MB gacha, JPG/PNG/WebP formatlar',
    imageURL: 'Rasm URL *',
    imageURLExample: '(masalan, Imgur, ImgBB)',
    imageURLPlaceholder: 'https://example.com/image.jpg',
    urlTip: '💡 1200x600px yoki kattaroq o\'lchamdagi rasmlardan foydalanish tavsiya etiladi',
    previewLabel: 'Ko\'rib chiqish:',
    cancelButton: 'Bekor qilish',
    createAdButton: '🎪 Reklama yaratish',
    profileSaved: '✅ Profil muvaffaqiyatli saqlandi!',
    saveProfileError: 'Xatolik:',
    creatingAd: 'Reklama yaratilmoqda...',
    selectFileToUpload: 'Yuklash uchun faylni tanlang',
    enterImageURL: 'Rasm URL ni kiriting',
    enterTitle: 'Nomini kiriting',
    selectProductForAd: 'Reklama uchun mahsulotni tanlang',
    pleaseUploadImage: 'Iltimos, rasmni yuklang',
    productsLoadError: 'Mahsulotlarni yuklashda xatolik',
    companyAdDescription: 'Butun kompaniya reklamasi - klik kompaniya profiliga olib boradi',
    productAdDescription: 'Mahsulot reklamasi - klik mahsulot sahifasiga olib boradi',
    noProductsAddFirst: 'Sizda mahsulotlar yo\'q. Avval mahsulot qo\'shing.',
    selectProductOption: '-- Mahsulotni tanlang --',
    adCreated: '🎪 Reklama',
    adCreatedStatus: 'yaratildi! Holat: moderatsiyada',
    companyGenitive: 'kompaniya',
    productGenitive: 'mahsulot',
    
    // Sales Panel
    saveError: '❌ Saqlashda xatolik',
    productDescSaved: '✅ Mahsulot tavsifi saqlandi!',
    statusChangeError: 'Mahsulot holatini o\'zgartirishda xatolik',
    listedProductsAvailable: 'mahsulotlar xaridorlarga ochiq',
    timeSeconds: 'Vaqt:',
    listProductsError: 'Mahsulotlarni qo\'yishda xatolik',
    paymentConfirmError: 'To\'lovni tasdiqlashda xatolik',
    orderSearchError: 'Buyurtmani qidirishda xatolik',
    selectProductsToRemove: 'Sotuvdan olib tashlash uchun mahsulotlarni tanlang',
    removeFromSaleConfirm: 'mahsulotni xaridorlar panelidan olib tashlaysizmi?',
    successfullyRemoved: '✅ Muvaffaqiyatli olib tashlandi!',
    removedProductsHidden: 'mahsulotlar xaridorlardan yashirildi',
    removeFromSaleError: 'Mahsulotlarni olib tashlashda xatolik',
    searchByName: 'Nom bo\'yicha qidirish...',
    foundOrder: 'Topilgan buyurtma',
    receipt: 'Chek',
    noProductsInStock: 'Omborda mahsulot yo\'q',
    listForCustomers: 'Xaridorlarga mahsulotlarni qo\'yish',
    listForCustomersDesc: 'Bu mahsulotlar do\'konda xaridorlarga ochiq bo\'ladi',
    productsAvailableForCustomers: 'Mahsulotlar xaridorlarga ochiq bo\'ladi',
    productDetails: 'Mahsulot tafsilotlari',
    productDetailsDesc: 'Mahsulot haqida batafsil ma\'lumot',
    describeProduct: 'Mahsulotni tavsiflab bering... Havolalar, emoji ishlatishingiz mumkin 🎉',
    storeInfo: 'Do\'kon haqida ma\'lumot',
    storeName: 'Nomi',
    storePhone: 'Telefon',
    storeAddress: 'Manzil',
    describeProducts: 'Mahsulotlaringizni tavsiflab bering... Havolalar, emoji ishlatishingiz mumkin 🎉',
    alreadyOnSale: 'Allaqachon sotuvda',
    willBeListed: 'Qo\'yiladi',
    editProductDescTitle: 'Bu mahsulotning tavsifini tahrirlash',
    noDescriptionClickEdit: 'Tavsif yo\'q. Qo\'shish uchun «Tahrirlash»ni bosing.',
    onSale: 'Sotuvda',
    notOnSale: 'Sotuvda emas',
    paymentReceived: 'To\'lov qabul qilindi',
    pendingPayment: 'To\'lov kutilmoqda',
    
    // Analytics Panel
    analyticsLoadError: 'Analitika ma\'lumotlarini yuklashda xatolik',
    monthsShort: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
    profitCategory: 'Foyda',
    expensesCategory: 'Xarajatlar',
    totalCategory: 'Jami',
    zoomOut: 'Kichraytirish',
    zoomIn: 'Kattalashtirish',
    zoomReset: 'Qayta tiklash',
    periodToday: 'Bugun',
    periodYesterday: 'Kecha',
    periodThisWeek: 'Bu hafta',
    periodThisMonth: 'Bu oy',
    periodThisYear: 'Bu yil',
    periodCurrent: 'Joriy davr',
    periodPrevYesterday: 'Ilgagi kecha',
    periodWeekAgo: 'Bir hafta oldin',
    periodMonthAgo: 'Bir oy oldin',
    periodYearAgo: 'Bir yil oldin',
    periodPrevious: 'Oldingi davr',
    
    // Analytics - Additional translations
    daysOfWeek: ['Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan', 'Yak'],
    weekLabel: 'Hafta',
    dayLabel: 'Kun',
    monthLabel: 'Oy',
    growthDynamics: 'O\'sish dinamikasi',
    selectSpecificPeriod: 'Analitika uchun muayyan davrni tanlang',
    
    // Payment methods and statuses
    plasticCards: '💳 Plastik kartalar',
    cashPayment: '💵 Naqd pul',
    paidStatus: '✅ To\'langan',
    pendingStatus: '⏳ Kutilmoqda',
    errorStatus: '❌ Xato',
    checksCodesPayment: 'Cheklar/Kodlar',
    
    // Company Orders Panel
    invalidDeliveryCoords: 'Yetkazib berish koordinatalari noto\'g\'ri',
    mapOpenError: 'Xaritani ochishda xatolik',
    deliveryRecipient: 'Qabul qiluvchi:',
    deliveryAddress: 'Yetkazib berish manzili:',
    fromCompany: 'Qaerdan (Kompaniya)',
    toDelivery: 'Qayerga (Yetkazib berish)',
    
    // Admin Analytics Panel
    platformAnalytics: 'Platforma analitikasi',
    allCompaniesStats: 'Barcha kompaniyalarning umumiy statistikasi',
    companyStats: 'Kompaniya statistikasi',
    allCompanies: 'Barcha kompaniyalar',
    specificCompany: 'Aniq kompaniya',
    selectCompanyPlaceholder: 'Kompaniyani tanlang...',
    refresh: 'Yangilash',
    generalRevenue: 'Umumiy daromad',
    netProfit: 'Sof foyda',
    profitFromMarkup: 'Ustamadan foyda',
    productsInDatabase: 'Bazadagi mahsulotlar',
    productUnits: 'Mahsulot birliklari',
    frozenInStock: 'Omborda muzlatilgan',
    deliveryRevenueTotal: 'Yetkazib berishdan daromad',
    companyAnalytics: 'Kompaniyalar bo\'yicha analitika',
    productAnalytics: 'Mahsulotlar analitikasi',
    ordersCount: 'Buyurtmalar',

    // Advanced Insights Panel
    leastSold: 'Kam sotiladi',
    remaining: 'qoldi',
    threshold: 'Chegara',
    top20products: 'TOP 20 mahsulot',
    lowStockDescription: 'Arzonlar: ≤20 ta • Qimmatlar: ≤10 ta',
    allInStockMessage: 'Barcha tovarlar mavjud',

    // Payment History date filter
    selectSpecificDay: '📅 Muayyan kunni tanlash',
    selectSpecificDayHint: 'Muayyan kun uchun sotuvlarni filtrlash uchun sanani tanlang',

    // Table headers (short)
    methodHeader: 'Usul',
    detailsBtn: 'Batafsil',
    
    // Excel Column Mapper
    excelColumnMapping: 'Excel ustunlarini moslashtirish',
    excelColumnMappingDesc: 'Qaysi ustun qaysi maydonga mos kelishini ko\'rsating',
    productNameField: 'Tovar nomi',
    quantityField: 'Miqdori',
    basePriceField: 'Bazaviy narx',
    markupPercentField: 'Ustama foizi (%)',
    barcodeField: 'Shtrix-kod',
    baridField: 'Barid (5-6 raqam)',
    notSelected: '-- Tanlanmagan --',
    columnLabel: 'Ustun',
    emptyColumnName: '(bo\'sh nom)',
    dataPreview: 'Ma\'lumotlarni oldindan ko\'rish:',
    emptyCell: '(bo\'sh)',
    filePreviewRowsTitle: 'Faylning birinchi qatorlarini ko\'rish',
    importantInfo: 'ℹ️ Muhim ma\'lumot:',
    requiredFields: 'Majburiy maydonlar:',
    optionalFields: 'Ixtiyoriy maydonlar:',
    quantityNotSpecifiedHint: 'Agar miqdor ko\'rsatilmagan bo\'lsa, 0 qiymati o\'rnatiladi',
    markupNotSpecifiedHint: 'Agar ustama ko\'rsatilmagan bo\'lsa, tovar bazaviy narxda sotiladi',
    barcodeNotSpecifiedHint: 'Agar shtrix-kod ko\'rsatilmagan bo\'lsa, uni keyinroq qo\'shish mumkin',
    fillRequiredFieldsAlert: 'Majburiy maydonlarni to\'ldiring: Nom va Narx',
    confirmAndImport: 'Tasdiqlash va import qilish',
    
    // Import Progress Messages
    importingFromCSV: '{count} tovarlarni CSV/TXT dan import qilish...',
    importingToDatabase: '{count} tovarlarni ma\'lumotlar bazasiga import qilish...',
    processingExcelData: 'Excel ma\'lumotlarini qayta ishlash...',
    updatingData: 'Ma\'lumotlarni yangilash...',
  }
};

// Хук для использования переводов
export function useTranslation(language: Language = 'uz'): Translations {
  return translations[language] || translations.uz;
}

// Get current language from localStorage for COMPANY panel
export function getCurrentLanguage(): Language {
  try {
    const savedLanguage = localStorage.getItem('company_language');
    if (savedLanguage === 'ru' || savedLanguage === 'uz') {
      return savedLanguage;
    }
  } catch (error) {
    console.error('Error reading language from localStorage:', error);
  }
  return 'uz'; // Дефолт - узбекский
}

// Get admin language (always Russian)
export function getAdminLanguage(): Language {
  return 'ru'; // Админ панель всегда на русском
}

// Функция для сохранения языка компании в localStorage
export function setCurrentLanguage(language: Language): void {
  try {
    localStorage.setItem('company_language', language);
    
    // 🔄 НЕ перезагружаем страницу! Вместо этого отправляем событие
    console.log('🌍 Company language changed to:', language);
    window.dispatchEvent(new CustomEvent('languageChange', { detail: language }));
    
  } catch (error) {
    console.error('Error saving language to localStorage:', error);
  }
}