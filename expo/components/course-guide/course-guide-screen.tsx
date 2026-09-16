import { useTranslation } from 'react-i18next';

import type { CourseGuideViewState } from '~/lib/course-guide-state';

import {
  CourseGuideCenteredState,
  CourseGuideErrorState,
  CourseGuideLoadingState,
  CourseGuideLockedState,
} from '~/components/course-guide/course-guide-states';
import { CoursePdfViewer } from '~/components/course-pdf-viewer';

type CourseGuideScreenProps = {
  onBack: () => void;
  onRetry: () => void;
  onSignIn: () => void;
  state: CourseGuideViewState;
};

export function CourseGuideScreen({
  onBack,
  onRetry,
  onSignIn,
  state,
}: CourseGuideScreenProps) {
  const { t } = useTranslation();

  if (state.kind === 'reader') {
    return (
      <CoursePdfViewer
        key={state.pdfUrl}
        uri={state.pdfUrl}
        onRetry={onRetry}
      />
    );
  }

  const screenByState = {
    error: (
      <CourseGuideErrorState
        title={t('app.learn.errorTitle')}
        description={t('app.learn.errorDescription')}
        onRetry={onRetry}
      />
    ),
    loading: <CourseGuideLoadingState />,
    locked: <CourseGuideLockedState onBack={onBack} />,
    offline: (
      <CourseGuideCenteredState
        kind="offline"
        title={t('app.learn.offlineTitle')}
        description={t('app.learn.offlineDescription')}
      />
    ),
    'sign-in': (
      <CourseGuideCenteredState
        kind="sign-in"
        title={t('app.learn.signInTitle')}
        description={t('app.learn.signInDescription')}
        action={{ label: t('app.learn.signIn'), onPress: onSignIn }}
      />
    ),
  } satisfies Record<
    Exclude<CourseGuideViewState['kind'], 'reader'>,
    React.ReactNode
  >;

  return screenByState[state.kind];
}
