import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
  Modal, Dimensions, Animated, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getStories, viewStory } from '../../api';
import { getImageUrl } from '../../utils/imageUrl';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5s на кадр

// 📸 Лента сторис магазинов вверху главной + полноэкранный просмотрщик.
export default function StoriesBar({ onOpenProduct }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null); // индекс магазина
  const [activeStory, setActiveStory] = useState(0);    // индекс кадра
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    getStories(user?.phone).then(setGroups).catch(() => setGroups([]));
  }, [user?.phone]);

  const openGroup = (gi) => {
    setActiveGroup(gi);
    setActiveStory(0);
  };
  const close = () => {
    setActiveGroup(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  // Продвижение по кадрам и магазинам
  const advance = useCallback(() => {
    setActiveStory((cur) => {
      const g = groups[activeGroup];
      if (!g) return cur;
      if (cur + 1 < g.stories.length) return cur + 1;
      // следующий магазин
      if (activeGroup + 1 < groups.length) {
        setActiveGroup(activeGroup + 1);
        return 0;
      }
      close();
      return cur;
    });
  }, [groups, activeGroup]);

  // Запуск анимации прогресса на каждом кадре
  useEffect(() => {
    if (activeGroup === null) return;
    const g = groups[activeGroup];
    const story = g?.stories?.[activeStory];
    if (!story) return;
    viewStory(story.id);
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: STORY_DURATION, useNativeDriver: false });
    anim.start();
    timerRef.current = setTimeout(advance, STORY_DURATION);
    return () => {
      anim.stop();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeGroup, activeStory, groups]);

  if (groups.length === 0) return null;

  const current = activeGroup !== null ? groups[activeGroup] : null;
  const story = current?.stories?.[activeStory];

  return (
    <>
      {/* Лента кружков */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {groups.map((g, gi) => (
          <TouchableOpacity key={g.companyId} style={styles.item} activeOpacity={0.8} onPress={() => openGroup(gi)}>
            <View style={styles.ring}>
              <View style={[styles.avatarWrap, { backgroundColor: colors.surface }]}>
                {g.companyLogo ? (
                  <Image source={{ uri: getImageUrl(g.companyLogo) }} style={styles.avatar} />
                ) : (
                  <Ionicons name="storefront" size={22} color={colors.primary} />
                )}
              </View>
            </View>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{g.companyName}</Text>
              {g.verified && <Ionicons name="checkmark-circle" size={12} color="#3B82F6" />}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Полноэкранный просмотрщик */}
      <Modal visible={activeGroup !== null} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.viewer}>
          {current && (
            <>
              {/* Полоски прогресса */}
              <View style={styles.bars}>
                {current.stories.map((s, i) => (
                  <View key={s.id} style={styles.barTrack}>
                    <Animated.View
                      style={[
                        styles.barFill,
                        {
                          width: i < activeStory ? '100%'
                            : i === activeStory
                              ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                              : '0%',
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>

              {/* Шапка магазина */}
              <View style={styles.viewerHeader}>
                <View style={styles.viewerStore}>
                  {current.companyLogo ? (
                    <Image source={{ uri: getImageUrl(current.companyLogo) }} style={styles.viewerLogo} />
                  ) : (
                    <View style={[styles.viewerLogo, styles.viewerLogoFallback]}>
                      <Ionicons name="storefront" size={16} color="#FFF" />
                    </View>
                  )}
                  <Text style={styles.viewerName} numberOfLines={1}>{current.companyName}</Text>
                  {current.verified && <Ionicons name="checkmark-circle" size={15} color="#3B82F6" />}
                </View>
                <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="close" size={28} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* Картинка + невидимые зоны тапа (назад/вперёд) */}
              {story && (
                <Image source={{ uri: getImageUrl(story.imageUrl) }} style={styles.storyImage} resizeMode="contain" />
              )}
              <Pressable
                style={styles.tapLeft}
                onPress={() => setActiveStory((c) => Math.max(0, c - 1))}
              />
              <Pressable style={styles.tapRight} onPress={advance} />

              {/* Подпись + переход к товару */}
              {story?.caption ? (
                <View style={styles.captionWrap} pointerEvents="box-none">
                  <Text style={styles.caption}>{story.caption}</Text>
                  {story.productId ? (
                    <TouchableOpacity
                      style={styles.captionBtn}
                      onPress={() => { close(); onOpenProduct && onOpenProduct(story.productId); }}
                    >
                      <Text style={styles.captionBtnText}>Смотреть товар</Text>
                      <Ionicons name="arrow-forward" size={15} color="#111" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 10, gap: 14 },
  item: { alignItems: 'center', width: 68 },
  ring: { padding: 2.5, borderRadius: 40, borderWidth: 2.5, borderColor: '#EC4899' },
  avatarWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4, maxWidth: 66 },
  name: { fontSize: 11, textAlign: 'center', flexShrink: 1 },

  viewer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  bars: { position: 'absolute', top: 44, left: 8, right: 8, flexDirection: 'row', gap: 4, zIndex: 10 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: '#FFF' },
  viewerHeader: { position: 'absolute', top: 56, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
  viewerStore: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  viewerLogo: { width: 30, height: 30, borderRadius: 15 },
  viewerLogoFallback: { backgroundColor: '#7C5CF0', alignItems: 'center', justifyContent: 'center' },
  viewerName: { color: '#FFF', fontSize: 14, fontWeight: '700', flex: 1 },
  storyImage: { width, height: height * 0.8, alignSelf: 'center' },
  tapLeft: { position: 'absolute', left: 0, top: 90, bottom: 90, width: width * 0.3 },
  tapRight: { position: 'absolute', right: 0, top: 90, bottom: 90, width: width * 0.7 },
  captionWrap: { position: 'absolute', bottom: 48, left: 16, right: 16, alignItems: 'flex-start', gap: 10 },
  caption: { color: '#FFF', fontSize: 15, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  captionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 22 },
  captionBtnText: { color: '#111', fontSize: 14, fontWeight: '700' },
});
