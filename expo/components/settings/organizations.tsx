import { Link } from 'expo-router';
import { ArrowRightIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

const OrganizationsCard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Link href="/organizations" asChild>
      <TouchableOpacity>
        <Card>
          <CardHeader>
            <CardTitle>
              {t('app.(tabs).settings.organizations.title')}
            </CardTitle>
            <CardDescription>
              {t('app.(tabs).settings.organizations.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <View className="flex-row items-center justify-between">
              <Text className="text-primary">
                {t('app.(tabs).settings.organizations.viewOrganizations')}
              </Text>
              <Icon as={ArrowRightIcon} className="size-4 text-primary" />
            </View>
          </CardContent>
        </Card>
      </TouchableOpacity>
    </Link>
  );
};

export { OrganizationsCard };
