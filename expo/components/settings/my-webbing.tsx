import { Link } from 'expo-router';
import {
  FactoryIcon,
  FrownIcon,
  LayersIcon,
  LinkIcon,
  MoveHorizontalIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { getWebbingName, useUserWebbings } from '~/hooks/use-webbings';
import { Tables } from '~/utils/database.types';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Icon } from '~/components/ui/icon';
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
        <Icon
          as={FrownIcon}
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
    <View className="gap-6">
      {webbings.map((webbing) => (
        <WebbingItem key={webbing.id} webbing={webbing} />
      ))}
    </View>
  );
};

const WebbingItem: React.FC<{
  webbing: WebbingWithModel;
}> = ({ webbing }) => {
  const { t } = useTranslation();
  // Get loop status info
  let loopQuantity = 0;
  if (webbing.left_loop) loopQuantity += 1;
  if (webbing.right_loop) loopQuantity += 1;

  return (
    <View className="flex-row gap-4">
      <Text className="text-muted-foreground">{`#${webbing.id}`}</Text>
      <View className="flex-1">
        <Text className="font-bold">{getWebbingName(webbing)}</Text>

        <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-2">
          <View className="flex-row items-center">
            <Icon
              as={MoveHorizontalIcon}
              className="size-4 text-primary mr-1"
            />
            <Text className="text-sm">{webbing.length}m</Text>
          </View>

          {webbing.model ? (
            <>
              <View className="flex-row items-center">
                <Icon as={FactoryIcon} className="size-4 text-primary mr-1" />
                <Text className="text-sm">{webbing.model.material}</Text>
              </View>

              <View className="flex-row items-center">
                <Icon as={LayersIcon} className="size-4 text-primary mr-1" />
                <Text className="text-sm">{webbing.model.weave}</Text>
              </View>
            </>
          ) : null}
          <View className="flex-row items-center">
            <Icon as={LinkIcon} className="size-4 text-primary mr-1" />
            <Text className="text-sm">{`${loopQuantity} ${loopQuantity === 2 ? t('common.loops') : t('common.loop')}`}</Text>
          </View>
        </View>
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
