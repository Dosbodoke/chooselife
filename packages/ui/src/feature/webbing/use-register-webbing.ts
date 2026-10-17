import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm, type SubmitHandler, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { useSupabase, type TypedSupabaseClient } from '../../supabase-provider';
import { webbingCatalogSnapshotSchema } from './catalog-snapshot';
import {
  parseWebbingLength,
  registerWebbing,
  WEBBING_REGISTRATION_SELECT,
  WebbingRegistrationError,
  type RegisteredWebbing,
  type StoredWebbingRegistration,
  type WebbingRegistrationRepository,
} from './register-webbing';
import { STRENGTH_CLASS_OPTIONS } from './types';

// ============================================================================
// Schema Definitions
// ============================================================================

/**
 * Base webbing schema for form inputs
 * length is a string that gets parsed to number on submit
 */
export const webbingSchema = z.object({
  length: z.string().min(1, 'Length is required').refine(
    (val) => parseWebbingLength(val) !== null,
    { message: 'Length must be a positive number' }
  ),
  leftLoop: z.boolean(),
  rightLoop: z.boolean(),
});

/**
 * Extended schema for webbing registration. A draft selects at most one of a
 * SlackData snapshot or a legacy model; manual registrations have neither.
 */
export const registerWebbingSchema = webbingSchema
  .extend({
    modelID: z.string().optional(),
    catalogSnapshot: webbingCatalogSnapshotSchema.nullable().optional(),
    registrationKey: z.string().uuid().optional(),
    note: z.string(),
    tagName: z.string().trim().min(1, 'Tag name is required'),
    strengthClass: z.enum(STRENGTH_CLASS_OPTIONS).optional(),
  })
  .refine((data) => !(data.modelID && data.catalogSnapshot), {
    message: 'Choose either a catalog model or a previous model, not both',
    path: ['modelID'],
  });

export type WebbingFormData = z.infer<typeof webbingSchema>;
export type RegisterWebbingFormData = z.infer<typeof registerWebbingSchema>;

// ============================================================================
// Supabase repository
// ============================================================================

export function createWebbingRegistrationRepository(
  supabase: TypedSupabaseClient,
): WebbingRegistrationRepository {
  return {
    findByRegistrationKey: async (userId, registrationKey) => {
      const { data, error } = await supabase
        .from('webbing')
        .select(WEBBING_REGISTRATION_SELECT)
        .eq('user_id', userId)
        .eq('registration_key', registrationKey)
        .maybeSingle();
      if (error) throw error;
      return data as StoredWebbingRegistration | null;
    },
    insert: async (row) =>
      supabase
        .from('webbing')
        .insert(row)
        .select('id, user_id, image_path, registration_key')
        .single(),
  };
}

// ============================================================================
// Hook
// ============================================================================

export interface UseRegisterWebbingOptions {
  /**
   * Callback that runs after query invalidation on successful registration
   */
  onSuccess?: (webbing: RegisteredWebbing) => void;
  /**
   * Creates the draft's registration key once per form. Every retry of the
   * draft reuses it, so a lost response recovers instead of duplicating.
   */
  createRegistrationKey?: () => string;
}

export interface UseRegisterWebbingReturn {
  form: UseFormReturn<RegisterWebbingFormData>;
  mutation: ReturnType<
    typeof useMutation<RegisteredWebbing, Error, RegisterWebbingFormData>
  >;
  /** Submit validated values; resolves null and sets a root error on failure. */
  submit: (data: RegisterWebbingFormData) => Promise<RegisteredWebbing | null>;
  handleSubmit: () => Promise<void>;
  isLoading: boolean;
}

/**
 * Hook for webbing registration form logic
 * Provides form state, mutation, and submit handler
 */
export function useRegisterWebbing(
  options?: UseRegisterWebbingOptions
): UseRegisterWebbingReturn {
  const { supabase, userId } = useSupabase();
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  // Created once per form; every retry of this draft reuses it.
  const [registrationKey] = useState(() => options?.createRegistrationKey?.());

  const form = useForm<RegisterWebbingFormData>({
    resolver: zodResolver(registerWebbingSchema),
    mode: 'onChange',
    defaultValues: {
      modelID: '',
      catalogSnapshot: null,
      registrationKey,
      note: '',
      tagName: '',
      length: '',
      leftLoop: false,
      rightLoop: false,
      strengthClass: undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: RegisterWebbingFormData) => {
      if (!userId) throw new Error('User not authenticated');

      const { webbing } = await registerWebbing({
        userId,
        repository: createWebbingRegistrationRepository(supabase),
        input: {
          registrationKey: data.registrationKey ?? null,
          length: data.length,
          leftLoop: data.leftLoop,
          rightLoop: data.rightLoop,
          tagName: data.tagName,
          note: data.note,
          strengthClass: data.strengthClass,
          legacyModelId: data.modelID || null,
          catalogSnapshot: data.catalogSnapshot ?? null,
        },
      });
      return webbing;
    },
    onSuccess: (webbing) => {
      // Invalidate every owner-scoped webbings query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['webbings'] });
      // Call user's onSuccess callback
      options?.onSuccess?.(webbing);
    },
  });

  const submit = async (data: RegisterWebbingFormData) => {
    // Block double submission before the pending state renders.
    if (inFlight.current) return null;
    inFlight.current = true;
    form.clearErrors('root');

    try {
      return await mutation.mutateAsync(data);
    } catch (error) {
      form.setError('root', {
        type:
          error instanceof WebbingRegistrationError ? error.code : 'submit',
        message:
          error instanceof Error ? error.message : 'Failed to register webbing',
      });
      return null;
    } finally {
      inFlight.current = false;
    }
  };

  const onSubmit: SubmitHandler<RegisterWebbingFormData> = async (data) => {
    await submit(data);
  };

  return {
    form,
    mutation,
    submit,
    handleSubmit: form.handleSubmit(onSubmit),
    isLoading: mutation.isPending,
  };
}
