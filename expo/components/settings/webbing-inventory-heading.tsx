import {
  totalLength,
  type InventoryGroupSubject,
  type InventorySection,
} from '~/features/webbing/inventory';
import { Image } from 'expo-image';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PackageIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { WebbingWithUsage } from '~/hooks/use-webbings';
import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

const translationKey = 'components.settings.my-webbing';

/**
 * A group's heading and collapse toggle. While searching, matching groups are
 * shown open and the heading stops toggling.
 */
export function WebbingInventoryHeading({
  section: { group, matches, expanded },
  searching,
  photoUri,
  onToggle,
}: {
  section: InventorySection<WebbingWithUsage>;
  searching: boolean;
  /** The model photo, for model groups. */
  photoUri?: string;
  onToggle: () => void;
}) {
  const { t, i18n } = useTranslation();
  const title = useSubjectTitle(group.subject);
  const specs = group.subject.kind === 'model' ? group.subject.specs : null;
  const modelClass = specs?.modelStrengthClass?.value;
  const facts = specs
    ? [
        specs.materials?.join(' / '),
        specs.construction,
        modelClass
          ? t(`${translationKey}.strength`, { strength: modelClass })
          : null,
      ].filter(Boolean)
    : [];
  const tally = [
    searching
      ? t(`${translationKey}.searchResults`, {
          shown: matches.length,
          count: group.entries.length,
        })
      : t(`${translationKey}.count`, { count: group.entries.length }),
    `${totalLength(matches).toLocaleString(i18n.language)} m`,
  ].join(' · ');
  const ids = group.entries.map(({ webbing }) => `ID ${webbing.id}`);

  return (
    <Pressable
      onPress={onToggle}
      disabled={searching}
      accessibilityRole="button"
      accessibilityLabel={[
        title,
        ...facts,
        tally,
        ...(expanded ? [] : ids),
      ].join(', ')}
      accessibilityState={{ expanded, disabled: searching }}
      className="min-h-14 flex-row items-center gap-3 px-1 pb-2 pt-5 active:opacity-70"
    >
      <SubjectMark subject={group.subject} photoUri={photoUri} />
      <View className="flex-1 min-w-0 gap-0.5">
        <Text className="text-[15px] font-semibold leading-5 text-slate-900">
          {title}
        </Text>
        {facts.length ? (
          <Text className="text-xs text-slate-500">{facts.join(' · ')}</Text>
        ) : null}
        <Text className="text-xs text-slate-500">{tally}</Text>
        {!expanded ? (
          <View className="mt-1 flex-row flex-wrap gap-1">
            {ids.map((id) => (
              <Text
                key={id}
                className="overflow-hidden rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold text-white"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {id}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      {!searching ? (
        <Icon
          as={expanded ? ChevronDownIcon : ChevronRightIcon}
          size={18}
          className="text-slate-400"
        />
      ) : null}
    </Pressable>
  );
}

function useSubjectTitle(subject: InventoryGroupSubject) {
  const { t } = useTranslation();
  switch (subject.kind) {
    case 'model':
      return subject.specs.modelName ?? '';
    case 'brand':
      return subject.brand;
    case 'class':
      return t(
        `${translationKey}.${subject.claim === 'model' ? 'strength' : 'personalStrength'}`,
        { strength: subject.strength },
      );
    case 'missing':
      return t(`${translationKey}.missing.${subject.field}`);
    case 'all':
      return '';
  }
}

/** The square at the start of a heading: model photo, brand initial or class. */
function SubjectMark({
  subject,
  photoUri,
}: {
  subject: InventoryGroupSubject;
  photoUri?: string;
}) {
  const [brokenUri, setBrokenUri] = useState<string>();
  const frame =
    'size-12 items-center justify-center overflow-hidden rounded-xl';

  if (subject.kind === 'model')
    return (
      <View className={cn(frame, 'border border-slate-200 bg-white')}>
        {photoUri && photoUri !== brokenUri ? (
          <Image
            source={{ uri: photoUri }}
            contentFit="contain"
            style={{ width: 48, height: 48 }}
            onError={() => setBrokenUri(photoUri)}
          />
        ) : (
          <Icon as={PackageIcon} size={20} className="text-slate-400" />
        )}
      </View>
    );
  if (subject.kind === 'brand')
    return (
      <View className={cn(frame, 'rounded-full bg-slate-200')}>
        <Text className="text-base font-bold text-slate-700">
          {subject.brand.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  if (subject.kind === 'class')
    return (
      <View
        className={cn(
          frame,
          subject.claim === 'model'
            ? 'bg-slate-900'
            : 'border-[1.5px] border-slate-900 bg-white',
        )}
      >
        <Text
          className={cn(
            'text-base font-bold',
            subject.claim === 'model' ? 'text-white' : 'text-slate-900',
          )}
        >
          {subject.strength}
        </Text>
      </View>
    );
  return (
    <View
      className={cn(
        frame,
        'border-[1.5px] border-dashed border-slate-300 bg-white',
        subject.kind === 'missing' &&
          subject.field === 'brand' &&
          'rounded-full',
      )}
    >
      <Text className="text-base font-semibold text-slate-400">?</Text>
    </View>
  );
}
