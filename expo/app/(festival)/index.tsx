import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import { LinearTransition } from 'react-native-reanimated';

import { useI18n } from '~/context/i18n';
import { cn } from '~/lib/utils';

import { Card, CardContent } from '~/components/ui/card';
import { Text } from '~/components/ui/text';

type TScheduleData = {
  id: number;
  title: string;
  instructor?: string;
  startAt: string;
  type?: 'workshop' | 'competition';
  location?: string;
  day?: string;
};

const scheduleData: TScheduleData[] = [
  // Quinta-feira: 2025-06-19
  {
    id: 1,
    title: 'Yoga e Respiração',
    instructor: 'Micaela Franzel',
    startAt: '08:00 - 09:00',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-19',
  },
  {
    id: 2,
    title: 'Altinha',
    startAt: '09:30 - 10:30',
    location: '🛠️🎤 Espaço Oficinas / Palco',
    day: '2025-06-19',
  },
  {
    id: 3,
    title: 'LACAM - oficina de produtos canábicos',
    instructor: 'Alisson Gabriel',
    startAt: '11:00 - 12:30',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-19',
  },
  {
    id: 4,
    title: 'Espaço Cuidado - Acupuntura, Auriculoterapia, Ventosaterapia',
    instructor: 'Nathalia Tavares',
    startAt: '13:00 - 16:00',
    type: 'workshop',
    location: '🌿 Espaço Cuidado (Oficinas)',
    day: '2025-06-19',
  },
  {
    id: 5,
    title: 'Roda de Conversa - Ouvidoria Delas',
    startAt: '16:30 - 17:30',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-19',
  },
  {
    id: 6,
    title: 'Oficina de capoeira + Roda de Capoeira',
    instructor: 'Angoleiros do Sertão',
    startAt: '18:00 - 20:00',
    type: 'workshop',
    location: '🛠️🎤 Espaço Oficinas / Palco',
    day: '2025-06-19',
  },
  {
    id: 7,
    title: 'Montagem Banda de Reggae',
    startAt: '20:00 - 21:00',
    location: '🎤 Palco',
    day: '2025-06-19',
  },
  {
    id: 8,
    title: 'Show de Reggae',
    startAt: '21:00 - 23:00',
    location: '🎤 Palco',
    day: '2025-06-19',
  },
  {
    id: 9,
    title: 'DJ',
    startAt: '23:00',
    location: '🎤 Palco',
    day: '2025-06-19',
  },

  // Sexta-feira: 2025-06-20
  {
    id: 10,
    title: 'Yoga',
    instructor: 'Alice Amaral',
    startAt: '08:00 - 09:00',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-20',
  },
  {
    id: 11,
    title: 'Pratique Movimento',
    startAt: '09:30 - 10:30',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-20',
  },
  {
    id: 12,
    title: 'Corpos em Diálogo - Pontos de (des)equilibrio em duo',
    instructor: 'Camila Ferreira',
    startAt: '11:00 - 12:00',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-20',
  },
  {
    id: 13,
    title: 'Oficina de Tecer Mandalas em linhas',
    instructor: 'Felipe Braga',
    startAt: '14:00 - 15:00',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-20',
  },
  {
    id: 14,
    title: 'Massagem e Yoga',
    instructor: 'Laís Cacciari',
    startAt: '15:30 - 17:30',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-20',
  },
  {
    id: 15,
    title: 'Forró nas Alturas',
    instructor: 'João Manoel da Silva Parreira',
    startAt: '18:00 - 19:30',
    location: '🎤 Palco',
    day: '2025-06-20',
  },
  {
    id: 16,
    title: 'Oficina de Forró',
    instructor: 'André Kenzo e Beatriz Furtado',
    startAt: '20:00 - 21:00',
    type: 'workshop',
    location: '🛠️🎤 Espaço Oficinas / Palco',
    day: '2025-06-20',
  },
  {
    id: 17,
    title: 'Forró',
    startAt: '21:00',
    location: '🎤 Palco',
    day: '2025-06-20',
  },

  // Sábado: 2025-06-21
  {
    id: 18,
    title: 'Yoga',
    instructor: 'Bianca Machado + Lotus',
    startAt: '08:00 - 09:00',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-21',
  },
  {
    id: 19,
    title: 'Elaboración de sahumerios artesanais - Aula de YOGA',
    instructor: 'Verónica Daniela',
    startAt: '09:30 - 10:30',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-21',
  },
  {
    id: 20,
    title: 'Crossfit Selva',
    instructor: 'Wendy lee e Ruggeri',
    startAt: '11:00 - 12:00',
    type: 'workshop',
    location: '🛠️🎤 Espaço Oficinas / Palco',
    day: '2025-06-21',
  },
  {
    id: 21,
    title: 'Yoga',
    instructor: 'Mariana Sarmento',
    startAt: '12:30 - 13:30',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-21',
  },
  {
    id: 22,
    title: 'Yoga - Kemetic',
    instructor: 'Ismael Afonso',
    startAt: '15:00 - 16:00',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-21',
  },
  {
    id: 23,
    title: 'Oficina de Perna de Pau',
    instructor: 'Giulia Largares',
    startAt: '16:30 - 17:30',
    type: 'workshop',
    location: '🛠️🎤 Espaço Oficinas / Palco',
    day: '2025-06-21',
  },
  {
    id: 24,
    title: 'Oficina de Bambolê',
    instructor: 'Voarte',
    startAt: '18:00 - 19:00',
    type: 'workshop',
    location: '🛠️🎤 Espaço Oficinas / Palco',
    day: '2025-06-21',
  },
  {
    id: 25,
    title: 'Alongamento Dinâmico',
    instructor: 'Ana Luisa Amaral',
    startAt: '19:30 - 20:30',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-21',
  },
  {
    id: 26,
    title: 'Cerimônia de premiação das modalidades e Rifa',
    startAt: '21:00 - 23:00',
    location: '🎤 Palco',
    day: '2025-06-21',
  },
  {
    id: 27,
    title: 'Batalha de Rima',
    startAt: '23:00 - 00:00',
    type: 'competition',
    location: '🎤 Palco',
    day: '2025-06-21',
  },
  {
    id: 28,
    title: 'BAILE DO CHOOSE + performance coletivo YABAS (fogo)',
    instructor: 'Ana Luisa Amaral (performance YABAS)',
    startAt: '00:00',
    location: '🎤 Palco',
    day: '2025-06-21',
  },

  // Domingo: 2025-06-22
  {
    id: 29,
    title: 'Yoga - Ashtanga Vinyasa e Parada de Mão',
    instructor: 'Luciana Casares Yoga 2',
    startAt: '08:00 - 09:00',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-22',
  },
  {
    id: 30,
    title: 'Soundhealing',
    instructor: 'Lotus Branca e Sara',
    startAt: '09:30 - 10:30',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-22',
  },
  {
    id: 31,
    title: 'Oficina de Jiu Jitsu e noções de defesa pessoal',
    instructor: 'Gabriel Schardong',
    startAt: '11:00 - 12:30',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-22',
  },
  {
    id: 32,
    title: 'Acrobacia em dupla/grupo',
    instructor: 'Matheus Kamla',
    startAt: '14:00 - 15:00',
    type: 'workshop',
    location: '🛠️🎤 Espaço Oficinas / Palco',
    day: '2025-06-22',
  },
  {
    id: 33,
    title: 'Yoga + Sound healing',
    instructor: 'Bianca + Lotus branca e Sara',
    startAt: '15:30 - 16:30',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-22',
  },
  {
    id: 34,
    title: 'Oficina de Massagem e Automassagem',
    instructor: 'Ariadne',
    startAt: '17:00 - 18:30',
    type: 'workshop',
    location: '🛠️ Espaço Oficinas',
    day: '2025-06-22',
  },
  {
    id: 35,
    title: 'Cinema de Bolso',
    instructor: 'Maria Flávia Borgonovi Pachá',
    startAt: '19:00 - 21:00',
    location: '🛠️🎤 Espaço Oficinas / Palco',
    day: '2025-06-22',
  },
  {
    id: 36,
    title: 'Sessão de Cinema',
    startAt: '21:00 - 00:00',
    location: '🛠️🎤 Espaço Oficinas / Palco',
    day: '2025-06-22',
  },
];

