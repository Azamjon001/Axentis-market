import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🌐 Двуязычие ru/uz — тот же принцип, что в utils/translations.tsx веб-панели.
export type Language = 'ru' | 'uz';

const ru = {
  // Вход
  companyLoginTitle: 'Вход для компаний',
  enterCompanyData: 'Введите данные вашей компании',
  phoneNumber: 'Номер телефона',
  password: 'Пароль',
  enterPassword: 'Введите пароль',
  referralCodeOptional: 'Реферальный код (необязательно)',
  referralCodeHint: 'Если вас пригласил агент — укажите его код',
  policyAcceptPrefix: 'Я принимаю ',
  policyLink: 'политику конфиденциальности',
  policyAcceptSuffix: ' и условия платформы',
  policyRequired: 'Для входа примите политику конфиденциальности',
  fillAllFields: 'Заполните все поля',
  invalidCredentials: 'Неверный номер телефона или пароль',
  adminNotAllowed: 'Вход для администратора доступен только в веб-панели',
  loginButton: 'Войти',
  loading: 'Загрузка...',

  // Навигация
  dashboard: 'Дашборд',
  warehouse: 'Склад',
  sales: 'Продажи',
  orders: 'Заказы',
  analytics: 'Аналитика',
  more: 'Ещё',
  settings: 'Настройки',
  companyPanel: 'Панель компании',
  logout: 'Выйти',
  logoutConfirm: 'Выйти из аккаунта компании?',
  cancel: 'Отмена',

  // Дашборд
  todayOrders: 'Заказы сегодня',
  todayRevenue: 'Выручка сегодня',
  totalRevenue: 'Выручка всего',
  soldUnits: 'Продано единиц',
  totalProducts: 'Товаров на складе',
  attention: 'Требует внимания',
  newOrders: 'Новые заказы',
  returns: 'Заявки на возврат',
  lowStock: 'Мало товаров',
  questions: 'Вопросы',
  allGood: 'Всё под контролем 🎉',
  recentOrders: 'Последние заказы',
  noOrders: 'Заказов пока нет',
  sum: 'сум',
  failedToLoad: 'Не удалось загрузить данные',
  retry: 'Повторить',
  pullToRefresh: 'Потяните, чтобы обновить',

  // Склад
  searchProducts: 'Поиск по названию, штрих-коду...',
  addProduct: 'Добавить товар',
  editProduct: 'Редактировать товар',
  productName: 'Название',
  price: 'Цена (закупка)',
  markupPercent: 'Наценка, %',
  quantity: 'Количество',
  category: 'Категория',
  brand: 'Бренд',
  barcode: 'Штрих-код',
  description: 'Описание',
  availableForCustomers: 'Виден покупателям',
  save: 'Сохранить',
  delete: 'Удалить',
  deleteProductConfirm: 'Удалить этот товар?',
  noProducts: 'Товаров нет — добавьте первый',
  inStock: 'в наличии',
  hidden: 'Скрыт',
  priceWithMarkup: 'Цена продажи',
  productSaved: 'Товар сохранён',
  productDeleted: 'Товар удалён',
  error: 'Ошибка',
  nameAndPriceRequired: 'Укажите название и цену',

  // Продажи
  offlineSales: 'Офлайн-продажи',
  onlineSales: 'Онлайн-продажи',
  noSales: 'Продаж пока нет',
  paymentCash: 'Наличные',
  paymentCard: 'Карта',
  total: 'Итого',
  salesForPeriod: 'Продажи за период',

  // Заказы
  allOrders: 'Все',
  accept: 'Принять',
  ship: 'Отправить',
  complete: 'Завершить',
  cancelOrder: 'Отменить',
  cancelOrderConfirm: 'Отменить этот заказ?',
  orderAccepted: 'Заказ принят',
  orderShipped: 'Заказ отправлен',
  orderCompleted: 'Заказ завершён',
  orderCancelled: 'Заказ отменён',
  buyer: 'Покупатель',
  items: 'Позиции',
  deliveryAddress: 'Адрес доставки',
  statusPending: 'Новый',
  statusConfirmed: 'Принят',
  statusProcessing: 'Готовится',
  statusShipped: 'Отправлен',
  statusDelivered: 'Доставлен',
  statusCompleted: 'Завершён',
  statusCancelled: 'Отменён',

  // Аналитика
  period7: '7 дней',
  period30: '30 дней',
  period90: '90 дней',
  revenue: 'Выручка',
  profit: 'Прибыль',
  ordersCount: 'Заказов',
  avgCheck: 'Средний чек',
  revenueByDay: 'Выручка по дням',
  topProducts: 'Топ товаров',
  noData: 'Пока мало данных',
  online: 'Онлайн',
  offline: 'Офлайн',
  margin: 'Маржа',

  // Настройки
  companyProfile: 'Профиль компании',
  language: 'Язык',
  theme: 'Тема',
  themeLight: 'Светлая',
  themeDark: 'Тёмная',
  status: 'Статус',
  mode: 'Режим',
  modePublic: 'Публичный',
  modePrivate: 'Закрытый',
  aboutApp: 'О приложении',
  aboutAppText: 'Axentis Business — мобильная панель продавца маркетплейса Axentis. Управление админ-панелью доступно только в веб-версии.',
  version: 'Версия',
};

