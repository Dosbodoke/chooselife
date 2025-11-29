import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Text } from '~/components/ui/text';
import { LucideIcon } from '~/lib/icons/lucide-icon';

const OrganizationsCard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Link href="/organizations" asChild>
        <TouchableOpacity>
            <Card>
                <CardHeader>
                    <CardTitle>{t('app.(tabs).settings.organizations.title')}</CardTitle>
                    <CardDescription>
                    {t('app.(tabs).settings.organizations.description')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <View className="flex-row items-center justify-between">
                        <Text className="text-primary">{t('app.(tabs).settings.organizations.viewOrganizations')}</Text>
                        <LucideIcon name="ArrowRight" className="size-4 text-primary" />
                    </View>
                </CardContent>
            </Card>
        </TouchableOpacity>
    </Link>
  );
};

export { OrganizationsCard };