const dayTabs = [
  { id: 'all', label: 'Todos', icon: '📅' },
  { id: '2025-06-19', label: 'Quinta', icon: '📅' },
  { id: '2025-06-20', label: 'Sexta', icon: '📅' },
  { id: '2025-06-21', label: 'Sábado', icon: '📅' },
  { id: '2025-06-22', label: 'Domingo', icon: '📅' },
] as const;

const typeTabs = [
  { id: 'workshop', label: 'Workshops', icon: '🎯' },
  { id: 'competition', label: 'Competições', icon: '🏆' },
] as const;

const DAMPING = 80;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);

// Helper function to format date display
const formatDateDisplay = (dateString: string) => {
  const dateMap: Record<string, string> = {
    '2025-06-19': 'Quinta-feira, 19 de Junho',
    '2025-06-20': 'Sexta-feira, 20 de Junho',
    '2025-06-21': 'Sábado, 21 de Junho',
    '2025-06-22': 'Domingo, 22 de Junho',
  };
  return dateMap[dateString] || dateString;
};

// Helper function to get current day or 'all' if not available
const getCurrentDay = () => {
  const today = new Date();
  const currentDateString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

  // Check if current date exists in our event days
  const availableDays = [
    '2025-06-19',
    '2025-06-20',
    '2025-06-21',
    '2025-06-22',
  ];
  return availableDays.includes(currentDateString) ? currentDateString : 'all';
};

