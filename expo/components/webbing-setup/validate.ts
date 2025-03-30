import type { WebType } from '~/context/rig-form';
import { WebbingSchema } from "../webbing-input";
import i18next from 'i18next';

export const validateSectionLoops = ({
  webbings,
  type,
  highlineLength,
}: {
  webbings: WebbingSchema[];
  type: WebType;
  highlineLength: number;
}): string | undefined => {
  const totalLength = webbings.reduce(
    (acc, curr) => acc + Number(curr.length),
    0,
  );

  // Validate that section is longer than highline
  if (totalLength <= highlineLength) {
    return i18next.t('components.webbing-setup.validate.totalLength', {
      // Expect translation keys for "main" and "backup" to be defined
      type:
        type === 'main'
          ? i18next.t('components.webbing-setup.validate.main')
          : i18next.t('components.webbing-setup.validate.backup'),
    });
  }

  let errorMessage: string | undefined = undefined;
  webbings.forEach((webbing, index, array) => {
    if (errorMessage) return;

    // If it's a single section, it doesn't need loops (it will be connected directly to the web lock)
    const isSingle = array.length === 1;
    if (isSingle) return;

    const isFirst = index === 0;
    const isLast = index === array.length - 1;

    // First and last sections must have at least one loop
    if (isFirst || isLast) {
      if (!webbing.leftLoop && !webbing.rightLoop) {
        errorMessage = i18next.t('components.webbing-setup.validate.atLeastOneLoop', {
          section: index + 1,
        });
      }
      return;
    }

    // Middle sections must have both loops
    if (!webbing.leftLoop || !webbing.rightLoop) {
      errorMessage = i18next.t('components.webbing-setup.validate.bothLoops', {
        section: index + 1,
      });
      return;
    }
  });

  return errorMessage;
};

export const validateConnections = ({
  main,
  backup,
}: {
  main: WebbingSchema[];
  backup: WebbingSchema[];
}) => {
  let error: string | undefined = undefined;
  // Calculate cumulative lengths for main line
  const mainCumulative = main.reduce<number[]>((acc, curr) => {
    const prev = acc[acc.length - 1] || 0;
    return [...acc, prev + Number(curr.length)];
  }, []);

  // Calculate cumulative lengths for backup line
  const backupCumulative = backup.reduce<number[]>((acc, curr) => {
    const prev = acc[acc.length - 1] || 0;
    return [...acc, prev + Number(curr.length)];
  }, []);

  for (const [index, backupPosition] of backupCumulative.entries()) {
    // Find closest main cumulative position
    const closestMainIndex = mainCumulative.findIndex(
      (mainPosition) => mainPosition >= backupPosition,
    );

    const comparisonIndex =
      closestMainIndex === -1
        ? mainCumulative.length - 1
        : Math.max(0, closestMainIndex - 1);

    const mainAbsoluteLength = mainCumulative[comparisonIndex];

    // Skip validation if connecting to anchor
    if (comparisonIndex === mainCumulative.length - 1) return;

    // Validate length difference
    const lengthDifference = backupPosition - mainAbsoluteLength;

    if (lengthDifference < 2 || lengthDifference > 10) {
      error = i18next.t('components.webbing-setup.validate.connectionLength', {
        backupSection: index + 1,
        mainSection: comparisonIndex + 1,
      });
      break;
    }
  }

  return error;
};
