import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Dimensions, Linking, 
} from 'react-native';
import { Alert } from '../../utils/alert';
import { useNavigation } from '@react-navigation/native';
import { getImageUrl } from '../../utils/imageUrl';
import { useLanguage } from '../../context/LanguageContext';

const { width: SW } = Dimensions.get('window');
const W = SW - 32;
const H = 132; // чуть ниже — реклама компактнее, каталог смотрится ровнее
const INTERVAL = 10000;

const PLACEHOLDERS = [
  { id: 'a', titleKey: 'bannerSaleTitle', subKey: 'bannerSaleSub', bg: '#1F6FEB' },
  { id: 'b', titleKey: 'bannerNewTitle', subKey: 'bannerNewSub', bg: '#0EA371' },
  { id: 'c', titleKey: 'bannerDeliveryTitle', subKey: 'bannerDeliverySub', bg: '#D05A00' },
];

export default function BannerCarousel({ ads }) {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);

  const slides = ads && ads.length > 0 ? ads : null;
  const total  = slides ? slides.length : PLACEHOLDERS.length;

  useEffect(() => {
    if (total <= 1) return;
    const t = setInterval(() => {
      const next = (idxRef.current + 1) % total;
      idxRef.current = next;
      setIdx(next);
      ref.current?.scrollTo({ x: next * W, animated: true });
    }, INTERVAL);
    return () => clearInterval(t);
  }, [total]);

  const onScroll = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / W);
    idxRef.current = i;
    setIdx(i);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
      >
        {slides
          ? slides.map((ad) => {
              const uri = getImageUrl(ad.imageUrl || ad.productImage);
              // Реклама товара → переход на карточку товара; иначе → внешняя ссылка.
              const isProductAd = ad.adType === 'product' && ad.productId;
              const tappable = isProductAd || !!ad.linkUrl;
              const handlePress = async () => {
                if (isProductAd) {
                  navigation.navigate('ProductDetail', { productId: ad.productId });
                  return;
                }
                if (!ad.linkUrl) return;
                try {
                  const canOpen = await Linking.canOpenURL(ad.linkUrl);
                  if (canOpen) {
                    await Linking.openURL(ad.linkUrl);
                  } else {
                    Alert.alert(t('error'), t('linkOpenFail'));
                  }
                } catch {
                  Alert.alert(t('error'), t('linkOpenFail'));
                }
              };
              return (
                <TouchableOpacity
                  key={String(ad.id)}
                  activeOpacity={tappable ? 0.85 : 1}
                  onPress={tappable ? handlePress : undefined}
                  style={[styles.slide, { backgroundColor: '#1F6FEB' }]}
                >
                  {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                  <View style={styles.overlay} />
                  <View style={styles.txt}>
                    <Text style={styles.title}>{ad.title}</Text>
                    {ad.content ? <Text style={styles.sub}>{ad.content}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })
          : PLACEHOLDERS.map((p) => (
              <View key={p.id} style={[styles.slide, { backgroundColor: p.bg }]}>
                <View style={styles.circle} />
                <View style={styles.txt}>
                  <Text style={styles.title}>{t(p.titleKey)}</Text>
                  <Text style={styles.sub}>{t(p.subKey)}</Text>
                </View>
              </View>
            ))
        }
      </ScrollView>

      {total > 1 && (
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === idx ? styles.dotOn : styles.dotOff]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: W,
    height: H,
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  slide: {
    width: W,
    height: H,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  circle: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  txt: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 80,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    marginTop: 4,
  },
  dots: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    flexDirection: 'row',
    gap: 5,
  },
  dot: { height: 6, borderRadius: 3 },
  dotOn:  { width: 18, backgroundColor: '#fff' },
  dotOff: { width: 6,  backgroundColor: 'rgba(255,255,255,0.4)' },
});