export default function EventsPage() {
  const [activeDay, setActiveDay] = useState<string>(getCurrentDay());
  const [activeType, setActiveType] = useState<
    (typeof typeTabs)[number]['id'] | null
  >(null);

  const { t } = useTranslation();
  const { locale } = useI18n();

  const filteredData = scheduleData.filter((item) => {
    const dayMatch = activeDay === 'all' || item.day === activeDay;
    const typeMatch = activeType === null || item.type === activeType;
    return dayMatch && typeMatch;
  });

  // Group filtered data by day for better organization
  const groupedByDay = filteredData.reduce(
    (acc, item) => {
      const day = item.day || 'no-date';
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(item);
      return acc;
    },
    {} as Record<string, TScheduleData[]>,
  );

  // Sort the days
  const sortedDays = Object.keys(groupedByDay).sort();

  return (
    <>
      <SafeAreaView className="flex-1 pt-8">
        <ScrollView contentContainerClassName="pt-8">
          {/* Day Filter Tabs */}
          <View className="px-4 mb-4">
            <Text className="text-lg font-semibold mb-3 text-gray-900">
              Dias do Evento
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {dayTabs.map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveDay(tab.id)}
                    className={cn(
                      'flex-row items-center px-4 py-2 rounded-full border',
                      activeDay === tab.id
                        ? 'bg-blue-100 border-blue-300'
                        : 'bg-white border-gray-300',
                    )}
                  >
                    <Text className="text-sm mr-1">{tab.icon}</Text>
                    <Text
                      className={cn(
                        'text-sm font-medium',
                        activeDay === tab.id
                          ? 'text-blue-800'
                          : 'text-gray-600',
                      )}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Type Filter Tabs */}
          <View className="px-4 mb-4">
            <Text className="text-lg font-semibold mb-3 text-gray-900">
              Tipo de Atividade
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {typeTabs.map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() =>
                      setActiveType(activeType === tab.id ? null : tab.id)
                    }
                    className={cn(
                      'flex-row items-center px-4 py-2 rounded-full border',
                      activeType === tab.id
                        ? 'bg-green-100 border-green-300'
                        : 'bg-white border-gray-300',
                    )}
                  >
                    <Text className="text-sm mr-1">{tab.icon}</Text>
                    <Text
                      className={cn(
                        'text-sm font-medium',
                        activeType === tab.id
                          ? 'text-green-800'
                          : 'text-gray-600',
                      )}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Events grouped by day */}
          <View className="px-4 gap-6">
            {activeDay === 'all' ? (
              // Show all days with headers
              sortedDays.map((day) => (
                <View key={day}>
                  <View className="mb-4">
                    <Text className="text-xl font-bold text-gray-900 mb-1">
                      {formatDateDisplay(day)}
                    </Text>
                    <View className="h-1 w-16 bg-blue-500 rounded-full" />
                  </View>
                  <View className="gap-4 mb-6">
                    {groupedByDay[day].map((data) => (
                      <ScheduleCard key={data.id} data={data} />
                    ))}
                  </View>
                </View>
              ))
            ) : (
              // Show only selected day
              <View className="gap-4">
                {filteredData.map((data) => (
                  <ScheduleCard key={data.id} data={data} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

export const ScheduleCard: React.FC<{ data: TScheduleData }> = ({ data }) => {
  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'workshop':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'competition':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'workshop':
        return '🎯';
      case 'competition':
        return '🏆';
      default:
        return '📅';
    }
  };

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardContent className="p-3">
        {/* Header with time and type */}
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-blue-50 rounded-lg items-center justify-center mr-3">
              <Text className="text-base">{getTypeIcon(data.type)}</Text>
            </View>
            <View>
              <Text className="text-base font-bold text-blue-600">
                {data.startAt}
              </Text>
              <Text className="text-xs text-gray-500">Horário</Text>
            </View>
          </View>

          {data.type && (
            <View
              className={cn(
                'px-2 py-1 rounded-full border',
                getTypeColor(data.type),
              )}
            >
              <Text className="text-xs font-medium capitalize">
                {data.type}
              </Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text className="text-base font-semibold text-gray-900 mb-2 leading-tight">
          {data.title}
        </Text>

        {/* Details */}
        <View className="gap-1">
          {data.instructor && (
            <View className="flex-row items-center gap-1">
              <Text className="text-sm text-gray-500">Instructor:</Text>
              <Text className="text-sm font-medium text-gray-700 flex-1">
                {data.instructor}
              </Text>
            </View>
          )}

          {data.location && (
            <View className="flex-row items-center gap-1">
              <Text className="text-sm text-gray-500">Local:</Text>
              <Text className="text-sm font-medium text-gray-700 flex-1">
                {data.location}
              </Text>
            </View>
          )}
        </View>
      </CardContent>
    </Card>
  );
};
