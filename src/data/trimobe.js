import kafeMisionaPremiumRed from '@/assets/coffee/kafe-misiona-premium-red.jpeg';
import kafeMisionaRange from '@/assets/coffee/kafe-misiona-range.jpeg';

export const services = [
  {
    key: 'phones',
    label: 'Shop phones',
    icon: 'pi pi-mobile',
    detail: 'Variants, stock, and MGA pricing',
    to: '/phones',
  },
  {
    key: 'cars',
    label: 'Book a car',
    icon: 'pi pi-car',
    detail: 'Daily rate with driver included',
    to: '/cars',
  },
  {
    key: 'coffee',
    label: 'Buy coffee',
    icon: 'pi pi-shopping-bag',
    detail: 'Roasted coffee and gift packs',
    to: '/coffee',
  },
];

export const homepageOffers = [
  {
    id: 'phones',
    eyebrow: 'Phones and accessories',
    title: 'Premium devices with clear stock and Ariary pricing',
    description:
      'Browse phones, audio, chargers, and accessories with sellable variants for color, storage, price, and availability.',
    actionLabel: 'Browse phones',
    actionTo: '/phones',
    secondaryLabel: 'View accessories',
    secondaryTo: '/accessories',
    icon: 'pi pi-mobile',
    visualKind: 'phone',
    tone: 'emerald',
    priceNote: 'From 165 000 MGA',
  },
  {
    id: 'cars',
    eyebrow: 'Cars with driver',
    title: 'Reserve chauffeured cars by date range',
    description:
      'Choose a car category, check daily rates, and create a booking with driver assignment handled by Trimobe.',
    actionLabel: 'Reserve car',
    actionTo: '/cars',
    secondaryLabel: 'View categories',
    secondaryTo: '/cars',
    icon: 'pi pi-car',
    visualKind: 'car',
    tone: 'charcoal',
    priceNote: 'Daily rates in MGA',
  },
  {
    id: 'coffee',
    eyebrow: 'Trimobe coffee',
    title: 'Local coffee for daily service and premium gifts',
    description:
      'Discover roasted coffee selections for home, office, travel, and thoughtful customer gifts across Madagascar.',
    actionLabel: 'Shop coffee',
    actionTo: '/coffee',
    secondaryLabel: 'Gift packs',
    secondaryTo: '/coffee',
    icon: 'pi pi-shopping-bag',
    visualKind: 'coffee',
    tone: 'gold',
    priceNote: 'From 28 000 MGA',
    image: kafeMisionaRange,
    imageAlt: 'Kafe Misiona coffee range displayed in a cafe setting',
  },
];

export const featuredProducts = [
  {
    id: 1,
    name: 'Astra X9 Pro',
    category: 'Smartphone',
    variant: '256 GB / Graphite',
    price: 3850000,
    stock: 8,
    tone: 'emerald',
  },
  {
    id: 2,
    name: 'Nova Buds Elite',
    category: 'Audio',
    variant: 'Noise canceling / Sand',
    price: 420000,
    stock: 18,
    tone: 'gold',
  },
  {
    id: 3,
    name: 'VoltCharge Max',
    category: 'Accessory',
    variant: '65 W / Dual USB-C',
    price: 165000,
    stock: 31,
    tone: 'blue',
  },
];

export const featuredCoffee = [
  {
    id: 1,
    name: 'Highland Arabica',
    category: 'Coffee',
    variant: 'Ground / 250 g',
    price: 28000,
    stock: 42,
    tone: 'gold',
    visualKind: 'coffee',
    image: kafeMisionaPremiumRed,
    imageAlt: 'Kafe Misiona premium red ground coffee pack',
  },
  {
    id: 2,
    name: 'Vanilla Roast',
    category: 'Coffee',
    variant: 'Beans / 500 g',
    price: 52000,
    stock: 25,
    tone: 'charcoal',
    visualKind: 'coffee',
    image: kafeMisionaRange,
    imageAlt: 'Kafe Misiona coffee range with multiple pack colors',
  },
  {
    id: 3,
    name: 'Trimobe Gift Box',
    category: 'Coffee',
    variant: 'Assorted / 3 packs',
    price: 95000,
    stock: 14,
    tone: 'emerald',
    visualKind: 'coffee',
    image: kafeMisionaRange,
    imageAlt: 'Kafe Misiona assorted coffee packs',
  },
];

export const carCategories = [
  { label: 'Luxury', icon: 'pi pi-sparkles' },
  { label: 'SUV', icon: 'pi pi-car' },
  { label: 'Bus', icon: 'pi pi-users' },
  { label: 'Cargo', icon: 'pi pi-box' },
];

export const featuredCars = [
  {
    id: 1,
    name: 'Executive SUV',
    category: 'Luxury',
    seats: 6,
    dailyRate: 650000,
    availability: 'Available this week',
    tone: 'charcoal',
  },
  {
    id: 2,
    name: 'Coastal Van',
    category: 'Bus',
    seats: 12,
    dailyRate: 520000,
    availability: 'Driver ready',
    tone: 'emerald',
  },
];

export const trustSignals = [
  { label: 'MGA pricing', value: 'Ariary' },
  { label: 'Payment', value: 'Manual' },
  { label: 'Cars', value: 'Driver included' },
  { label: 'Coffee', value: 'Local selection' },
];
