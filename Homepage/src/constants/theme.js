// ============================================================================
// DESIGN TOKENS 2026 — единый визуальный язык (Apple + Linear + Stripe)
// Используйте эти токены вместо «магических» чисел в стилях.
// ============================================================================

// Радиусы — никогда не превышаем 20px (без «пузырей»)
export const Radius = {
  button: 12,
  input: 14,
  card: 16,
  sheet: 20,
  pill: 999,
};

// Шкала отступов — щедрый воздух, всё «дышит»
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

// Типографика — иерархия важнее цвета
export const Typography = {
  display: { fontSize: 36, fontWeight: '800', letterSpacing: -0.8 },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  h2: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  h3: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  body: { fontSize: 16, fontWeight: '500' },
  bodyStrong: { fontSize: 16, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '500' },
  micro: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
};

// Тонкие, сдержанные тени (без избыточности)
export const Shadow = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 5,
  },
};

// Длительности анимаций (150–250ms)
export const Motion = {
  fast: 150,
  base: 200,
  slow: 250,
};
