import ReactMarkdown, {
  defaultUrlTransform,
  type UrlTransform,
} from "react-markdown";
import remarkGfm from "remark-gfm";

type NewsMarkdownProps = {
  markdown: string;
};

const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const getProtocol = (url: string): string | null => {
  const protocolMatch = url.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!protocolMatch?.[1]) {
    return null;
  }

  return `${protocolMatch[1].toLowerCase()}:`;
};

const safeUrlTransform: UrlTransform = (url) => {
  const normalizedUrl = defaultUrlTransform(url);

  if (!normalizedUrl) {
    return "";
  }

  if (normalizedUrl.startsWith("//")) {
    return "";
  }

  if (normalizedUrl.startsWith("/") || normalizedUrl.startsWith("#")) {
    return normalizedUrl;
  }

  const protocol = getProtocol(normalizedUrl);
  if (!protocol || !ALLOWED_LINK_PROTOCOLS.has(protocol)) {
    return "";
  }

  return normalizedUrl;
};

export function NewsMarkdown({ markdown }: NewsMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml={true}
      urlTransform={safeUrlTransform}
    >
      {markdown}
    </ReactMarkdown>
  );
}