const uz: typeof ru = {
  companyLoginTitle: 'Kompaniyalar uchun kirish',
  enterCompanyData: 'Kompaniya maʼlumotlarini kiriting',
  phoneNumber: 'Telefon raqami',
  password: 'Parol',
  enterPassword: 'Parolni kiriting',
  referralCodeOptional: 'Referal kod (ixtiyoriy)',
  referralCodeHint: 'Agent taklif qilgan boʻlsa — kodini kiriting',
  policyAcceptPrefix: 'Men ',
  policyLink: 'maxfiylik siyosati',
  policyAcceptSuffix: 'ni qabul qilaman',
  policyRequired: 'Kirish uchun maxfiylik siyosatini qabul qiling',
  fillAllFields: 'Barcha maydonlarni toʻldiring',
  invalidCredentials: 'Telefon raqami yoki parol notoʻgʻri',
  adminNotAllowed: 'Administrator faqat veb-panel orqali kirishi mumkin',
  loginButton: 'Kirish',
  loading: 'Yuklanmoqda...',

  dashboard: 'Boshqaruv',
  warehouse: 'Ombor',
  sales: 'Sotuv',
  orders: 'Buyurtmalar',
  analytics: 'Statistika',
  more: 'Yana',
  settings: 'Sozlamalar',
  companyPanel: 'Kompaniya paneli',
  logout: 'Chiqish',
  logoutConfirm: 'Kompaniya hisobidan chiqasizmi?',
  cancel: 'Bekor qilish',

  todayOrders: 'Bugungi buyurtmalar',
  todayRevenue: 'Bugungi tushum',
  totalRevenue: 'Jami tushum',
  soldUnits: 'Sotilgan dona',
  totalProducts: 'Ombordagi tovarlar',
  attention: 'Eʼtibor talab qiladi',
  newOrders: 'Yangi buyurtmalar',
  returns: 'Qaytarishlar',
  lowStock: 'Tugayotgan',
  questions: 'Savollar',
  allGood: 'Hammasi nazoratda 🎉',
  recentOrders: 'Soʻnggi buyurtmalar',
  noOrders: 'Buyurtmalar yoʻq',
  sum: 'soʻm',
  failedToLoad: 'Maʼlumotlarni yuklab boʻlmadi',
  retry: 'Qayta urinish',
  pullToRefresh: 'Yangilash uchun torting',

  searchProducts: 'Nomi, shtrix-kod boʻyicha qidirish...',
  addProduct: 'Tovar qoʻshish',
  editProduct: 'Tovarni tahrirlash',
  productName: 'Nomi',
  price: 'Narx (xarid)',
  markupPercent: 'Ustama, %',
  quantity: 'Miqdori',
  category: 'Kategoriya',
  brand: 'Brend',
  barcode: 'Shtrix-kod',
  description: 'Tavsif',
  availableForCustomers: 'Xaridorlarga koʻrinadi',
  save: 'Saqlash',
  delete: 'Oʻchirish',
  deleteProductConfirm: 'Bu tovarni oʻchirasizmi?',
  noProducts: 'Tovarlar yoʻq — birinchisini qoʻshing',
  inStock: 'mavjud',
  hidden: 'Yashirin',
  priceWithMarkup: 'Sotish narxi',
  productSaved: 'Tovar saqlandi',
  productDeleted: 'Tovar oʻchirildi',
  error: 'Xatolik',
  nameAndPriceRequired: 'Nomi va narxini kiriting',

  offlineSales: 'Oflayn sotuvlar',
  onlineSales: 'Onlayn sotuvlar',
  noSales: 'Sotuvlar yoʻq',
  paymentCash: 'Naqd',
  paymentCard: 'Karta',
  total: 'Jami',
  salesForPeriod: 'Davr uchun sotuvlar',

  allOrders: 'Barchasi',
  accept: 'Qabul qilish',
  ship: 'Joʻnatish',
  complete: 'Yakunlash',
  cancelOrder: 'Bekor qilish',
  cancelOrderConfirm: 'Bu buyurtmani bekor qilasizmi?',
  orderAccepted: 'Buyurtma qabul qilindi',
  orderShipped: 'Buyurtma joʻnatildi',
  orderCompleted: 'Buyurtma yakunlandi',
  orderCancelled: 'Buyurtma bekor qilindi',
  buyer: 'Xaridor',
  items: 'Mahsulotlar',
  deliveryAddress: 'Yetkazish manzili',
  statusPending: 'Yangi',
  statusConfirmed: 'Qabul qilindi',
  statusProcessing: 'Tayyorlanmoqda',
  statusShipped: 'Joʻnatildi',
  statusDelivered: 'Yetkazildi',
  statusCompleted: 'Yakunlandi',
  statusCancelled: 'Bekor qilindi',

  period7: '7 kun',
  period30: '30 kun',
  period90: '90 kun',
  revenue: 'Tushum',
  profit: 'Foyda',
  ordersCount: 'Buyurtmalar',
  avgCheck: 'Oʻrtacha chek',
  revenueByDay: 'Kunlik tushum',
  topProducts: 'Top tovarlar',
  noData: 'Maʼlumot yetarli emas',
  online: 'Onlayn',
  offline: 'Oflayn',
  margin: 'Marja',

  companyProfile: 'Kompaniya profili',
  language: 'Til',
  theme: 'Mavzu',
  themeLight: 'Yorugʻ',
  themeDark: 'Qorongʻu',
  status: 'Holat',
  mode: 'Rejim',
  modePublic: 'Ochiq',
  modePrivate: 'Yopiq',
  aboutApp: 'Ilova haqida',
  aboutAppText: 'Axentis Business — Axentis marketpleysi sotuvchisining mobil paneli. Admin-panelni boshqarish faqat veb-versiyada mavjud.',
  version: 'Versiya',
};

export type Translations = typeof ru;
const dictionaries: Record<Language, Translations> = { ru, uz };

interface I18nCtx {
  lang: Language;
  t: Translations;
  setLang: (l: Language) => void;
}

const Ctx = createContext<I18nCtx>({ lang: 'ru', t: ru, setLang: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('ru');

  useEffect(() => {
    AsyncStorage.getItem('axentis_lang').then((v) => {
      if (v === 'ru' || v === 'uz') setLangState(v);
    });
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    AsyncStorage.setItem('axentis_lang', l).catch(() => {});
  };

  return (
    <Ctx.Provider value={{ lang, t: dictionaries[lang], setLang }}>{children}</Ctx.Provider>
  );
}

export const useI18n = () => useContext(Ctx);
