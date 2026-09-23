import photo from '~/assets/images/highline-walk.webp';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Footprints,
  Info as InfoIcon,
  Trophy,
} from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHighline, type Highline } from '~/hooks/use-highline';

import { HighlineImage } from '~/components/highline/highline-image';
import Info from '~/components/highline/info';
import { HighlineNotFound } from '~/components/highline/not-found';
import { HighlineSkeleton } from '~/components/highline/skeleton';
import { Ranking } from '~/components/ranking';

export type Direction = 'sticky' | 'compact' | 'dock';
const labels = ['Detalhes', 'Ranking'];

const people = [
  'Marina Costa',
  'Pedro Lima',
  'Ana Ribeiro',
  'Lucas Santos',
  'Bia Oliveira',
  'Rafael Souza',
  'Julia Mendes',
  'Caio Rocha',
  'Luiza Alves',
  'Bruno Dias',
  'Clara Silva',
  'Leo Martins',
];
const categories = ['Distância', 'Cadenas', 'Full lines', 'Speedline'];

function DemoDetails() {
  return (
    <View style={s.content}>
      <Text style={s.title}>Pedra da Gávea</Text>
      <Text style={s.body}>
        Uma linha com vista para o mar e as montanhas do Rio. Acesso pela trilha
        da Pedra da Gávea.
      </Text>
      <View style={s.card}>
        <View style={s.metrics}>
          <View style={s.metric}>
            <Text style={s.number}>
              40<Text style={s.unit}> m</Text>
            </Text>
            <Text style={s.muted}>Altura</Text>
          </View>
          <View style={s.rule} />
          <View style={s.metric}>
            <Text style={s.number}>
              85<Text style={s.unit}> m</Text>
            </Text>
            <Text style={s.muted}>Comprimento</Text>
          </View>
        </View>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Localização</Text>
        <Text style={s.body}>Barra da Tijuca, Rio de Janeiro</Text>
        <Text style={s.small}>Parque Nacional da Tijuca</Text>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Condições de acesso</Text>
        <Text style={s.body}>
          Trilha de aproximadamente 2 horas. Leve água e confira as condições de
          vento antes de sair.
        </Text>
      </View>
      <Text style={s.heading}>Histórico da linha</Text>
      {[
        ['12 set', 'Montagem registrada', 'Equipe Rio Highline · 85 m'],
        [
          '24 ago',
          '18 caminhadas registradas',
          '6 atletas completaram a linha',
        ],
        ['10 ago', 'Primeira montagem da temporada', 'Equipe Rio Highline'],
      ].map(([date, title, subtitle]) => (
        <View key={date} style={s.history}>
          <View style={s.dot} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={s.small}>{date}</Text>
            <Text style={s.heading}>{title}</Text>
            <Text style={s.muted}>{subtitle}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function DemoRanking() {
  const [category, setCategory] = useState(0);
  const [showCategories, setShowCategories] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  return (
    <View style={s.content}>
      <Text style={s.title}>Ranking</Text>
      <Text style={s.body}>Pedra da Gávea · 12 atletas</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Escolher categoria"
        testID="ranking-category"
        onPress={() => setShowCategories(true)}
        style={s.category}
      >
        <Text style={s.heading}>{categories[category]}</Text>
        <Text style={s.muted}>Trocar ⌄</Text>
      </Pressable>
      <View style={s.card}>
        <Text style={s.small}>MELHOR MARCA</Text>
        <Text style={s.number}>
          {category === 0
            ? '1.240 m'
            : category === 3
              ? '42 s'
              : category === 1
                ? '18 cadenas'
                : '14 linhas'}
        </Text>
        <Text style={s.body}>Marina Costa</Text>
      </View>
      <View style={s.list}>
        {people.map((name, i) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityLabel={`Ver atleta ${name}`}
            onPress={() => setPerson(name)}
            style={({ pressed }) => [s.row, pressed && { opacity: 0.65 }]}
          >
            <Text style={s.rank}>{i + 1}</Text>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.name}>{name}</Text>
              <Text style={s.small}>{18 - i} caminhadas</Text>
            </View>
            <Text style={s.name}>
              {category === 0
                ? `${1240 - i * 85} m`
                : category === 3
                  ? `${42 + i * 3} s`
                  : `${18 - i}`}
            </Text>
          </Pressable>
        ))}
      </View>
      <DemoSheet
        visible={showCategories}
        title="Categoria do ranking"
        onClose={() => setShowCategories(false)}
      >
        {categories.map((name, i) => (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityState={{ checked: category === i }}
            onPress={() => {
              setCategory(i);
              setShowCategories(false);
            }}
            style={s.category}
          >
            <Text style={s.heading}>{name}</Text>
            <Text>{category === i ? '✓' : ''}</Text>
          </Pressable>
        ))}
      </DemoSheet>
      <DemoSheet
        visible={person !== null}
        title={person ?? ''}
        onClose={() => setPerson(null)}
      >
        <Text style={s.body}>Atleta de highline · Rio de Janeiro</Text>
        <Text style={s.number}>
          {18 - Math.max(0, people.indexOf(person ?? ''))}
        </Text>
        <Text style={s.muted}>Caminhadas nesta linha</Text>
      </DemoSheet>
    </View>
  );
}

function DemoSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  return (
    <Modal
      transparent
      visible={visible}
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <View style={s.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}
        >
          <View style={s.handle} />
          <View style={s.sheetHeading}>
            <Text style={s.title}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={s.close}
            >
              <Text style={s.name}>Fechar</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function Cover({
  height = 180,
  highline,
}: {
  height?: number;
  highline?: Highline;
}) {
  return (
    <View style={{ height }}>
      {highline ? (
        <HighlineImage
          coverImageId={highline.cover_image}
          className="w-full h-full"
        />
      ) : (
        <Image
          source={photo}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Atleta caminhando no highline"
        />
      )}
      <View style={s.coverShade} />
      <View style={s.coverCaption}>
        <Text style={s.coverTitle}>{highline?.name ?? 'Pedra da Gávea'}</Text>
        <Text style={s.coverMeta}>
          {highline
            ? `${highline.length} m de comprimento`
            : 'Rio de Janeiro · 85 m'}
        </Text>
      </View>
    </View>
  );
}

export function TabExperience({ direction }: { direction: Direction }) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? (
    <LiveExperience direction={direction} id={id} />
  ) : (
    <Experience direction={direction} />
  );
}

function LiveExperience({
  direction,
  id,
}: {
  direction: Direction;
  id: string;
}) {
  const { highline, isPending } = useHighline({ id });
  if (isPending) return <HighlineSkeleton />;
  if (!highline) return <HighlineNotFound />;
  return <Experience direction={direction} highline={highline} />;
}

function Experience({
  direction,
  highline,
}: {
  direction: Direction;
  highline?: Highline;
}) {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const pager = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [tabWidth, setTabWidth] = useState(0);
  const [selected, setSelected] = useState(0);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registered, setRegistered] = useState(false);
  const progress = useSharedValue(0);
  const handler = useAnimatedScrollHandler({
    onScroll: (event) => {
      progress.value = width ? event.contentOffset.x / width : 0;
    },
  });
  const isDock = direction === 'dock';
  const isCompact = direction === 'compact';
  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (tabWidth / 2) }],
  }));
  function select(index: number) {
    const next = Math.max(0, Math.min(1, index));
    setSelected(next);
    pager.current?.scrollTo({ x: next * width, animated: !reduceMotion });
  }
  const tabs = (
    <View
      onLayout={(event) => setTabWidth(event.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      style={[s.tabs, isCompact && s.segments, isDock && s.dockTabs]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          isCompact
            ? s.segmentHighlight
            : isDock
              ? s.dockHighlight
              : s.underline,
          { width: tabWidth / 2 },
          indicator,
        ]}
      />
      {labels.map((label, index) => (
        <Pressable
          key={label}
          testID={`highline-tab-${index}`}
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected: selected === index }}
          onPress={() => select(index)}
          style={({ pressed }) => [
            s.tab,
            isDock && { flexDirection: 'column', gap: 4 },
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          {isDock &&
            (index === 0 ? (
              <InfoIcon
                size={20}
                color={selected === index ? '#18181b' : '#71717a'}
              />
            ) : (
              <Trophy
                size={20}
                color={selected === index ? '#18181b' : '#71717a'}
              />
            ))}
          <Text
            style={[
              s.tabText,
              selected === index && s.activeTab,
              isDock && { fontSize: 12 },
            ]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  return (
    <View
      style={s.screen}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next !== width) {
          setWidth(next);
          progress.value = selected;
          pager.current?.scrollTo({ x: selected * next, animated: false });
        }
      }}
    >
      <View style={s.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)')
          }
          style={s.back}
        >
          <ChevronLeft size={24} color="#18181b" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={s.navTitle}>
            {direction === 'sticky'
              ? 'Highline'
              : (highline?.name ?? 'Pedra da Gávea')}
          </Text>
          {direction !== 'sticky' && (
            <Text style={s.small}>
              {highline
                ? `${highline.length} m de comprimento`
                : 'Rio de Janeiro · 85 m'}
            </Text>
          )}
        </View>
        <Text style={s.demoLabel}>{id ? 'AO VIVO' : 'DEMO'}</Text>
      </View>
      {direction === 'sticky' && <Cover highline={highline} />}
      {!isDock && tabs}
      <View
        style={{ flex: 1 }}
        accessibilityRole="adjustable"
        accessibilityLabel="Conteúdo da highline"
        accessibilityValue={{ text: labels[selected] }}
        accessibilityActions={[
          { name: 'increment', label: 'Abrir ranking' },
          { name: 'decrement', label: 'Abrir detalhes' },
        ]}
        onAccessibilityAction={(event) =>
          select(event.nativeEvent.actionName === 'increment' ? 1 : 0)
        }
      >
        {width > 0 && (
          <Animated.ScrollView
            ref={pager}
            contentContainerStyle={{ height: '100%' }}
            horizontal
            pagingEnabled
            directionalLockEnabled
            nestedScrollEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onScroll={handler}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(event) =>
              setSelected(
                Math.max(
                  0,
                  Math.min(
                    1,
                    Math.round(event.nativeEvent.contentOffset.x / width),
                  ),
                ),
              )
            }
            style={{ flex: 1 }}
          >
            {[0, 1].map((index) => (
              <View
                key={index}
                style={{ width, height: '100%' }}
                accessibilityElementsHidden={selected !== index}
                importantForAccessibility={
                  selected !== index ? 'no-hide-descendants' : 'auto'
                }
              >
                <ScrollView
                  testID={`highline-page-${index}`}
                  style={{ flex: 1 }}
                  nestedScrollEnabled
                  directionalLockEnabled
                  contentInsetAdjustmentBehavior="never"
                  contentContainerStyle={{
                    paddingBottom: isDock ? 24 : insets.bottom + 100,
                  }}
                >
                  {index === 0 && direction !== 'sticky' && (
                    <Cover height={isCompact ? 220 : 260} highline={highline} />
                  )}
                  {id ? (
                    <View style={s.content}>
                      {index === 0 ? (
                        <Info />
                      ) : (
                        <Ranking highlines_ids={[id]} />
                      )}
                    </View>
                  ) : index === 0 ? (
                    <DemoDetails />
                  ) : (
                    <DemoRanking />
                  )}
                </ScrollView>
              </View>
            ))}
          </Animated.ScrollView>
        )}
      </View>
      {isDock && (
        <View style={[s.dock, { paddingBottom: insets.bottom + 8 }]}>
          {tabs}
          <View style={{ width: 52, height: 58 }}>
            {selected === 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Registrar caminhada"
                onPress={() =>
                  id
                    ? router.push(`/highline/${id}/register`)
                    : setRegisterOpen(true)
                }
                style={s.dockAction}
              >
                <Footprints size={20} color="white" />
              </Pressable>
            )}
          </View>
        </View>
      )}
      {!isDock && selected === 0 && (
        <Pressable
          testID="register-walk"
          accessibilityRole="button"
          onPress={() =>
            id ? router.push(`/highline/${id}/register`) : setRegisterOpen(true)
          }
          style={({ pressed }) => [
            s.fab,
            { bottom: insets.bottom + 16 },
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <Footprints size={20} color="white" />
          <Text style={s.fabText}>
            {registered ? 'Caminhada registrada' : 'Registrar caminhada'}
          </Text>
        </Pressable>
      )}
      <DemoSheet
        visible={registerOpen}
        title={registered ? 'Caminhada registrada' : 'Registrar caminhada'}
        onClose={() => setRegisterOpen(false)}
      >
        <Text style={s.body}>
          {registered
            ? 'Sua caminhada de demonstração foi salva nesta sessão.'
            : 'Pedra da Gávea · 85 m. Experimente registrar uma caminhada de demonstração.'}
        </Text>
        {!registered && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setRegistered(true)}
            style={s.save}
          >
            <Text style={s.fabText}>Registrar 85 m</Text>
          </Pressable>
        )}
      </DemoSheet>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f4f6' },
  navigation: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { fontSize: 17, fontWeight: '600', color: '#18181b' },
  demoLabel: { fontSize: 10, color: '#71717a', letterSpacing: 1 },
  coverShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.26)',
  },
  coverCaption: { position: 'absolute', left: 20, bottom: 20, gap: 5 },
  coverTitle: { fontSize: 26, fontWeight: '700', color: 'white' },
  coverMeta: { fontSize: 14, color: '#fafafa' },
  tabs: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  tabText: { fontSize: 15, fontWeight: '500', color: '#71717a' },
  activeTab: { color: '#18181b', fontWeight: '700' },
  underline: {
    position: 'absolute',
    height: 3,
    bottom: 0,
    backgroundColor: '#18181b',
  },
  segments: {
    marginHorizontal: 20,
    marginVertical: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e4e4e7',
    borderBottomWidth: 0,
  },
  segmentHighlight: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e4e4e7',
  },
  dock: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'white',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#d4d4d8',
    alignItems: 'flex-start',
    gap: 12,
  },
  dockTabs: { flex: 1, height: 58, borderBottomWidth: 0 },
  dockHighlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#f4f4f5',
    borderRadius: 14,
  },
  dockAction: {
    width: 52,
    height: 52,
    backgroundColor: '#18181b',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 3,
  },
  content: { padding: 20, gap: 20 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#09090b',
    letterSpacing: -0.5,
  },
  body: { fontSize: 15, lineHeight: 23, color: '#52525b' },
  muted: { fontSize: 14, color: '#71717a' },
  small: { fontSize: 12, color: '#71717a', lineHeight: 18 },
  heading: { fontSize: 17, fontWeight: '600', color: '#18181b' },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 20, gap: 10 },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  metric: { alignItems: 'center', gap: 8 },
  number: { fontSize: 34, fontWeight: '700', color: '#18181b' },
  unit: { fontSize: 20, color: '#71717a' },
  rule: { width: 1, height: 48, backgroundColor: '#e4e4e7' },
  history: { flexDirection: 'row', gap: 14, paddingBottom: 24 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: '#a1a1aa',
  },
  category: {
    minHeight: 52,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  list: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
  },
  rank: { width: 16, color: '#71717a', fontSize: 14 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f4f5',
  },
  avatarText: { color: '#52525b', fontSize: 13, fontWeight: '600' },
  name: { fontSize: 14, color: '#18181b', fontWeight: '600' },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181b',
    paddingHorizontal: 20,
    height: 52,
    borderRadius: 26,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: 'white', fontSize: 15, fontWeight: '600' },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d4d4d8',
    alignSelf: 'center',
  },
  sheetHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  close: { minHeight: 44, justifyContent: 'center' },
  save: {
    minHeight: 52,
    backgroundColor: '#18181b',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
