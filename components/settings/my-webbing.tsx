import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { useUserWebbings } from '~/hooks/use-webbings';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { Tables } from '~/utils/database.types';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Text } from '~/components/ui/text';

import { Skeleton } from '../ui/skeleton';

type WebbingWithModel = Tables<'webbing'> & {
  model: Tables<'webbing_model'> | null;
};

const MyWebbings: React.FC = () => {
  const { t } = useTranslation();
  const { data: webbings, isPending } = useUserWebbings();

  return (
    <Card>
      <CardHeader>
        <View className="flex-row justify-between">
          <CardTitle>{t('components.settings.my-webbing.title')}</CardTitle>
          <Link asChild href={`/(modals)/register-webbing`}>
            <TouchableOpacity className="p-1">
              <Text className="text-base font-semibold text-blue-500">
                {t('components.settings.my-webbing.add')}
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
        <CardDescription>
          {t('components.settings.my-webbing.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <View className="gap-2">
            <SkeletonWebbingitem />
            <SkeletonWebbingitem />
            <SkeletonWebbingitem />
          </View>
        ) : webbings && webbings?.length > 0 ? (
          <WebbingList webbings={webbings} />
        ) : (
          <EmptyWebbing />
        )}
      </CardContent>
    </Card>
  );
};

const EmptyWebbing: React.FC = () => {
  const { t } = useTranslation();
  return (
    <View className="justify-center items-center">
      <View>
        <LucideIcon
          name="Frown"
          className="size-24 text-muted-foreground"
          strokeWidth={1}
        />
      </View>
      <Text className="text-muted-foreground">
        {t('components.settings.my-webbing.empty')}
      </Text>
    </View>
  );
};

const WebbingList: React.FC<{
  webbings: WebbingWithModel[];
}> = ({ webbings }) => {
  return (
    <View className="gap-2">
      {webbings.map((webbing) => (
        <WebbingItem key={webbing.id} webbing={webbing} />
      ))}
    </View>
  );
};

const WebbingItem: React.FC<{
  webbing: WebbingWithModel;
}> = ({ webbing }) => {
  return (
    <View className="flex-row justify-between items-center gap-4">
      <View className="flex-1">
        <Text className="font-bold">
          {webbing.model?.name ?? webbing.tag_name}
        </Text>
        <View className="flex-row gap-2 items-center">
          <LucideIcon
            name="MoveHorizontal"
            className="size-4 text-primary opacity-70"
          />
          <Text className="text-muted-foreground">{webbing.length}m</Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <LucideIcon
          name="ChevronRight"
          className="size-6 text-muted-foreground"
        />
      </View>
    </View>
  );
};

const SkeletonWebbingitem: React.FC = () => {
  return (
    <View className="flex-row justify-between items-center gap-4">
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 rounded-full w-[60%]" />
        <Skeleton className="h-3 rounded-full w-[40%]" />
      </View>
      <Skeleton className="h-6 w-6 rounded-full" />
    </View>
  );
};

export { MyWebbings };
