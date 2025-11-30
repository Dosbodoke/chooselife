import { Share } from 'react-native';
import { useI18n } from '~/context/i18n';

type ShareOptions = {
  title: string;
  url: string;
  type?: 'highline' | 'default';
};

export const useShare = () => {
  const { locale } = useI18n();

  const share = async ({ title, url, type = 'default' }: ShareOptions) => {
    try {
      const dialogTitle =
        locale === 'en' ? 'See on Chooselife' : 'Veja no Chooselife';

      let messageBody = '';
      if (type === 'highline') {
        messageBody =
          locale === 'en' ? `Highline ${title}` : `Via "${title}"`;
      } else {
        messageBody = title;
      }

      const message =
        locale === 'en'
          ? `${messageBody} on the Choose Life APP!\n\n🔗 Access now: ${url}`
          : `${messageBody} no APP Choose Life!\n\n🔗 Acesse agora: ${url}`;

      await Share.share({
        title: dialogTitle,
        message,
      });
    } catch (err) {
      console.log('Error sharing:', err);
    }
  };

  return { share };
};
