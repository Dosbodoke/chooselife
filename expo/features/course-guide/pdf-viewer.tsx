import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Pdf from 'react-native-pdf';

import { useMountEffect } from '~/hooks/use-mount-effect';

import { Text } from '~/components/ui/text';

import { CourseGuideErrorState } from './states';

type CoursePdfViewerProps = {
  uri: string;
  onRetry?: () => void | Promise<unknown>;
};

export function CoursePdfViewer({ uri, onRetry }: CoursePdfViewerProps) {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(1);
  const [pageCount, setPageCount] = React.useState(0);
  const [loadError, setLoadError] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const filePathRef = React.useRef<string | null>(null);

  useMountEffect(() => {
    return () => {
      const filePath = filePathRef.current;
      if (filePath) {
        void ReactNativeBlobUtil.fs.unlink(filePath).catch(() => undefined);
      }
    };
  });

  const handleRetry = React.useCallback(async () => {
    setLoadError(false);
    setPage(1);
    setPageCount(0);
    setAttempt((currentAttempt) => currentAttempt + 1);
    await onRetry?.();
  }, [onRetry]);

  if (loadError) {
    return (
      <CourseGuideErrorState
        title={t('app.learn.readerErrorTitle')}
        description={t('app.learn.readerErrorDescription')}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <View className="flex-1">
      <Pdf
        key={`${uri}:${attempt}`}
        source={{ uri, cache: false }}
        style={{ flex: 1 }}
        trustAllCerts={false}
        enablePaging={false}
        enableTextSelection={false}
        enableAnnotationRendering={false}
        onLoadComplete={(totalPages, path) => {
          filePathRef.current = path;
          setPageCount(totalPages);
        }}
        onPageChanged={(nextPage, totalPages) => {
          setPage(nextPage);
          setPageCount(totalPages);
        }}
        onError={() => {
          setLoadError(true);
        }}
        renderActivityIndicator={() => <ActivityIndicator />}
      />
      {pageCount > 0 ? (
        <View
          pointerEvents="none"
          className="absolute bottom-4 self-center rounded-full bg-black/70 px-3 py-1"
        >
          <Text className="text-xs text-white" selectable>
            {t('app.learn.pageIndicator', { page, pageCount })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
