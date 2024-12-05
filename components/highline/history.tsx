import { Link } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';

import { Highline } from '~/hooks/use-highline';
import { LucideIcon } from '~/lib/icons/lucide-icon';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Text } from '~/components/ui/text';

const HighlineHistory: React.FC<{ highline: Highline }> = ({ highline }) => (
  <Card>
    <CardHeader>
      <View className="flex-row justify-between">
        <CardTitle>Histórico de montagem</CardTitle>
        <Link asChild href={`/highline/${highline.id}/rig`}>
          <TouchableOpacity>
            <Text className="text-sm text-blue-500">montar</Text>
          </TouchableOpacity>
        </Link>
      </View>
      <CardDescription>
        Registrar a montagem é mais do que manter a história da via, é se
        preocupar com a segurança.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <View className="flex-row gap-2">
        <View className="items-center">
          <View className="size-3 rounded-full bg-green-500" />
          <View className="flex-1 w-1 rounded-sm bg-green-500" />
        </View>
        <View>
          <View className="flex-row gap-2">
            <Text className="text-primary font-semibold text-lg">
              Montada desde
            </Text>
            <CalendarBadge date="21/02/2024" />
          </View>
          <View>
            <Text>Principal: Sky 2d</Text>
            <Text>Principal: Sky 2d</Text>
          </View>
        </View>
      </View>
    </CardContent>
  </Card>
);

const CalendarBadge: React.FC<{ date: string }> = ({ date }) => (
  <View
    style={{
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,

      elevation: 3,
    }}
    className="flex-row gap-1 items-center bg-muted border-border rounded-sm px-2"
  >
    <LucideIcon name="CalendarRange" className="text-muted-foreground size-4" />
    <Text className="text-muted-foreground font-semibold">{date}</Text>
  </View>
);

export { HighlineHistory };
