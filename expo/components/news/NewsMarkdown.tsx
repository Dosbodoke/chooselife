import * as Linking from 'expo-linking';
import {
  EnrichedMarkdownText,
  type LinkPressEvent,
} from 'react-native-enriched-markdown';

type NewsMarkdownProps = {
  markdown: string;
};

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

const getProtocol = (url: string): string | null => {
  const protocolMatch = url.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!protocolMatch?.[1]) {
    return null;
  }

  return `${protocolMatch[1].toLowerCase()}:`;
};

const isSafeUrl = (url: string): boolean => {
  const protocol = getProtocol(url);
  if (!protocol) {
    return false;
  }

  return ALLOWED_LINK_PROTOCOLS.has(protocol);
};

const openSafeUrl = async (url: string) => {
  if (!isSafeUrl(url)) {
    return;
  }

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    return;
  }

  await Linking.openURL(url);
};

export const NewsMarkdown = ({ markdown }: NewsMarkdownProps) => {
  const handleLinkPress = ({ url }: LinkPressEvent) => {
    void openSafeUrl(url);
  };

  return (
    <EnrichedMarkdownText markdown={markdown} onLinkPress={handleLinkPress} />
  );
};
