import { TransitCar } from '../types';

export const INITIAL_TRANSITS: TransitCar[] = [
  {
    id: 'ft-2011-01',
    title: 'Ford Transit 2.2 3.30',
    year: 2011,
    bodyType: 'Yük furqonu',
    engine: '2.2 TDCi Euro 5',
    hp: 125,
    transmission: '6-Pilləli Mexanika',
    mileage: 223195,
    price: 18800,
    baseLength: '3.30 m',
    roofHeight: 'Hündür dam',
    wheelDrive: 'Ön çəkən (FWD)',
    color: 'Gümüşü metallik',
    fuelType: 'Dizel',
    location: 'Bakı, Yeni Günəşli',
    statusBadges: ['Gömrük olunub', 'Vuruqsuz və rəngsiz'],
    primaryImage: '/pics/ford_transit_hero.jpg',
    images: [
      '/pics/ford_transit_hero.jpg'
    ],
    description: 'Təmiz, vuruqsuz və rəng dəyməmiş Ford Transit 3.30 m baza. Almaniyadan yeni gətirilib, bütün texniki baxışları orijinal ehtiyat hissələri ilə olunub. Mühərrik və sürət qutusu saat kimi işləyir.',
    features: [
      'Kondisioner',
      'Avtopilot (Cruise Control)',
      'ABS / ESP təhlükəsizlik',
      'Elektrikli şüşəqaldıranlar',
      'Mərkəzi qapanma',
      'Duman əleyhinə işıqlar',
      'Bort kompyuter',
      'Yan sürüşən qapı'
    ],
    isFeatured: true,
    status: 'active'
  },
  {
    id: 'mb-sprinter-2008-02',
    title: 'Mercedes Sprinter 2.2 3.30',
    year: 2008,
    bodyType: 'Yük furqonu',
    engine: '2.2 CDI',
    hp: 150,
    transmission: '6-Pilləli Mexanika',
    mileage: 236400,
    price: 29000,
    baseLength: '3.30 m',
    roofHeight: 'Hündür dam',
    wheelDrive: 'Arxa çəkən (RWD)',
    color: 'Sarı',
    fuelType: 'Dizel',
    location: 'Bakı, Yeni Günəşli',
    statusBadges: ['Gömrük olunub', 'Vuruqsuz və rəngsiz'],
    primaryImage: '/pics/mercedes sprinter/msponyan.jpeg',
    images: [
      '/pics/mercedes sprinter/msponyan.jpeg',
      '/pics/mercedes sprinter/mspsagyan.jpeg',
      '/pics/mercedes sprinter/msparxayan.jpeg',
      '/pics/mercedes sprinter/msparxasag.jpeg',
      '/pics/mercedes sprinter/msparxa.jpeg',
      '/pics/mercedes sprinter/msparxaacig.jpeg',
      '/pics/mercedes sprinter/mspyukyan.jpeg',
      '/pics/mercedes sprinter/msprol.jpeg',
      '/pics/mercedes sprinter/mspkm.jpeg',
      '/pics/mercedes sprinter/mspkans.jpeg',
      '/pics/mercedes sprinter/mspmatorxana.jpeg',
      '/pics/mercedes sprinter/mspmatorxana2.jpeg'
    ],
    description: 'Mercedes Sprinter 2.2 CDI 3.30 m orta-uzun baza yük yeri. Almaniyadan yeni gətirilib, Azərbaycanda sürülməyib. 100% gömrük olunub. Vuruğu, pası və ya dəyişən detalı qətiyyən yoxdur. Orijinal probeq. Mühərrik, sürət qutusu və most ideal vəziyyətdədir. Kondisioner buz kimi vurur. Bütün sənədləri qaydasındadır.',
    features: [
      'Kondisioner',
      'ABS / ESP',
      'Elektrikli şüşəqaldıranlar',
      'Mərkəzi qapanma',
      'Bort kompyuter',
      'Hidravlik sükan',
      'Yan sürüşən qapı',
      'Duman əleyhinə işıqlar'
    ],
    isFeatured: true,
    status: 'active'
  }
];

export const PHONE_NUMBER = '+994 70 788 00 11';
export const WHATSAPP_NUMBER = '994707880011';
export const WHATSAPP_AUTO_MESSAGE = 'Salam! Saytdan yazıram. Avtomobillər haqqında ətraflı məlumat almaq istəyirdim.';
export const WHATSAPP_DIRECT_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_AUTO_MESSAGE)}`;
export const SHOWROOM_ADDRESS = 'Bakı şəhəri, Yeni Günəşli qəsəbəsi, Fatimeyi-Zəhra məscidinin yanı';
export const SHOWROOM_MAP_URL = 'https://www.google.com/maps/search/?api=1&query=40.382921,49.977866';
export const WORKING_HOURS = 'Bazar ertəsi - Bazar: 09:00 - 19:00';
